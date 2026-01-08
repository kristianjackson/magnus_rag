import { AppLink } from "../router";

function LandingPage() {
  return (
    <div className="page">
      <header className="hero">
        <nav className="hero__nav">
          <span className="brand">TraceMap</span>
          <div className="hero__nav-actions">
            <AppLink className="ghost-button" to="/check-in">
              Start a check-in
            </AppLink>
            <a className="ghost-button ghost-button--muted" href="#signup">
              Join the waitlist
            </a>
          </div>
        </nav>
        <div className="hero__content">
          <div>
            <p className="eyebrow">Personal tracking workspace</p>
            <h1>Track ASPD-related traits with structure and clarity.</h1>
            <p className="hero__lead">
              TraceMap is a private place to log check-ins, capture context, and
              spot patterns over time. The experience is judgment-free, data
              focused, and designed to keep your reflections organized.
            </p>
            <div className="hero__actions">
              <AppLink className="primary-button" to="/check-in">
                Start today
              </AppLink>
              <a className="secondary-button" href="#features">
                See the MVP
              </a>
              <a className="text-link" href="#preview">
                View a sample
              </a>
            </div>
          </div>
          <div className="hero__panel">
            <p className="hero__panel-title">What you can capture</p>
            <ul className="hero__panel-list">
              <li>Daily intensity ratings and triggers</li>
              <li>Context tags that make patterns visible</li>
              <li>Notes for follow-up, reflection, or therapy</li>
            </ul>
            <p className="hero__panel-note">
              This tool is for personal insight and does not replace clinical
              care or diagnosis.
            </p>
          </div>
        </div>
      </header>

      <main>
        <section className="section" aria-labelledby="features">
          <div className="section__header">
            <p className="eyebrow">What it does</p>
            <h2 id="features">A practical toolkit for trait tracking.</h2>
            <p className="section__lead">
              Build a consistent record without overthinking it. The MVP focuses
              on structured check-ins, contextual tags, and calm visual summaries
              that help you see change over time.
            </p>
          </div>
          <div className="feature-grid">
            <article className="feature-card">
              <h3>Structured check-ins</h3>
              <p>
                Log intensity, impulse, and social friction levels in a repeatable
                format so comparisons are easy later.
              </p>
            </article>
            <article className="feature-card">
              <h3>Context tags</h3>
              <p>
                Label situations like stress, conflict, or overstimulation to
                reveal the patterns behind your data.
              </p>
            </article>
            <article className="feature-card">
              <h3>Reflection prompts</h3>
              <p>
                Short, optional prompts keep the focus on actionable insights
                instead of rumination.
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
            <p className="eyebrow">Sample check-in</p>
            <h2 id="preview-title">Evening reflection snapshot</h2>
          </div>
          <figure className="example-card">
            <blockquote>
              “Impulse: 6/10. Trigger: unexpected change at work. Response:
              withdrew from conversation, noted elevated irritation. Next time,
              try a quick pause before responding.”
            </blockquote>
            <figcaption>
              Sample data only. No entries are shared or published.
            </figcaption>
          </figure>
        </section>

        <section className="section cta" id="signup" aria-labelledby="cta-title">
          <div>
            <p className="eyebrow">Early access</p>
            <h2 id="cta-title">Be first to try the tracking workspace.</h2>
            <p className="section__lead">
              We are launching a privacy-first MVP on Cloudflare. Leave your
              email to get notified when the first version goes live.
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
            This tool is for personal tracking and does not replace professional
            care.
          </p>
        </section>
      </main>

      <footer className="footer">
        <p>
          © 2024 TraceMap. Private tracking for personal insight.
        </p>
        <p className="footer__disclaimer">
          Your data stays in your control. Export and delete options will be
          available in the MVP.
        </p>
      </footer>
    </div>
  );
}

export default LandingPage;
