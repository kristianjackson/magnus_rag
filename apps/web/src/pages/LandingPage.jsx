import { AppLink } from "../router";

function LandingPage() {
  return (
    <div className="page">
      <header className="hero">
        <nav className="hero__nav">
          <span className="brand">Lumenary</span>
          <div className="hero__nav-actions">
            <AppLink className="ghost-button" to="/check-in">
              Start a reflection
            </AppLink>
            <a className="ghost-button ghost-button--muted" href="#signup">
              Join the waitlist
            </a>
          </div>
        </nav>
        <div className="hero__content">
          <div>
            <p className="eyebrow">Journal intelligence</p>
            <h1>Turn daily journaling into supportive, structured feedback.</h1>
            <p className="hero__lead">
              Lumenary is a calm space to write your thoughts, receive LLM-powered
              insights, and track growth over time. Everything starts with a
              private entry and ends with clear, actionable reflections.
            </p>
            <div className="hero__actions">
              <AppLink className="primary-button" to="/check-in">
                Explore the flow
              </AppLink>
              <a className="secondary-button" href="#features">
                See the framework
              </a>
              <a className="text-link" href="#preview">
                View a sample
              </a>
            </div>
          </div>
          <div className="hero__panel">
            <p className="hero__panel-title">Designed for thoughtful journaling</p>
            <ul className="hero__panel-list">
              <li>Guided prompts to clarify what you are feeling</li>
              <li>AI summaries that highlight themes and patterns</li>
              <li>Weekly snapshots that make progress visible</li>
            </ul>
            <p className="hero__panel-note">
              Your journal stays private. You control what is shared and saved.
            </p>
          </div>
        </div>
      </header>

      <main>
        <section className="section" aria-labelledby="features">
          <div className="section__header">
            <p className="eyebrow">How it works</p>
            <h2 id="features">A guided path from reflection to insight.</h2>
            <p className="section__lead">
              The first release focuses on three essentials: mindful capture,
              gentle analysis, and habit-friendly follow ups. Each step is
              designed to make your journaling feel lighter, not heavier.
            </p>
          </div>
          <div className="feature-grid">
            <article className="feature-card">
              <h3>Thoughtful prompts</h3>
              <p>
                Start with questions that bring clarity without forcing a rigid
                template.
              </p>
            </article>
            <article className="feature-card">
              <h3>LLM feedback layers</h3>
              <p>
                Receive summaries, emotional tone highlights, and suggested next
                steps from trusted analysis.
              </p>
            </article>
            <article className="feature-card">
              <h3>Weekly progress view</h3>
              <p>
                See the themes that keep showing up so you can spot momentum or
                friction early.
              </p>
            </article>
          </div>
        </section>

        <section
          className="section section--example"
          id="preview"
          aria-labelledby="preview-title"
        >
          <div className="section__header">
            <p className="eyebrow">Sample feedback</p>
            <h2 id="preview-title">A gentle reflection snapshot</h2>
          </div>
          <figure className="example-card">
            <blockquote>
              “You expressed steady optimism with a moment of tension around
              deadlines. A recurring theme is balancing ambition with rest. Consider
              a short check-in tomorrow on how you want your schedule to feel.”
            </blockquote>
            <figcaption>
              Sample output only. Feedback is personalized and private.
            </figcaption>
          </figure>
        </section>

        <section className="section cta" id="signup" aria-labelledby="cta-title">
          <div>
            <p className="eyebrow">Early access</p>
            <h2 id="cta-title">Get notified when the private beta opens.</h2>
            <p className="section__lead">
              We are shipping the first Lumenary release on Cloudflare. Join the
              waitlist for secure, privacy-first journaling updates.
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
            <button type="button">Join the waitlist</button>
          </form>
          <p className="cta__fineprint">
            We will only email product updates. No spam, ever.
          </p>
        </section>
      </main>

      <footer className="footer">
        <p>
          © 2024 Lumenary. Thoughtful journal feedback built for calm routines.
        </p>
        <p className="footer__disclaimer">
          Always in your control, with export and deletion built in from day one.
        </p>
      </footer>
    </div>
  );
}

export default LandingPage;
