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
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

const EMBED_MODEL = "@cf/baai/bge-base-en-v1.5";
const ANSWER_MODEL = "@cf/meta/llama-3-8b-instruct";

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
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    
    if (req.method === "GET" && url.pathname === "/search") {
      const q = (url.searchParams.get("q") ?? "").trim();
      if (!q) return json({ error: "Missing q" }, 400);
      if (q.length > 500) return json({ error: "q too long" }, 400);

      const topK = Math.min(Number(url.searchParams.get("topK") ?? "8"), 20);

      const qVec = await embedText(env, q);
      const res: any = await env.VECTORIZE_INDEX.query(qVec, { topK, returnMetadata: true });

      const matches = res?.matches ?? [];
      const out = [];

      for (const m of matches) {
        const obj = await env.R2_BUCKET.get(`chunks/${m.id}.json`);
        const chunk = obj ? await obj.json<any>() : null;

        out.push({
          id: m.id,
          score: m.score,
          source: chunk?.source ?? m.metadata?.source ?? null,
          title: chunk?.title ?? m.metadata?.title ?? null,
          snippet: snippet(chunk?.text ?? ""),
          metadata: m.metadata ?? null,
        });
      }

      return json({ query: q, matches: out });
    }

    if (req.method === "GET" && url.pathname === "/answer") {
      const q = (url.searchParams.get("q") ?? "").trim();
      if (!q) return json({ error: "Missing q" }, 400);
      if (q.length > 500) return json({ error: "q too long" }, 400);

      const topK = Math.min(Number(url.searchParams.get("topK") ?? "5"), 12);

      const qVec = await embedText(env, q);
      const res: any = await env.VECTORIZE_INDEX.query(qVec, { topK, returnMetadata: true });

      const matches = res?.matches ?? [];
      const citations = [];
      const contexts = [];

      for (const m of matches) {
        const obj = await env.R2_BUCKET.get(`chunks/${m.id}.json`);
        const chunk = obj ? await obj.json<any>() : null;
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

      return json({ query: q, answer, citations });
    }

    // ---------- Health ----------
    if (req.method === "GET" && url.pathname === "/health") {
      return json({ ok: true });
    }

    // ---------- Debug bindings ----------
    if (req.method === "GET" && url.pathname === "/debug/bindings") {
      return json({
        hasR2: !!env.R2_BUCKET,
        hasVectorize: !!env.VECTORIZE_INDEX,
        hasAI: !!env.AI,
        hasAdminToken: !!env.ADMIN_TOKEN,
      });
    }

    if (req.method === "GET" && url.pathname === "/debug/health") {
      const [r2, ai] = await Promise.all([checkR2(env), checkAI(env)]);
      const vectorize = await checkVectorize(env, ai.ok ? ai.vector : undefined);

      return json({
        r2,
        ai: ai.ok ? { ok: true, dimensions: ai.dimensions } : ai,
        vectorize,
      });
    }

    // ---------- Index chunks ----------
    if (req.method === "POST" && url.pathname === "/admin/index") {
      const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      if (!token || token !== env.ADMIN_TOKEN) {
        return json({ error: "unauthorized" }, 401);
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

      return json({
        indexed: results.filter(r => r.ok).length,
        failed: results.filter(r => !r.ok).length,
        nextCursor: list.truncated ? list.cursor : null,
      });
    }

    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  },
};
