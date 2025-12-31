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

const EMBEDDING_DIMENSIONS = 1536;
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
  }

  if (corsOriginMatchers.some((matcher) => matcher(origin))) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Vary", "Origin");
  }
};

const hashToSeed = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

const embeddingFromQuery = (value: string): number[] => {
  let state = hashToSeed(value) || 1;
  const output = new Array<number>(EMBEDDING_DIMENSIONS);
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    output[i] = (state >>> 0) / 0xffffffff;
  }
  return output;
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

<<<<<<< HEAD
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
=======
    if (url.pathname === "/health") {
      return jsonResponse({ ok: true }, { status: 200 }, req);
    }

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: (() => {
        const headers = new Headers();
        applyCors(headers, req);
        return headers;
      })() });
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
          returnMetadata: true
        });
        const matches = results.matches.map((match) => ({
          id: match.id,
          score: match.score,
          metadata: match.metadata ?? null
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
  }
>>>>>>> a9a1179db632d4b282ff1c3811fbc26ceb2d164a
};
