const API_BASE = import.meta.env.VITE_API_BASE_URL;

export async function search(query: string) {
  const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}
