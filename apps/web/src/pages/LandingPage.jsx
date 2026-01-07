import { AppLink } from "../router";

function LandingPage() {
  return (
    <div className="page">
      <header className="hero">
        <nav className="hero__nav">
          <span className="brand">The Magnus Archives</span>
          <div className="hero__nav-actions">
            <AppLink className="ghost-button" to="/generate">
              Content generation
            </AppLink>
            <a className="ghost-button ghost-button--muted" href="#signup">
              Coming Soon
            </a>
          </div>
        </nav>
        <div className="hero__content">
          <div>
            <p className="eyebrow">Fan-made fiction generator</p>
            <h1>Unearth new statements from the Magnus Institute.</h1>
            <p className="hero__lead">
              The Magnus Archives Generator spins original, atmospheric tales
              inspired by the archive. Browse the concept, preview a sample
              entry, and join the list for early access.
            </p>
            <div className="hero__actions">
              <AppLink className="primary-button" to="/generate">
                Generate a story
              </AppLink>
              <a className="secondary-button" href="#signup">
                Join the archive
              </a>
              <a className="text-link" href="#example">
                Read a sample
              </a>
            </div>
          </div>
          <div className="hero__panel">
            <p className="hero__panel-title">Example prompt</p>
            <p className="hero__panel-body">
              “Generate a sealed statement about a coastal lighthouse that never
              appears on maps, written in a calm, investigative tone.”
            </p>
            <p className="hero__panel-note">
              We craft every output from scratch — no scraped or copyrighted
              text.
            </p>
          </div>
        </div>
      </header>

      <main>
        <section className="section" aria-labelledby="features">
          <div className="section__header">
            <p className="eyebrow">What it does</p>
            <h2 id="features">A careful blend of dread and detail.</h2>
            <p className="section__lead">
              Each generation is stitched together with rich sensory cues,
              archival structure, and a slow-burn reveal.
            </p>
          </div>
          <div className="feature-grid">
            <article className="feature-card">
              <h3>Archive-ready structure</h3>
              <p>
                Entries include statements, catalog notes, and subtle metadata
                that feel ready for filing.
              </p>
            </article>
            <article className="feature-card">
              <h3>Atmospheric soundscape</h3>
              <p>
                We emphasize ambience, giving each story a tactile place, time,
                and weather.
              </p>
            </article>
            <article className="feature-card">
              <h3>Prompt-guided lore</h3>
              <p>
                Nudge the narrative with prompts about artifacts, entities, or
                locations — the generator follows your lead.
              </p>
            </article>
          </div>
        </section>

        <section
          className="section section--example"
          id="example"
          aria-labelledby="example-title"
        >
          <div className="section__header">
            <p className="eyebrow">Example output</p>
            <h2 id="example-title">Statement excerpt</h2>
          </div>
          <figure className="example-card">
            <blockquote>
              “The bulb in the lantern room was warm, but it gave off no light.
              I sat there for twenty minutes, listening to the tide hurl itself
              at the stone. When the fog finally lifted, the coastline had moved
              — not by inches, but by miles.”
            </blockquote>
            <figcaption>
              Generated sample — original fiction, not an official statement.
            </figcaption>
          </figure>
        </section>

        <section className="section cta" id="signup" aria-labelledby="cta-title">
          <div>
            <p className="eyebrow">Join the archive</p>
            <h2 id="cta-title">Be first to file a new statement.</h2>
            <p className="section__lead">
              We are preparing a limited early-access run. Leave your email and
              we will notify you when the archive opens.
            </p>
          </div>
          <form className="cta__form">
            <label className="sr-only" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder="you@example.com"
              autoComplete="email"
            />
            <button type="button">Notify me</button>
          </form>
          <p className="cta__fineprint">
            Fan-made project. Not affiliated with Rusty Quill or the original
            podcast creators.
          </p>
        </section>
      </main>

      <footer className="footer">
        <p>
          © 2024 The Magnus Archives Generator. Crafted for fans who crave new
          statements.
        </p>
        <p className="footer__disclaimer">
          This landing page contains original copy only. No official story
          content is used or reproduced.
        </p>
      </footer>
    </div>
  );
}

export default LandingPage;
