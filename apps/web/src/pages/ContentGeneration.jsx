import { useMemo, useState } from "react";
import { AppLink } from "../router";

const DEFAULT_NOTE =
  "Noted elevated irritation after a schedule change. Took a short walk.";

const DEFAULT_TAGS = ["work", "conflict", "overstimulation"];

const STATUS_COPY = {
  idle: "Draft a short check-in to see it appear in your history.",
  saved: "Saved locally in this session.",
};

function ContentGeneration() {
  const [date, setDate] = useState("");
  const [intensity, setIntensity] = useState(5);
  const [tags, setTags] = useState(DEFAULT_TAGS.join(", "));
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("idle");
  const [entries, setEntries] = useState([
    {
      id: 1,
      date: "2024-05-18",
      intensity: 6,
      tags: ["conflict", "fatigue"],
      note: "Kept distance during a heated meeting. Calmed down after a reset.",
    },
  ]);

  const handleSubmit = event => {
    event.preventDefault();
    const nextEntry = {
      id: Date.now(),
      date: date || new Date().toISOString().slice(0, 10),
      intensity: Number(intensity),
      tags: tags
        .split(",")
        .map(tag => tag.trim())
        .filter(Boolean),
      note: note.trim() || DEFAULT_NOTE,
    };
    setEntries(current => [nextEntry, ...current]);
    setStatus("saved");
    setNote("");
  };

  const outputStatus = useMemo(
    () => STATUS_COPY[status] ?? STATUS_COPY.idle,
    [status]
  );

  return (
    <div className="page page--content">
      <header className="content-hero">
        <nav className="hero__nav">
          <span className="brand">TraceMap</span>
          <div className="hero__nav-actions">
            <AppLink className="ghost-button" to="/">
              Back to landing
            </AppLink>
            <span className="ghost-button ghost-button--muted">Check-in</span>
          </div>
        </nav>
        <div className="content-hero__copy">
          <p className="eyebrow">Daily check-in</p>
          <h1>Capture today’s signals.</h1>
          <p className="hero__lead">
            This MVP preview shows the flow: rate intensity, add tags, and leave
            a quick note. Your entries stay in-browser for now.
          </p>
        </div>
      </header>

      <main className="content-grid">
        <section className="content-card">
          <div className="content-card__header">
            <h2>Check-in details</h2>
            <p className="section__lead">
              Keep it short and honest. This is about tracking patterns, not
              perfect prose.
            </p>
          </div>
          <form className="content-form" onSubmit={handleSubmit}>
            <label className="content-form__label" htmlFor="checkin-date">
              Date
            </label>
            <input
              id="checkin-date"
              type="date"
              value={date}
              onChange={event => setDate(event.target.value)}
            />
            <label className="content-form__label" htmlFor="checkin-intensity">
              Intensity (1-10)
            </label>
            <input
              id="checkin-intensity"
              type="range"
              min="1"
              max="10"
              value={intensity}
              onChange={event => setIntensity(event.target.value)}
            />
            <label className="content-form__label" htmlFor="checkin-tags">
              Context tags
            </label>
            <input
              id="checkin-tags"
              type="text"
              placeholder={DEFAULT_TAGS.join(", ")}
              value={tags}
              onChange={event => setTags(event.target.value)}
            />
            <label className="content-form__label" htmlFor="checkin-note">
              Notes
            </label>
            <textarea
              id="checkin-note"
              name="checkin-note"
              rows={5}
              placeholder={DEFAULT_NOTE}
              value={note}
              onChange={event => setNote(event.target.value)}
            />
            <div className="content-form__actions">
              <button className="primary-button" type="submit">
                Save check-in
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setDate("");
                  setIntensity(5);
                  setTags(DEFAULT_TAGS.join(", "));
                  setNote("");
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
            <h2>Recent check-ins</h2>
            <p className="section__lead">
              Recent entries appear here. In the full MVP, you will be able to
              filter, export, and view trends.
            </p>
          </div>
          <div className="content-result content-result--list">
            {entries.length ? (
              <ul className="checkin-list">
                {entries.map(entry => (
                  <li key={entry.id} className="checkin-list__item">
                    <div>
                      <p className="checkin-list__meta">
                        {entry.date} · Intensity {entry.intensity}/10
                      </p>
                      <p className="checkin-list__note">{entry.note}</p>
                    </div>
                    <div className="checkin-list__tags">
                      {entry.tags.map(tag => (
                        <span key={`${entry.id}-${tag}`} className="tag-pill">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="content-result__placeholder">
                Your saved check-ins will appear here.
              </p>
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>
          Your entries are stored locally in this preview.
        </p>
        <p className="footer__disclaimer">
          Future versions will add encryption and exports.
        </p>
      </footer>
    </div>
  );
}

export default ContentGeneration;
