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

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function embedText(env: Env, text: string): Promise<number[]> {
  const res: any = await env.AI.run("@cf/baai/bge-base-en-v1.5", { text });
  const vec = res?.data?.[0];
  if (!Array.isArray(vec)) throw new Error("Invalid embedding response");
  return vec;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    
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

    return new Response("Not found", { status: 404 });
  },
};
