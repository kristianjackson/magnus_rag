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
const STORY_MODEL = "@cf/meta/llama-3-8b-instruct";
const JOURNAL_MODEL = "@cf/meta/llama-3-8b-instruct";
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

async function generateStory(env: Env, idea: string): Promise<string> {
  const messages = [
    {
      role: "system",
      content:
        "You are a creative fiction writer crafting eerie, atmospheric short stories. Return only the story prose with no title or markdown.",
    },
    {
      role: "user",
      content: `Story idea: ${idea}\n\nWrite a 4-6 paragraph story with grounded details, an investigative tone, and a slow-building sense of dread.`,
    },
  ];

  const result: any = await env.AI.run(STORY_MODEL, {
    messages,
    max_tokens: 900,
  });

  return (
    result?.response ||
    result?.result ||
    result?.choices?.[0]?.message?.content ||
    ""
  ).trim();
}

function countWords(text: string) {
  const matches = text.trim().match(/\b\w+\b/g);
  return matches ? matches.length : 0;
}

function estimateReadingTime(wordCount: number) {
  if (!wordCount) return 0;
  return Math.max(1, Math.round(wordCount / 200));
}

function stripJsonFence(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

function normalizeThemes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(item => String(item)).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeSteps(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(item => String(item)).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

async function generateJournalInsights(
  env: Env,
  entry: string,
  emotions: unknown
): Promise<{
  summary: string;
  emotional_tone: string;
  themes: string[];
  proposed_solution: { title: string; steps: string[] };
}> {
  const messages = [
    {
      role: "system",
      content:
        "You are a supportive journaling coach. Return JSON only with keys: summary (1-2 sentences), emotional_tone (short phrase), themes (3-5 short strings), proposed_solution (object with title and 2-4 step array). Keep the tone gentle and practical.",
    },
    {
      role: "user",
      content: JSON.stringify({ entry, emotions }),
    },
  ];

  const result: any = await env.AI.run(JOURNAL_MODEL, {
    messages,
    max_tokens: 500,
  });

  const raw =
    result?.response ||
    result?.result ||
    result?.choices?.[0]?.message?.content ||
    "";
  const cleaned = stripJsonFence(raw);

  try {
    const parsed = JSON.parse(cleaned);
    const summary = typeof parsed?.summary === "string" ? parsed.summary.trim() : "";
    const emotionalTone =
      typeof parsed?.emotional_tone === "string"
        ? parsed.emotional_tone.trim()
        : "";
    const themes = normalizeThemes(parsed?.themes);
    const solutionTitle =
      typeof parsed?.proposed_solution?.title === "string"
        ? parsed.proposed_solution.title.trim()
        : "";
    const solutionSteps = normalizeSteps(parsed?.proposed_solution?.steps);

    return {
      summary,
      emotional_tone: emotionalTone,
      themes,
      proposed_solution: { title: solutionTitle, steps: solutionSteps },
    };
  } catch {
    return {
      summary: "",
      emotional_tone: "",
      themes: [],
      proposed_solution: { title: "", steps: [] },
    };
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    try {
      const url = new URL(req.url);

      if (req.method === "GET") {
        switch (url.pathname) {
          case "/search": {
            const q = (url.searchParams.get("q") ?? "").trim();
            if (!q) return corsJson({ error: "Missing q" }, 400);
            if (q.length > 500) return corsJson({ error: "q too long" }, 400);

            const topK = Math.min(
              Number(url.searchParams.get("topK") ?? "8"),
              MAX_TOP_K
            );

            const qVec = await embedText(env, q);
            const res: any = await env.VECTORIZE_INDEX.query(qVec, {
              topK,
              returnMetadata: true,
            });

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

            const qVec = await embedText(env, q);
            const res: any = await env.VECTORIZE_INDEX.query(qVec, {
              topK,
              returnMetadata: true,
            });

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

      if (req.method === "POST" && url.pathname === "/generate-story") {
        let payload: any = null;

        try {
          payload = await req.json();
        } catch {
          return corsJson({ error: "Invalid JSON body" }, 400);
        }

        const idea = (payload?.prompt ?? "").trim();
        if (!idea) {
          return corsJson({ error: "Missing prompt" }, 400);
        }
        if (idea.length > 800) {
          return corsJson({ error: "Prompt too long" }, 400);
        }

        const story = await generateStory(env, idea);
        if (!story) {
          return corsJson({ error: "Story generation failed" }, 500);
        }

        return corsJson({ prompt: idea, story });
      }

      if (req.method === "POST" && url.pathname === "/journal/analyze") {
        let payload: any = null;

        try {
          payload = await req.json();
        } catch {
          return corsJson({ error: "Invalid JSON body" }, 400);
        }

        const entry = (payload?.entry ?? "").trim();
        if (!entry) {
          return corsJson({ error: "Missing entry" }, 400);
        }
        if (entry.length > 4000) {
          return corsJson({ error: "Entry too long" }, 400);
        }

        const wordCount = countWords(entry);
        const sentenceCount =
          entry.match(/[.!?]+/g)?.length ?? (entry.trim() ? 1 : 0);
        const metadata = {
          word_count: wordCount,
          character_count: entry.length,
          sentence_count: sentenceCount,
          reading_time_minutes: estimateReadingTime(wordCount),
          emotions: payload?.emotions ?? null,
        };

        const analysis = await generateJournalInsights(
          env,
          entry,
          payload?.emotions ?? null
        );

        return corsJson({
          entry,
          metadata,
          analysis,
        });
      }

      return withCors(new Response("Not found", { status: 404 }));
    } catch (error: any) {
      return corsJson({ error: error?.message ?? String(error) }, 500);
    }
  },
};
