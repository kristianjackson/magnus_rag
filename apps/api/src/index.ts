export interface Env {
  R2_BUCKET: R2Bucket;
  VECTORIZE_INDEX: VectorizeIndex;
  AI: Fetcher;
}

function json(res: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(res, null, 2), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers || {}) },
  });
}

async function readJsonFromR2(env: Env, key: string) {
  const obj = await env.R2_BUCKET.get(key);
  if (!obj) return null;
  return await obj.json<any>();
}

async function embedText(env: Env, text: string): Promise<number[]> {
  // Workers AI embeddings model (768 dims)
  const out: any = await env.AI.run("@cf/baai/bge-base-en-v1.5", { text });
  // Docs show embeddings returned under data[0] for embeddings. :contentReference[oaicite:2]{index=2}
  const vec = out?.data?.[0];
  if (!Array.isArray(vec)) throw new Error("Unexpected embeddings response shape");
  return vec;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // ---- Admin indexer ----
    if (req.method === "POST" && url.pathname === "/admin/index") {
      // basic safety: require a token so you don’t expose this publicly
      const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      const expected = (env as any).ADMIN_TOKEN; // add as a secret later
      if (!expected || token !== expected) {
        return json({ error: "Unauthorized" }, { status: 401 });
      }

      const limit = Math.min(Number(url.searchParams.get("limit") ?? "25"), 50);
      const cursor = url.searchParams.get("cursor") ?? undefined;

      // List objects in R2 under chunks/
      // R2 list uses prefix + cursor pagination. :contentReference[oaicite:3]{index=3}
      const listed = await env.R2_BUCKET.list({
        prefix: "chunks/",
        limit,
        cursor,
      });

      const objects = listed.objects ?? [];
      const results: Array<{ id: string; ok: boolean; error?: string }> = [];

      // Process sequentially to keep CPU predictable; you can parallelize later.
      for (const o of objects) {
        try {
          const key = o.key; // e.g. chunks/<id>.json
          const chunk = await readJsonFromR2(env, key);
          if (!chunk?.id || !chunk?.text) throw new Error("Bad chunk JSON");

          const values = await embedText(env, chunk.text);

          // Upsert into Vectorize (async mutation under the hood). :contentReference[oaicite:4]{index=4}
          await env.VECTORIZE_INDEX.upsert([
            {
              id: chunk.id,
              values,
              metadata: {
                source: chunk.source ?? null,
                title: chunk.title ?? null,
                chunk_index: chunk.metadata?.chunk_index ?? null,
                chunk_count: chunk.metadata?.chunk_count ?? null,
              },
            },
          ]);

          results.push({ id: chunk.id, ok: true });
        } catch (e: any) {
          results.push({ id: String(o.key), ok: false, error: e?.message ?? String(e) });
        }
      }

      return json({
        indexed: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        nextCursor: listed.truncated ? listed.cursor : null,
        sample: results.slice(0, 5),
      });
    }

    // ---- Health ----
    if (req.method === "GET" && url.pathname === "/health") {
      return json({ ok: true });
    }

    return new Response("Not Found", { status: 404 });
  },
};
