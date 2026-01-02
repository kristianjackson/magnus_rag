const DEFAULT_API_BASE = "https://magnus-api.kristian-jackson.workers.dev";
const LOCAL_API_BASE = "http://localhost:8787";
const ENV_API_BASE = (import.meta.env.VITE_API_BASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const IS_LOCALHOST =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API_BASE = ENV_API_BASE || (IS_LOCALHOST ? LOCAL_API_BASE : DEFAULT_API_BASE);

export async function search(query: string) {
  const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}
