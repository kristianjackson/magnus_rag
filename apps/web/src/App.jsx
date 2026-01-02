import { useMemo, useState } from "react";
import "./App.css";
import { API_BASES, PRIMARY_API_BASE } from "./apiBase";

const extractItems = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.citations)) return data.citations;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;
  return [];
};

const formatTitle = (item, index) => {
  if (!item || typeof item !== "object") {
    return `Result ${index + 1}`;
  }
  return (
    item.title ||
    item.name ||
    item.heading ||
    item.query ||
    `Result ${index + 1}`
  );
};

const formatSnippet = (item) => {
  if (!item || typeof item !== "object") return null;
  return (
    item.snippet ||
    item.summary ||
    item.description ||
    item.text ||
    item.content ||
    null
  );
};

const formatLink = (item) => {
  if (!item || typeof item !== "object") return null;
  return item.url || item.link || item.href || null;
};

const limitText = (text, maxLength = 220) => {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
};

const ResultCard = ({ item, index }) => {
  const title = formatTitle(item, index);
  const snippet = formatSnippet(item);
  const link = formatLink(item);
  const score = item?.score;
  const source = item?.source;
  const parsedScore = Number(score);
  const formattedScore =
    score !== undefined && Number.isFinite(parsedScore)
      ? parsedScore.toFixed(4)
      : score;

  return (
    <article className="result-card">
      <div className="result-card__header">
        <h3>{title}</h3>
        {link ? (
          <a href={link} target="_blank" rel="noreferrer">
            {link}
          </a>
        ) : null}
      </div>
      {score !== undefined || source ? (
        <div className="result-card__meta">
          {score !== undefined ? (
            <span>Score: {formattedScore}</span>
          ) : null}
          {source ? <span>Source: {source}</span> : null}
        </div>
      ) : null}
      {snippet ? <p>{snippet}</p> : null}
    </article>
  );
};

const RawResponse = ({ data }) => (
  <details className="raw-response">
    <summary>Raw response</summary>
    <pre>{JSON.stringify(data, null, 2)}</pre>
  </details>
);

function App() {
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(8);
  const [data, setData] = useState(null);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showExcerpts, setShowExcerpts] = useState(false);

  const items = useMemo(() => extractItems(data), [data]);
  const contexts = useMemo(
    () => (Array.isArray(data?.contexts) ? data.contexts : []),
    [data]
  );
  const excerpts = useMemo(() => {
    if (contexts.length) {
      return contexts.map((context, index) => ({
        id: `context-${index}`,
        title: context.title,
        source: context.source,
        snippet: limitText(context.text),
        text: context.text,
      }));
    }
    if (Array.isArray(data?.citations)) {
      return data.citations.map((citation, index) => ({
        id: citation.id ?? `citation-${index}`,
        title: citation.title,
        source: citation.source,
        snippet: limitText(citation.snippet || citation.text || ""),
        text: citation.text,
      }));
    }
    return [];
  }, [contexts, data]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");
    setData(null);
    setAnswer("");

    try {
      const resolvedTopK = Math.max(1, Number(topK) || 1);
      let json = null;

      for (const apiBase of API_BASES) {
        try {
          const response = await fetch(
            `${apiBase}/answer?q=${encodeURIComponent(
              trimmed
            )}&topK=${resolvedTopK}&includeContexts=1`
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

      if (!json) {
        throw new Error("Request failed without a response.");
      }

      setData(json);
      setAnswer(json.answer || "");
      setShowExcerpts(false);
    } catch (fetchError) {
      const fallbackBases = API_BASES.slice(1);
      const fallbackMessage = fallbackBases.length
        ? ` Also tried ${fallbackBases.join(", ")}.`
        : "";
      const message =
        fetchError instanceof TypeError
          ? `Unable to reach the Magnus API at ${PRIMARY_API_BASE}. Check VITE_API_BASE_URL or your network connection.${fallbackMessage}`
          : fetchError.message || "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <p className="app__eyebrow">Magnus RAG Search</p>
          <h1>Search the Magnus index</h1>
        </div>
        <p className="app__subtitle">
          Enter a query to retrieve results from the Magnus API.
        </p>
      </header>

      <form className="search-form" onSubmit={handleSubmit}>
        <label htmlFor="query">Search query</label>
        <div className="search-form__row">
          <input
            id="query"
            name="query"
            type="text"
            placeholder="e.g. onboarding checklist"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="search-form__control">
            <label htmlFor="topK">Top K</label>
            <input
              id="topK"
              name="topK"
              type="number"
              min={1}
              max={50}
              value={topK}
              onChange={(event) => setTopK(Number(event.target.value) || 1)}
            />
          </div>
          <button type="submit" disabled={loading || !query.trim()}>
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </form>

      <section className="results">
        {error ? <p className="status status--error">{error}</p> : null}
        {loading ? <p className="status">Searching the index...</p> : null}
        {!loading && answer ? (
          <div className="answer-card">
            <div className="answer-card__header">
              <h2>Answer</h2>
              {excerpts.length ? (
                <label className="answer-card__toggle">
                  <input
                    type="checkbox"
                    checked={showExcerpts}
                    onChange={(event) => setShowExcerpts(event.target.checked)}
                  />
                  Show full excerpts
                </label>
              ) : null}
            </div>
            <p>{answer}</p>
            {excerpts.length ? (
              <div className="answer-card__excerpts">
                <h3>Supporting excerpts</h3>
                <ol>
                  {excerpts.map((excerpt) => (
                    <li key={excerpt.id}>
                      <div className="excerpt-meta">
                        {excerpt.title ? <strong>{excerpt.title}</strong> : null}
                        {excerpt.source ? <span>{excerpt.source}</span> : null}
                      </div>
                      <p>
                        {showExcerpts && excerpt.text
                          ? excerpt.text
                          : excerpt.snippet}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        ) : null}
        {!loading && data && items.length === 0 ? (
          <p className="status">No structured results found.</p>
        ) : null}

        {items.length > 0 ? (
          <div className="results__grid">
            {items.map((item, index) => (
              <ResultCard key={index} item={item} index={index} />
            ))}
          </div>
        ) : null}

        {data ? <RawResponse data={data} /> : null}
      </section>
    </div>
  );
}

export default App;
