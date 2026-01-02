import { API_BASES } from "./apiBase";

const fetchWithFallback = async (path: string) => {
  let lastError: unknown = null;

  for (const apiBase of API_BASES) {
    try {
      const res = await fetch(`${apiBase}${path}`);
      if (!res.ok) throw new Error("Search failed");
      return res;
    } catch (error) {
      lastError = error;
      if (error instanceof TypeError && apiBase !== API_BASES[API_BASES.length - 1]) {
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error("Search failed");
};

export async function search(query: string) {
  const res = await fetchWithFallback(`/search?q=${encodeURIComponent(query)}`);
  return res.json();
}
