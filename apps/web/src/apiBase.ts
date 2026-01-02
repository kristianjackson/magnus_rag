const DEFAULT_API_BASE = "/api";
const LOCAL_API_BASE = "http://localhost:8787";
const DEPLOYED_WORKER_ORIGIN =
  "https://magnus-api.kristian-jackson.workers.dev";
const RAW_ENV_API_BASE = (import.meta.env.VITE_API_BASE_URL || "").trim();
const IS_LOCALHOST =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);
const FALLBACK_API_BASE = IS_LOCALHOST ? LOCAL_API_BASE : DEFAULT_API_BASE;

const normalizeEnvApiBase = (value: string) => {
  if (!value) {
    return "";
  }

  const trimmed = value.replace(/\/$/, "");
  try {
    const url = new URL(trimmed);
    const isHttpsPage =
      typeof window !== "undefined" && window.location.protocol === "https:";
    if (isHttpsPage && url.protocol === "http:") {
      return "";
    }
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
      const deployedUrl = new URL(DEPLOYED_WORKER_ORIGIN);
      if (url.origin !== deployedUrl.origin) {
        return "";
      }
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return trimmed;
  }
};

const ENV_API_BASE = normalizeEnvApiBase(RAW_ENV_API_BASE);

const uniqueBases = (bases: string[]) =>
  bases.filter((base, index) => bases.indexOf(base) === index);

export const API_BASES = uniqueBases(
  ENV_API_BASE ? [ENV_API_BASE, FALLBACK_API_BASE] : [FALLBACK_API_BASE]
);
export const PRIMARY_API_BASE = API_BASES[0];
