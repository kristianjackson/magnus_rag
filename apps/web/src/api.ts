import { API_BASES, PRIMARY_API_BASE } from "./apiBase";

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

const postWithFallback = async (path: string, payload: Record<string, unknown>) => {
  let lastError: unknown = null;

  for (const apiBase of API_BASES) {
    try {
      const res = await fetch(`${apiBase}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let errorMessage = "Request failed";
        try {
          const errorBody = await res.json();
          if (errorBody?.error) {
            errorMessage = String(errorBody.error);
          }
        } catch {
          // Ignore JSON parsing errors, fall back to generic message.
        }
        throw new Error(errorMessage);
      }
      if (!res.ok) throw new Error("Request failed");
      return res;
    } catch (error) {
      lastError = error;
      if (error instanceof TypeError && apiBase !== API_BASES[API_BASES.length - 1]) {
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error("Request failed");
};

export async function search(query: string) {
  const res = await fetchWithFallback(`/search?q=${encodeURIComponent(query)}`);
  return res.json();
}

export async function answer(query: string, topK: number) {
  const resolvedTopK = Math.max(1, Number(topK) || 1);
  let json: unknown = null;

  try {
    for (const apiBase of API_BASES) {
      try {
        const response = await fetch(
          `${apiBase}/answer?q=${encodeURIComponent(query)}&topK=${resolvedTopK}`
        );
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        json = await response.json();
        break;
      } catch (requestError) {
        if (
          requestError instanceof TypeError &&
          apiBase !== API_BASES[API_BASES.length - 1]
        ) {
          continue;
        }
        throw requestError;
      }
    }
  } catch (fetchError) {
    const fallbackBases = API_BASES.slice(1);
    const fallbackMessage = fallbackBases.length
      ? ` Also tried ${fallbackBases.join(", ")}.`
      : "";
    const message =
      fetchError instanceof TypeError
        ? `Unable to reach the Magnus API at ${PRIMARY_API_BASE}. Check VITE_API_BASE_URL or your network connection.${fallbackMessage}`
        : fetchError instanceof Error
          ? fetchError.message || "Something went wrong."
          : "Something went wrong.";
    throw new Error(message);
  }

  if (!json) {
    throw new Error("Request failed without a response.");
  }

  return json;
}

export async function generateStory(prompt: string) {
  const res = await postWithFallback("/generate-story", { prompt });
  return res.json();
}
