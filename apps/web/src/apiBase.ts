const DEFAULT_API_BASE = "/api";
const LOCAL_API_BASE = "http://localhost:8787";
const ENV_API_BASE = (import.meta.env.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const IS_LOCALHOST =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);
const FALLBACK_API_BASE = IS_LOCALHOST ? LOCAL_API_BASE : DEFAULT_API_BASE;

const uniqueBases = (bases: string[]) =>
  bases.filter((base, index) => bases.indexOf(base) === index);

export const API_BASES = uniqueBases(
  ENV_API_BASE ? [ENV_API_BASE, FALLBACK_API_BASE] : [FALLBACK_API_BASE]
);
export const PRIMARY_API_BASE = API_BASES[0];
