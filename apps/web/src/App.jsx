import { useMemo, useState } from "react";
import "./App.css";

const API_BASE = "https://magnus-api.kristian-jackson.workers.dev/search?q=";

const extractItems = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const items = useMemo(() => extractItems(data), [data]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");
    setData(null);

    try {
      const resolvedTopK = Math.max(1, Number(topK) || 1);
      const response = await fetch(
        `${API_BASE}${encodeURIComponent(trimmed)}&topK=${resolvedTopK}`
      );
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const json = await response.json();
      setData(json);
    } catch (fetchError) {
      setError(fetchError.message || "Something went wrong.");
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
