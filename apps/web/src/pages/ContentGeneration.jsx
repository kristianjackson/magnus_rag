import { useMemo, useState } from "react";
import { AppLink } from "../router";
import { generateStory } from "../api";

const DEFAULT_IDEA =
  "A misplaced archival key unlocks a room that should not exist beneath the Institute.";

const wrapText = (text, maxLength) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  words.forEach(word => {
    const nextLine = line ? `${line} ${word}` : word;
    if (nextLine.length > maxLength) {
      if (line) {
        lines.push(line);
        line = word;
      } else {
        lines.push(word);
      }
    } else {
      line = nextLine;
    }
  });

  if (line) lines.push(line);
  return lines.join("\n");
};

const sanitizePdfText = text =>
  text
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const createPdfBlob = content => {
  const wrapped = wrapText(content, 88);
  const lines = sanitizePdfText(wrapped).split("\n");
  const textLines = lines.map((line, index) => {
    const prefix = index === 0 ? "" : "T*\n";
    return `${prefix}(${line}) Tj`;
  });

  const stream = [
    "BT",
    "/F1 12 Tf",
    "16 TL",
    "72 720 Td",
    ...textLines,
    "ET",
  ].join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj",
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach(object => {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach(offset => {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  });

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
};

function ContentGeneration() {
  const [idea, setIdea] = useState("");
  const [story, setStory] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const resolvedIdea = idea.trim() || DEFAULT_IDEA;
  const isLoading = status === "loading";

  const handleSubmit = async event => {
    event.preventDefault();
    setError("");
    setStatus("loading");

    try {
      const data = await generateStory(resolvedIdea);
      setStory((data?.story ?? "").trim());
      setStatus("success");
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to generate a story right now.";
      setError(message);
      setStatus("error");
    }
  };

  const handleDownload = () => {
    if (!story) return;
    const blob = createPdfBlob(`Idea: ${resolvedIdea}\n\n${story}`);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "magnus-story.pdf";
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const outputStatus = useMemo(() => {
    if (isLoading) return "Summoning the archive...";
    if (status === "success" && story) return "Statement generated.";
    return "Awaiting your prompt.";
  }, [isLoading, status, story]);

  return (
    <div className="page page--content">
      <header className="content-hero">
        <nav className="hero__nav">
          <span className="brand">The Magnus Archives</span>
          <div className="hero__nav-actions">
            <AppLink className="ghost-button" to="/">
              Back to landing
            </AppLink>
            <span className="ghost-button ghost-button--muted">
              Content generation
            </span>
          </div>
        </nav>
        <div className="content-hero__copy">
          <p className="eyebrow">Content generation</p>
          <h1>Generate a new statement.</h1>
          <p className="hero__lead">
            Supply a seed idea and the model will craft a full statement. Keep
            it grounded, specific, and quietly unsettling for the best results.
          </p>
        </div>
      </header>

      <main className="content-grid">
        <section className="content-card">
          <div className="content-card__header">
            <h2>Story prompt</h2>
            <p className="section__lead">
              Share a hook, location, or artifact. We will handle the rest.
            </p>
          </div>
          <form className="content-form" onSubmit={handleSubmit}>
            <label className="content-form__label" htmlFor="story-idea">
              Your idea
            </label>
            <textarea
              id="story-idea"
              name="story-idea"
              rows={6}
              placeholder={DEFAULT_IDEA}
              value={idea}
              onChange={event => setIdea(event.target.value)}
            />
            <div className="content-form__actions">
              <button className="primary-button" type="submit" disabled={isLoading}>
                {isLoading ? "Generating..." : "Generate story"}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setIdea("")}
                disabled={isLoading || !idea}
              >
                Clear
              </button>
            </div>
          </form>
          {error ? <p className="content-form__error">{error}</p> : null}
          <p className="content-form__status">{outputStatus}</p>
        </section>

        <section className="content-card content-card--result">
          <div className="content-card__header">
            <h2>Generated statement</h2>
            <p className="section__lead">
              Review the output, then download it as a PDF for your archive.
            </p>
          </div>
          <div className="content-result">
            {story ? (
              <p>{story}</p>
            ) : (
              <p className="content-result__placeholder">
                Your generated story will appear here once you submit a prompt.
              </p>
            )}
          </div>
          <div className="content-form__actions">
            <button
              className="primary-button"
              type="button"
              onClick={handleDownload}
              disabled={!story}
            >
              Download PDF
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => setStory("")}
              disabled={!story}
            >
              Clear output
            </button>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>
          Generated stories are fan-made fiction and do not represent official
          canon.
        </p>
        <p className="footer__disclaimer">
          Powered by the Magnus API and Cloudflare AI.
        </p>
      </footer>
    </div>
  );
}

export default ContentGeneration;
