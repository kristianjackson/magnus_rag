import { useMemo, useState } from "react";
import { EmotionPicker, DEFAULT_EMOTION_CATEGORIES } from "../components/EmotionPicker";
import { AppLink } from "../router";

const DEFAULT_ENTRY =
  "Today felt lighter after an honest conversation. I still want to protect my energy, but I am proud of how I responded.";

const STATUS_COPY = {
  idle: "Draft a reflection to see a feedback preview.",
  saved: "Saved locally in this session.",
};

const DEFAULT_EMOTIONS_PAYLOAD = { selected: [] };

function ContentGeneration() {
  const [emotions, setEmotions] = useState(DEFAULT_EMOTIONS_PAYLOAD);
  const [entry, setEntry] = useState("");
  const [status, setStatus] = useState("idle");
  const [entries, setEntries] = useState([
    {
      id: 1,
      date: "2024-05-18T09:32:00.000Z",
      emotions: {
        selected: [
          {
            categoryId: "grateful",
            intensity: 2,
            selectedSynonyms: ["Thankful"],
          },
          {
            categoryId: "capable",
            intensity: 1,
            selectedSynonyms: ["Prepared"],
          },
        ],
      },
      entry:
        "Noticed I felt more grounded after a slow morning routine. Staying present helped me avoid spiraling.",
    },
  ]);

  const formattedEntryTimestamp = dateValue =>
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(dateValue));

  const handleSubmit = event => {
    event.preventDefault();
    const nextTimestamp = new Date().toISOString();
    const nextEntry = {
      id: Date.now(),
      date: nextTimestamp,
      emotions,
      entry: entry.trim() || DEFAULT_ENTRY,
    };
    setEntries(current => [nextEntry, ...current]);
    setStatus("saved");
    setEntry("");
  };

  const outputStatus = useMemo(
    () => STATUS_COPY[status] ?? STATUS_COPY.idle,
    [status]
  );

  const emotionsById = useMemo(
    () => new Map(DEFAULT_EMOTION_CATEGORIES.map(category => [category.id, category])),
    []
  );

  const formatEmotions = payload => {
    if (!payload?.selected?.length) {
      return "None";
    }

    return payload.selected
      .map(selection => {
        const category = emotionsById.get(selection.categoryId);
        if (!category) {
          return selection.categoryId;
        }
        const synonyms =
          selection.selectedSynonyms?.length
            ? ` (${selection.selectedSynonyms.join(", ")})`
            : "";
        return `${category.label}${synonyms}`;
      })
      .join(", ");
  };

  return (
    <div className="page page--content">
      <header className="content-hero">
        <nav className="hero__nav">
          <span className="brand">Lumenary</span>
          <div className="hero__nav-actions">
            <AppLink className="ghost-button" to="/">
              Back to landing
            </AppLink>
            <span className="ghost-button ghost-button--muted">Reflection</span>
          </div>
        </nav>
        <div className="content-hero__copy">
          <p className="eyebrow">Journal workspace</p>
          <h1>Capture a reflection and preview the feedback.</h1>
          <p className="hero__lead">
            This is the shell of the guided journaling flow. Write freely, add
            your reflections, and see the type of insights you will receive
            when the LLM analysis is connected.
          </p>
        </div>
      </header>

      <main className="content-grid">
        <section className="content-card">
          <div className="content-card__header">
            <h2>Reflection details</h2>
            <p className="section__lead">
              Keep it authentic. You can always edit or delete entries later.
            </p>
          </div>
          <form className="content-form" onSubmit={handleSubmit}>
            <label className="content-form__label">
              Feelings to track
            </label>
            <EmotionPicker onChange={setEmotions} />
            <label className="content-form__label" htmlFor="reflection-entry">
              Journal entry
            </label>
            <textarea
              id="reflection-entry"
              name="reflection-entry"
              rows={5}
              placeholder={DEFAULT_ENTRY}
              value={entry}
              onChange={event => setEntry(event.target.value)}
            />
            <div className="content-form__actions">
              <button className="primary-button" type="submit">
                Save reflection
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setEmotions(DEFAULT_EMOTIONS_PAYLOAD);
                  setEntry("");
                }}
              >
                Clear
              </button>
            </div>
          </form>
          <p className="content-form__status">{outputStatus}</p>
        </section>

        <section className="content-card content-card--result">
          <div className="content-card__header">
            <h2>Feedback preview</h2>
            <p className="section__lead">
              Once analysis is connected, each entry will include a summary,
              emotional tone, and gentle next steps.
            </p>
          </div>
          <div className="content-result content-result--list">
            {entries.length ? (
              <ul className="checkin-list">
                {entries.map(currentEntry => (
                  <li key={currentEntry.id} className="checkin-list__item">
                    <div>
                      <p className="checkin-list__meta">
                        {formattedEntryTimestamp(currentEntry.date)} · Feelings{" "}
                        {formatEmotions(currentEntry.emotions)}
                      </p>
                      <p className="checkin-list__note">{currentEntry.entry}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="content-result__placeholder">
                Your reflections will appear here.
              </p>
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>
          Entries are stored locally in this preview.
        </p>
        <p className="footer__disclaimer">
          LLM analysis, sharing controls, and exports are coming in future
          releases.
        </p>
      </footer>
    </div>
  );
}

export default ContentGeneration;
