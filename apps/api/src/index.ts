export interface Env {
  R2_BUCKET: R2Bucket;
  VECTORIZE_INDEX: VectorizeIndex;
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
};
