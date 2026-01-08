import { useEffect, useMemo, useState } from "react";
import { EmotionPicker, DEFAULT_EMOTION_CATEGORIES } from "../components/EmotionPicker";
import { AppLink } from "../router";
import { createEntry, listEntries } from "../api";

const DEFAULT_ENTRY =
  "Today felt lighter after an honest conversation. I still want to protect my energy, but I am proud of how I responded.";

const STATUS_COPY = {
  idle: "Draft a reflection to see a feedback preview.",
  analyzing: "Creating a metadata layer and next-step suggestion.",
  saved: "Saved to your journal.",
  error: "Saved, but the analysis could not be generated.",
};

const DEFAULT_EMOTIONS_PAYLOAD = { selected: [] };

function ContentGeneration() {
  const [emotions, setEmotions] = useState(DEFAULT_EMOTIONS_PAYLOAD);
  const [entry, setEntry] = useState("");
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [entries, setEntries] = useState([]);
  const [entriesError, setEntriesError] = useState("");
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);

  const formattedEntryTimestamp = dateValue =>
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(dateValue));

  useEffect(() => {
    let isActive = true;

    const loadEntries = async () => {
      setIsLoadingEntries(true);
      setEntriesError("");
      try {
        const response = await listEntries({ limit: 10 });
        if (!isActive) return;
        setEntries(response?.entries ?? []);
      } catch (error) {
        if (!isActive) return;
        setEntriesError(
          error instanceof Error ? error.message : "Unable to load reflections."
        );
      } finally {
        if (isActive) {
          setIsLoadingEntries(false);
        }
      }
    };

    loadEntries();

    return () => {
      isActive = false;
    };
  }, []);

  const handleSubmit = async event => {
    event.preventDefault();
    const entryText = entry.trim() || DEFAULT_ENTRY;
    setIsAnalyzing(true);
    setStatus("analyzing");
    setErrorMessage("");

    try {
      const response = await createEntry(entryText, emotions);
      setEntries(current => [response, ...current]);
      setStatus("saved");
      setEntry("");
      setEmotions(DEFAULT_EMOTIONS_PAYLOAD);
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to save reflection."
      );
    } finally {
      setIsAnalyzing(false);
    }
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
              <button className="primary-button" type="submit" disabled={isAnalyzing}>
                {isAnalyzing ? "Analyzing..." : "Save reflection"}
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={isAnalyzing}
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
          {errorMessage ? (
            <p className="content-form__error">{errorMessage}</p>
          ) : null}
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
            {isLoadingEntries ? (
              <p className="content-result__placeholder">
                Loading reflections...
              </p>
            ) : entries.length ? (
              <ul className="checkin-list">
                {entries.map(currentEntry => (
                  <li key={currentEntry.id} className="checkin-list__item">
                    <div>
                      <p className="checkin-list__meta">
                        {formattedEntryTimestamp(currentEntry.created_at)} · Feelings{" "}
                        {formatEmotions(currentEntry.emotions)}
                        {currentEntry.metadata
                          ? ` · ${currentEntry.metadata.word_count} words · ${currentEntry.metadata.reading_time_minutes} min read`
                          : ""}
                      </p>
                      <p className="checkin-list__note">{currentEntry.entry_text}</p>
                      {currentEntry.analysis ? (
                        <div className="checkin-list__analysis">
                          <p className="checkin-list__label">Summary</p>
                          <p className="checkin-list__note">
                            {currentEntry.analysis.summary}
                          </p>
                          <div className="checkin-list__tags">
                            <span className="tag-pill">
                              Tone: {currentEntry.analysis.emotional_tone}
                            </span>
                            {currentEntry.analysis.themes.map(theme => (
                              <span key={theme} className="tag-pill">
                                {theme}
                              </span>
                            ))}
                          </div>
                          <p className="checkin-list__label">Next step</p>
                          <p className="checkin-list__note">
                            {currentEntry.analysis.proposed_solution.title}
                          </p>
                          <ol className="checkin-list__steps">
                            {currentEntry.analysis.proposed_solution.steps.map(
                              step => (
                                <li key={step}>{step}</li>
                              )
                            )}
                          </ol>
                        </div>
                      ) : (
                        <p className="checkin-list__analysis-placeholder">
                          Analysis will appear once generated.
                        </p>
                      )}
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
          {entriesError ? (
            <p className="content-form__error">{entriesError}</p>
          ) : null}
        </section>
      </main>

      <footer className="footer">
        <p>
          Entries are stored in your journal workspace.
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
