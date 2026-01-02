const DEFAULT_API_BASE = "https://magnus-api.kristian-jackson.workers.dev";

interface Env {
  API_BASE_URL?: string;
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

export async function onRequest({ request, env }: { request: Request; env: Env }) {
  const base = stripTrailingSlash(env.API_BASE_URL || DEFAULT_API_BASE);
  const url = new URL(request.url);
  const apiPath = url.pathname.replace(/^\/api/, "") || "/";
  const targetUrl = new URL(apiPath, base);
  targetUrl.search = url.search;

  const proxyRequest = new Request(targetUrl.toString(), request);
  return fetch(proxyRequest);
}
