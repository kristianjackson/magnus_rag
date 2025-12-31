export interface Env {
  R2_BUCKET: R2Bucket;
  VECTORIZE_INDEX: VectorizeIndex;
  AI: Fetcher;
  ADMIN_TOKEN: string;
}

async function readJsonFromR2(env: Env, key: string) {
  const obj = await env.R2_BUCKET.get(key);
  if (!obj) return null;
  return await obj.json<any>();
}

async function embedText(env: Env, text: string): Promise<number[]> {
  // Workers AI embeddings model (768 dims)
  const out: any = await env.AI.run("@cf/baai/bge-base-en-v1.5", { text });
  const vec = out?.data?.[0]?.embedding ?? out?.data?.[0];
  if (!Array.isArray(vec)) {
    throw new Error("Unexpected embeddings response shape");
  }
  if (vec.length !== 768 || vec.some((value) => typeof value !== "number")) {
    throw new Error("Embedding vector must be 768 floats");
  }
  return vec as number[];
}

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
      );
    }
  },
};
