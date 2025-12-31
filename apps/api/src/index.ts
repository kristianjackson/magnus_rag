export interface Env {
  R2_BUCKET: R2Bucket;
  VECTORIZE_INDEX: VectorizeIndex;
  AI: Fetcher;
  ADMIN_TOKEN: string;
<<<<<<< HEAD
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
=======
>>>>>>> c16c56c9537191b37be20e6d00a5c42ab0b9009d
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
<<<<<<< HEAD
  // Embeddings result shape per Cloudflare examples: data[0] is the vector
  const vec = out?.data?.[0];
  if (!Array.isArray(vec)) {
    throw new Error(`Unexpected embeddings response shape: ${JSON.stringify(out)?.slice(0, 200)}`);
=======
  const vec = out?.data?.[0]?.embedding ?? out?.data?.[0];
  if (!Array.isArray(vec)) {
    throw new Error("Unexpected embeddings response shape");
  }
  if (vec.length !== 768 || vec.some((value) => typeof value !== "number")) {
    throw new Error("Embedding vector must be 768 floats");
>>>>>>> c16c56c9537191b37be20e6d00a5c42ab0b9009d
  }
  return vec as number[];
}

<<<<<<< HEAD
function requireAdmin(req: Request, env: Env): Response | null {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return json({ error: "Unauthorized" }, { status: 401 });
=======
const EMBEDDING_DIMENSIONS = 768;
const MAX_QUERY_LENGTH = 500;
const DEFAULT_TOP_K = 10;
const LOCALHOST_ORIGIN = "http://localhost:5173";

const corsOriginMatchers: Array<(origin: string) => boolean> = [
  (origin) => origin === LOCALHOST_ORIGIN,
  (origin) => /^https?:\/\/.*\.pages\.dev$/i.test(origin)
];

const jsonResponse = (
  body: unknown,
  init: ResponseInit,
  req: Request
): Response => {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  applyCors(headers, req);
  return new Response(JSON.stringify(body), { ...init, headers });
};

const applyCors = (headers: Headers, req: Request): void => {
  const origin = req.headers.get("Origin");
  if (!origin) {
    return;
>>>>>>> c16c56c9537191b37be20e6d00a5c42ab0b9009d
  }
  return null;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(req.url);

<<<<<<< HEAD
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
=======
    try {
      if (url.pathname === "/health") {
        return jsonResponse({ ok: true }, { status: 200 }, req);
      }

      if (req.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: (() => {
            const headers = new Headers();
            applyCors(headers, req);
            return headers;
          })(),
        });
      }

      if (req.method === "POST" && url.pathname === "/admin/index") {
        const token = req.headers
          .get("authorization")
          ?.replace(/^Bearer\s+/i, "");
        if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
          return jsonResponse({ error: "Unauthorized" }, { status: 401 }, req);
        }

        const limitRaw = Number(url.searchParams.get("limit") ?? "25");
        const limit = Math.min(
          Number.isFinite(limitRaw) ? limitRaw : 25,
          50
        );
        const cursor = url.searchParams.get("cursor") ?? undefined;

        const listed = await env.R2_BUCKET.list({
          prefix: "chunks/",
          limit,
          cursor,
        });

        let indexed = 0;
        let failed = 0;
        const sampleErrors: Array<{ key: string; error: string }> = [];

        for (const object of listed.objects ?? []) {
          try {
            const chunk = await readJsonFromR2(env, object.key);
            if (
              !chunk ||
              typeof chunk.id !== "string" ||
              typeof chunk.text !== "string" ||
              typeof chunk.source !== "string" ||
              typeof chunk.title !== "string" ||
              !chunk.metadata ||
              typeof chunk.metadata !== "object"
            ) {
              throw new Error("Chunk JSON missing required fields");
            }

            const values = await embedText(env, chunk.text);

            await env.VECTORIZE_INDEX.upsert([
              {
                id: chunk.id,
                values,
                metadata: {
                  source: chunk.source,
                  title: chunk.title,
                  chunk_index: chunk.metadata?.chunk_index ?? null,
                  chunk_count: chunk.metadata?.chunk_count ?? null,
                },
              },
            ]);

            indexed += 1;
          } catch (error: any) {
            failed += 1;
            if (sampleErrors.length < 5) {
              sampleErrors.push({
                key: object.key,
                error: error?.message ?? String(error),
              });
            }
          }
        }

        return jsonResponse(
          {
            indexed,
            failed,
            nextCursor: listed.truncated ? listed.cursor : null,
            sampleErrors,
          },
          { status: 200 },
          req
        );
      }

      if (url.pathname === "/search") {
        if (req.method !== "GET") {
          return jsonResponse(
            { error: "Method not allowed" },
            { status: 405 },
            req
          );
        }

        const query = url.searchParams.get("q");
        if (!query || query.trim().length === 0) {
          return jsonResponse(
            { error: "Query parameter q is required" },
            { status: 400 },
            req
          );
        }

        if (query.length > MAX_QUERY_LENGTH) {
          return jsonResponse(
            { error: "Query parameter q must be 500 characters or fewer" },
            { status: 400 },
            req
          );
        }

        try {
          const embedding = embeddingFromQuery(query);
          const results = await env.VECTORIZE_INDEX.query(embedding, {
            topK: DEFAULT_TOP_K,
            returnMetadata: true,
          });
          const matches = results.matches.map((match) => ({
            id: match.id,
            score: match.score,
            metadata: match.metadata ?? null,
          }));

          return jsonResponse({ query, matches }, { status: 200 }, req);
        } catch (error) {
          return jsonResponse(
            { error: "Failed to query vector index" },
            { status: 500 },
            req
          );
        }
      }

      return jsonResponse({ error: "Not Found" }, { status: 404 }, req);
    } catch (error: any) {
      return jsonResponse(
        { error: "Unhandled error", details: error?.message ?? String(error) },
        { status: 500 },
        req
>>>>>>> c16c56c9537191b37be20e6d00a5c42ab0b9009d
      );
    }
  },
};
