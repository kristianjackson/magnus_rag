export interface Env {
  R2_BUCKET: R2Bucket;
  VECTORIZE_INDEX: VectorizeIndex;
  AI: Fetcher;
  ADMIN_TOKEN: string;
}

function snippet(text: string, n = 260) {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n) + "…";
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Max-Age": "86400",
};

function withCors(response: Response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function corsJson(data: any, status = 200) {
  return withCors(json(data, status));
}

const EMBED_MODEL = "@cf/baai/bge-base-en-v1.5";
const ANSWER_MODEL = "@cf/meta/llama-3-8b-instruct";
const MAX_TOP_K = 12;

async function checkR2(env: Env) {
  try {
    const list = await env.R2_BUCKET.list({ limit: 1 });
    return { ok: true, objects: list.objects.length };
  } catch (error: any) {
    return { ok: false, error: error?.message ?? String(error) };
  }
}

async function checkAI(env: Env) {
  try {
    const res: any = await env.AI.run(EMBED_MODEL, { text: "health check" });
    const vec = res?.data?.[0];
    if (!Array.isArray(vec)) {
      return { ok: false, error: "Invalid embedding response" };
    }
    return { ok: true, vector: vec, dimensions: vec.length };
  } catch (error: any) {
    return { ok: false, error: error?.message ?? String(error) };
  }
}

async function checkVectorize(env: Env, vector?: number[]) {
  if (!vector) {
    return { ok: false, error: "No vector available for query" };
  }
  try {
    const res: any = await env.VECTORIZE_INDEX.query(vector, { topK: 1 });
    const matches = Array.isArray(res?.matches) ? res.matches.length : 0;
    return { ok: true, matches };
  } catch (error: any) {
    return { ok: false, error: error?.message ?? String(error) };
  }
}

async function embedText(env: Env, text: string): Promise<number[]> {
  const res: any = await env.AI.run(EMBED_MODEL, { text });
  const vec = res?.data?.[0];
  if (!Array.isArray(vec)) throw new Error("Invalid embedding response");
  return vec;
}

async function generateAnswer(
  env: Env,
  query: string,
  contexts: Array<{ source: string | null; title: string | null; text: string }>
): Promise<string> {
  const contextText = contexts
    .map((chunk, index) => {
      const headerParts = [
        chunk.title ? `Title: ${chunk.title}` : null,
        chunk.source ? `Source: ${chunk.source}` : null,
      ].filter(Boolean);
      const header = headerParts.length ? `${headerParts.join(" | ")}\n` : "";
      return `Excerpt ${index + 1}:\n${header}${chunk.text}`;
    })
    .join("\n\n---\n\n");

  const messages = [
    {
      role: "system",
      content:
        "You are a helpful assistant. Use the provided excerpts to answer the question. If the answer is not in the excerpts, say you do not know.",
    },
    {
      role: "user",
      content: `Question: ${query}\n\nExcerpts:\n${contextText}`,
    },
  ];

  const result: any = await env.AI.run(ANSWER_MODEL, { messages });
  return (
    result?.response ||
    result?.result ||
    result?.choices?.[0]?.message?.content ||
    ""
  ).trim();
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    try {
      const url = new URL(req.url);

      if (req.method === "GET") {
        console.log("GET request to:", url.pathname);
        switch (url.pathname) {
          case "/search": {
            const q = (url.searchParams.get("q") ?? "").trim();
            if (!q) return corsJson({ error: "Missing q" }, 400);
            if (q.length > 500) return corsJson({ error: "q too long" }, 400);

            const topK = Math.min(
              Number(url.searchParams.get("topK") ?? "8"),
              MAX_TOP_K
            );

            let qVec;
            try {
              qVec = await embedText(env, q);
            } catch (embedError: any) {
              console.error("Embed error:", embedError);
              return corsJson({ 
                error: `Failed to embed query: ${embedError?.message ?? String(embedError)}` 
              }, 500);
            }

            let res: any;
            try {
              res = await env.VECTORIZE_INDEX.query(qVec, {
                topK,
                returnMetadata: true,
              });
            } catch (queryError: any) {
              console.error("Vectorize query error:", queryError);
              return corsJson({ 
                error: `Failed to query vectorize: ${queryError?.message ?? String(queryError)}` 
              }, 500);
            }

            const matches = res?.matches ?? [];
            const out = [];

            for (const m of matches) {
              let obj, chunk;
              try {
                obj = await env.R2_BUCKET.get(`chunks/${m.id}.json`);
                chunk = obj ? await obj.json<any>() : null;
              } catch (r2Error: any) {
                console.error(`R2 error for chunk ${m.id}:`, r2Error);
                chunk = null;
              }

              out.push({
                id: m.id,
                score: m.score,
                source: chunk?.source ?? m.metadata?.source ?? null,
                title: chunk?.title ?? m.metadata?.title ?? null,
                snippet: snippet(chunk?.text ?? ""),
                metadata: m.metadata ?? null,
              });
            }

            return corsJson({ query: q, matches: out });
          }
          case "/answer": {
            const q = (url.searchParams.get("q") ?? "").trim();
            const includeContexts =
              url.searchParams.get("includeContexts") === "1" ||
              url.searchParams.get("includeContexts") === "true";
            if (!q) return corsJson({ error: "Missing q" }, 400);
            if (q.length > 500) return corsJson({ error: "q too long" }, 400);

            const topK = Math.min(
              Number(url.searchParams.get("topK") ?? "5"),
              MAX_TOP_K
            );

            let qVec;
            try {
              qVec = await embedText(env, q);
            } catch (embedError: any) {
              console.error("Embed error:", embedError);
              return corsJson({ 
                error: `Failed to embed query: ${embedError?.message ?? String(embedError)}` 
              }, 500);
            }

            let res: any;
            try {
              res = await env.VECTORIZE_INDEX.query(qVec, {
                topK,
                returnMetadata: true,
              });
            } catch (queryError: any) {
              console.error("Vectorize query error:", queryError);
              return corsJson({ 
                error: `Failed to query vectorize: ${queryError?.message ?? String(queryError)}` 
              }, 500);
            }

            const matches = res?.matches ?? [];
            const citations = [];
            const contexts = [];

            for (const m of matches) {
              let obj, chunk;
              try {
                obj = await env.R2_BUCKET.get(`chunks/${m.id}.json`);
                chunk = obj ? await obj.json<any>() : null;
              } catch (r2Error: any) {
                console.error(`R2 error for chunk ${m.id}:`, r2Error);
                chunk = null;
              }
              const text = chunk?.text ?? "";

              contexts.push({
                source: chunk?.source ?? m.metadata?.source ?? null,
                title: chunk?.title ?? m.metadata?.title ?? null,
                text,
              });

              citations.push({
                id: m.id,
                score: m.score,
                source: chunk?.source ?? m.metadata?.source ?? null,
                title: chunk?.title ?? m.metadata?.title ?? null,
                snippet: snippet(text),
                metadata: m.metadata ?? null,
              });
            }

            const answer = contexts.length
              ? await generateAnswer(env, q, contexts)
              : "I do not know.";

            const payload: Record<string, any> = { query: q, answer, citations };
            if (includeContexts) {
              payload.contexts = contexts;
            }

            return corsJson(payload);
          }
          case "/health":
            return corsJson({ ok: true });
          case "/debug/bindings":
            return corsJson({
              hasR2: !!env.R2_BUCKET,
              hasVectorize: !!env.VECTORIZE_INDEX,
              hasAI: !!env.AI,
              hasAdminToken: !!env.ADMIN_TOKEN,
            });
          case "/debug/health": {
            const [r2, ai] = await Promise.all([checkR2(env), checkAI(env)]);
            const vectorize = await checkVectorize(
              env,
              ai.ok ? ai.vector : undefined
            );

            return corsJson({
              r2,
              ai: ai.ok ? { ok: true, dimensions: ai.dimensions } : ai,
              vectorize,
            });
          }
          default:
            break;
        }
      }

      // ---------- Index chunks ----------
      if (req.method === "POST" && url.pathname === "/admin/index") {
        const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token || token !== env.ADMIN_TOKEN) {
          return corsJson({ error: "unauthorized" }, 401);
        }

        const limit = Math.min(Number(url.searchParams.get("limit") || 25), 50);
        const cursor = url.searchParams.get("cursor") ?? undefined;

        const list = await env.R2_BUCKET.list({
          prefix: "chunks/",
          limit,
          cursor,
        });

        const results: any[] = [];

        for (const obj of list.objects) {
          try {
            const data = await env.R2_BUCKET.get(obj.key);
            if (!data) continue;

            const chunk = await data.json();
            if (!chunk?.text || !chunk?.id) continue;

            const embedding = await embedText(env, chunk.text);

            await env.VECTORIZE_INDEX.upsert([
              {
                id: chunk.id,
                values: embedding,
                metadata: {
                  source: chunk.source ?? null,
                  title: chunk.title ?? null,
                  chunk_index: chunk.metadata?.chunk_index ?? null,
                },
              },
            ]);

            results.push({ id: chunk.id, ok: true });
          } catch (e: any) {
            results.push({ error: e?.message ?? String(e) });
          }
        }

        return corsJson({
          indexed: results.filter(r => r.ok).length,
          failed: results.filter(r => !r.ok).length,
          nextCursor: list.truncated ? list.cursor : null,
        });
      }

      return withCors(new Response("Not found", { status: 404 }));
    } catch (error: any) {
      const errorMessage = error?.message ?? String(error);
      const errorStack = error?.stack;
      console.error("API Error:", errorMessage, errorStack);
      return corsJson({ 
        error: errorMessage,
        stack: errorStack 
      }, 500);
    }
  },
};
