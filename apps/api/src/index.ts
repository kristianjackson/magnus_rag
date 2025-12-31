export interface Env {
  R2_BUCKET: R2Bucket;
  VECTORIZE_INDEX: VectorizeIndex;
  AI: Fetcher;
  ADMIN_TOKEN: string;
}

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "Content-Type,Authorization",
};

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...CORS_HEADERS,
      ...(init.headers || {}),
    },
  });
}

function snippet(text: string, n = 260): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n) + "…";
}

async function readChunkFromR2(env: Env, id: string): Promise<any | null> {
  const key = `chunks/${id}.json`;
  const obj = await env.R2_BUCKET.get(key);
  if (!obj) return null;
  return await obj.json<any>();
}

async function readChunkByKey(env: Env, key: string): Promise<any | null> {
  const obj = await env.R2_BUCKET.get(key);
  if (!obj) return null;
  return await obj.json<any>();
}

async function embedText(env: Env, text: string): Promise<number[]> {
  // Workers AI embeddings model (typically 768 dims)
  const out: any = await env.AI.run("@cf/baai/bge-base-en-v1.5", { text });
  // Embeddings result shape per Cloudflare examples: data[0] is the vector
  const vec = out?.data?.[0];
  if (!Array.isArray(vec)) {
    throw new Error(`Unexpected embeddings response shape: ${JSON.stringify(out)?.slice(0, 200)}`);
  }
  return vec as number[];
}

function requireAdmin(req: Request, env: Env): Response | null {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(req.url);

      // Preflight
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      // Health
      if (req.method === "GET" && url.pathname === "/health") {
        return json({ ok: true });
      }

      // Admin batch indexer: POST /admin/index?limit=25&cursor=...
      if (req.method === "POST" && url.pathname === "/admin/index") {
        const unauth = requireAdmin(req, env);
        if (unauth) return unauth;

        const limitRaw = Number(url.searchParams.get("limit") ?? "25");
        const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 25;
        const cursor = url.searchParams.get("cursor") ?? undefined;

        // List objects in R2 under chunks/
        const listed = await env.R2_BUCKET.list({
          prefix: "chunks/",
          limit,
          cursor,
        });

        const objects = listed.objects ?? [];
        const results: Array<{ key: string; id?: string; ok: boolean; error?: string }> = [];

        for (const o of objects) {
          const key = o.key; // chunks/<id>.json
          try {
            const chunk = await readChunkByKey(env, key);
            if (!chunk?.id || !chunk?.text) {
              throw new Error("Bad chunk JSON (missing id or text)");
            }

            const values = await embedText(env, chunk.text);

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

            results.push({ key, id: chunk.id, ok: true });
          } catch (e: any) {
            results.push({ key, ok: false, error: e?.message ?? String(e) });
          }
        }

        return json({
          indexed: results.filter((r) => r.ok).length,
          failed: results.filter((r) => !r.ok).length,
          nextCursor: listed.truncated ? listed.cursor : null,
          sampleErrors: results.filter((r) => !r.ok).slice(0, 5),
        });
      }

      // Search: GET /search?q=...&topK=8
      if (req.method === "GET" && url.pathname === "/search") {
        const q = (url.searchParams.get("q") ?? "").trim();
        if (!q) return json({ error: "Missing q" }, { status: 400 });
        if (q.length > 500) return json({ error: "q too long" }, { status: 400 });

        const topKRaw = Number(url.searchParams.get("topK") ?? "8");
        const topK = Number.isFinite(topKRaw) ? Math.min(Math.max(topKRaw, 1), 20) : 8;

        const qVec = await embedText(env, q);

        const res: any = await env.VECTORIZE_INDEX.query(qVec, { topK, returnMetadata: true });
        const matches = res?.matches ?? [];

        const out = [];
        for (const m of matches) {
          const chunk = await readChunkFromR2(env, m.id);
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

      return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
    } catch (e: any) {
      // Prevent opaque 1101s by returning actual error payload
      console.error("Unhandled error", e);
      return json(
        { error: "Unhandled", message: e?.message ?? String(e) },
        { status: 500 }
      );
    }
  },
};
