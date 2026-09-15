import { useEffect, useRef, useState } from 'react';
import { navigate, ROUTES } from '../utils/router';
import { fetchStatus, fetchSources } from '../utils/api';
import Reveal from '../components/Reveal';
import LandingExperience, { BackToTop } from '../components/LandingExperience';
import { TrackingIndex, FeedComparison, SourceSnapshot, EventTransformation } from '../components/LandingModules';
import { SOURCE_GROUPS, STATIC_SOURCE_COUNT } from '../data/sources';
import '../styles/landing.css';

const THEME_OPTIONS = [
  { value: 'sys', label: 'Terminal' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const SECTIONS = [
  { id: 'system', no: '01', label: 'System' },
  { id: 'pipeline', no: '02', label: 'Pipeline' },
  { id: 'sources', no: '03', label: 'Sources' },
  { id: 'intelligence', no: '04', label: 'Intelligence' },
  { id: 'mission', no: '05', label: 'Mission' },
];

/* Counts a REAL number up once its element is revealed. Never used for
   invented metrics — when the API value is missing, nothing resolves. */
function ResolvedNumber({ value }) {
  const ref = useRef(null);
  const target = Number(value);

  useEffect(() => {
    const node = ref.current;
    if (!node || !Number.isFinite(target)) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver === 'undefined') {
      node.textContent = String(target);
      return undefined;
    }
    let raf = 0;
    const io = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      io.disconnect();
      const t0 = performance.now();
      const dur = 700;
      function tick(now) {
        const t = Math.min(1, (now - t0) / dur);
        node.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
        if (t < 1) raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(node);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [target]);

  return <span ref={ref}>—</span>;
}

/* ------------------------------------------------------------------ */
/* NAV                                                                  */
/* ------------------------------------------------------------------ */

function LandingNav({ theme, onThemeChange, status }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('');
  const progressRef = useRef(null);

  useEffect(() => {
    let raf = 0;

    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const doc = document.documentElement;
        const max = doc.scrollHeight - window.innerHeight;
        if (progressRef.current) progressRef.current.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')';
      });
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => {
    const nodes = SECTIONS.map(s => document.getElementById(s.id)?.closest('section')).filter(Boolean);
    if (nodes.length === 0 || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) setActive(entry.target.id.replace(/-sec$/, '')); });
    }, { rootMargin: '-38% 0px -55% 0px' });
    nodes.forEach(n => io.observe(n));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function go(id) {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }

  const total = Number(status?.sources?.total);

  return (
    <header className="lnav">
      <span className="lnav-line" ref={progressRef} aria-hidden="true" />
      <div className="lnav-in">
        <span className="brand" role="img" aria-label="AI News Aggregator">
          <span className="brand-mark" aria-hidden="true">AI</span>
          <span className="brand-copy">
            <span className="brand-name">AI News Aggregator</span>
            <span className="brand-sub">Intelligence system</span>
          </span>
        </span>

        <nav className="lnav-links" aria-label="Landing navigation">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              type="button"
              className={`lnav-link${active === s.id ? ' on' : ''}`}
              onClick={() => go(s.id)}
            >
              <span className="lnav-no" aria-hidden="true">{s.no}</span> {s.label}
            </button>
          ))}
        </nav>

        <div className="nav-side">
          {Number.isFinite(total) && (
            <span className="live">
              <span className="dot dot-live" aria-hidden="true" />
              <span className="live-word"><b>{total}</b> registered sources</span>
            </span>
          )}
          <fieldset className="theme-seg" aria-label="Display theme">
            <legend className="sr-only">Display theme</legend>
            {THEME_OPTIONS.map(option => (
              <label key={option.value} className={theme === option.value ? 'on' : ''}>
                <input
                  type="radio"
                  name="ltheme"
                  value={option.value}
                  checked={theme === option.value}
                  onChange={e => onThemeChange(e.target.value)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            className="btn btn-acc"
            data-cursor="cta"
            onClick={() => navigate(ROUTES.NEWS)}
          >
            Enter the news aggregator
          </button>
          <button
            type="button"
            className="menu-btn"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="landing-mobile-nav"
            onClick={() => setOpen(o => !o)}
          >
            <span className="bars" aria-hidden="true"><i /><i /><i /></span>
            <span className="menu-word">{open ? 'Close' : 'Menu'}</span>
          </button>
        </div>
      </div>

      {open && (
        <nav id="landing-mobile-nav" className="mobile-nav open" aria-label="Mobile landing navigation">
          {SECTIONS.map(s => (
            <button key={s.id} type="button" className="nav-link" onClick={() => go(s.id)}>
              <span>{s.no} · {s.label}</span>
              <span aria-hidden="true">→</span>
            </button>
          ))}
          <button type="button" className="nav-link acc" onClick={() => navigate(ROUTES.NEWS)}>
            <span>Enter the news aggregator</span>
            <span aria-hidden="true">→</span>
          </button>
        </nav>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* HERO                                                                 */
/* ------------------------------------------------------------------ */

function Hero({ status }) {
  const healthy = Number(status?.sources?.healthy);
  const total = Number(status?.sources?.total);
  const analysis = Boolean(status?.geminiConfigured);

  return (
    <section className="hero" id="top" aria-label="Introduction">
      <div className="hero-field" aria-hidden="true">
        <svg className="hero-grid" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="hgrid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="var(--line)" strokeWidth="1" />
            </pattern>
            <linearGradient id="trace" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
              <stop offset="0.5" stopColor="var(--accent)" stopOpacity="0.9" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="1200" height="700" fill="url(#hgrid)" opacity="0.5" />
          <path className="hf-trace t1" d="M-20 560 C 260 540, 300 320, 560 330 S 980 250, 1220 210" fill="none" stroke="url(#trace)" strokeWidth="1.4" />
          <path className="hf-trace t2" d="M-20 620 C 320 640, 420 480, 660 470 S 1020 430, 1220 380" fill="none" stroke="url(#trace)" strokeWidth="1" opacity="0.6" />
          <path className="hf-trace t3" d="M-20 200 C 240 190, 480 260, 720 240 S 1040 160, 1220 130" fill="none" stroke="url(#trace)" strokeWidth="1" opacity="0.4" />
          <g className="hf-nodes">
            <circle cx="560" cy="330" r="3" fill="var(--accent)" />
            <circle cx="660" cy="470" r="2.4" fill="var(--accent)" />
            <circle cx="720" cy="240" r="2.4" fill="var(--accent)" />
            <circle cx="300" cy="548" r="2" fill="var(--accent)" />
            <circle cx="940" cy="228" r="2" fill="var(--accent)" />
          </g>
          <g className="hf-coords" fill="var(--ink-3)">
            <text x="18" y="676">SIGNAL FIELD 04 · CONTINUOUS</text>
            <text x="1006" y="30">MONITORING · 24/7</text>
          </g>
        </svg>
        <span className="hero-scan" aria-hidden="true" />
        <span className="hero-tracer hta" aria-hidden="true" />
        <span className="hero-tracer htb" aria-hidden="true" />
      </div>

      <div className="hero-in">
        <Reveal as="div" className="hero-kicker">
          <span className="m-label"><span className="product-name">AI News Aggregator</span> / Live feed</span>
          <span className="hero-chip">
            <span className="dot dot-live" aria-hidden="true" />
            {Number.isFinite(healthy) && Number.isFinite(total)
              ? <>{healthy}/{total} sources healthy · analysis {analysis ? 'configured' : 'not configured'}</>
              : 'Continuous monitoring'}
          </span>
        </Reveal>

        <h1 className="hero-h1" tabIndex={-1}>
          <Reveal as="span" className="hl" delay={80}><span>The AI world,</span></Reveal>
          <Reveal as="span" className="hl hl-acc" delay={220}><span><em>without the noise.</em></span></Reveal>
        </h1>

        <Reveal as="p" className="hero-sub" delay={420}>
          Important developments from the sources that matter — clustered, scored,
          and reduced to a continuous intelligence record.
        </Reveal>

        <Reveal className="hero-cta" delay={560}>
          <button type="button" className="btn-cta" data-cursor="cta" onClick={() => navigate(ROUTES.NEWS)}>
            <span className="btn-cta-label">Explore the feed</span>
            <span className="btn-cta-line" aria-hidden="true" />
            <span className="btn-cta-arr" aria-hidden="true">→</span>
          </button>
          <button
            type="button"
            className="lnav-link hero-alt"
            onClick={() => document.getElementById('pipeline')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}
          >
            How it works ↓
          </button>
        </Reveal>

        <Reveal className="hero-ticks" delay={700}>
          <span>Clustered</span><i /><span>Scored</span><i /><span>Summarized</span><i /><span>Continuous</span>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* SECTION FURNITURE                                                    */
/* ------------------------------------------------------------------ */

function SectionHead({ no, id, title, sub, children }) {
  return (
    <div className="sec-head">
      <Reveal as="div" className="sec-kicker">
        <span className="sec-no">{no}</span>
        <span className="sec-rule" aria-hidden="true" />
        <span className="m-label">{sub}</span>
      </Reveal>
      <Reveal as="h2" className="sec-title" delay={120}>{title}</Reveal>
      {children && <Reveal delay={240}>{children}</Reveal>}
      <span id={id} className="sec-anchor" aria-hidden="true" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 01 · THE PROBLEM                                                     */
/* ------------------------------------------------------------------ */

function ProblemSection() {
  const streams = [
    ['Research papers', 'preprints and long-form studies land daily'],
    ['Model announcements', 'capability releases from every major lab'],
    ['Company updates', 'funding, products, positioning, pivots'],
    ['Open-source releases', 'weights, frameworks, tooling, benchmarks'],
    ['Infrastructure moves', 'chips, clusters, capacity, platforms'],
    ['Safety & policy', 'evaluations, incidents, regulation'],
  ];

  return (
    <section className="sec" id="system-sec" aria-label="The problem">
      <SectionHead
        no="01"
        id="system"
        sub="The problem"
        title={<>The ecosystem moves faster<br />than any reading list.</>}
      >
        <p className="sec-lead">
          The AI ecosystem generates enormous amounts of material, every day.
          Following it directly means monitoring dozens of feeds and accepting
          that the important developments will be buried under the volume.
        </p>
      </SectionHead>

      <div className="prob-grid">
        <Reveal className="prob-streams" delay={120}>
          <ul>
            {streams.map(([name, note], i) => (
              <li key={name} style={{ '--i': i }}>
                <span className="prob-name">{name}</span>
                <span className="prob-note">{note}</span>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal className="prob-thesis" delay={260}>
          <p>
            AI News Aggregator is not an attempt to collect more links. Its purpose
            is the opposite — to <em>reduce noise</em> and surface the
            developments that actually matter, continuously.
          </p>
          <span className="m-label prob-tag">Design principle · reduction over accumulation</span>
        </Reveal>
      </div>
      <FeedComparison />
      <TrackingIndex />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · THE PIPELINE                                                    */
/* ------------------------------------------------------------------ */

const PIPELINE = [
  { name: 'Sources', meta: 'registry', desc: 'A curated registry of lab, research, publication, open-source and infrastructure feeds.' },
  { name: 'Ingest', meta: 'RSS · scheduled', desc: 'Enabled feeds are polled according to the cadence recorded in the registry.' },
  { name: 'Normalize', meta: 'parse · fingerprint', desc: 'Entries are parsed, cleaned and fingerprinted; non-AI material is discarded.' },
  { name: 'Deduplicate', meta: 'fingerprint · url', desc: 'Already-seen articles are recognized by fingerprint and URL, then skipped.' },
  { name: 'Cluster', meta: 'event matching', desc: 'Related coverage is matched to a single event instead of remaining scattered stories.' },
  { name: 'Score', meta: 'importance · credibility', desc: 'Significance is evaluated; source evidence provides context for heuristic confidence.' },
  { name: 'Summarize', meta: 'AI analysis', desc: 'AI summarization produces what happened, why it matters and the key points.' },
  { name: 'Intelligence record', meta: 'output', desc: 'One structured record per development — ready for the live dashboard.' },
];

function PipelineSection() {
  return (
    <section className="sec" id="pipeline-sec" aria-label="The pipeline">
      <SectionHead
        no="02"
        id="pipeline"
        sub="The pipeline"
        title={<>Raw information<br />becomes structured intelligence.</>}
      >
        <p className="sec-lead">
          A conceptual view of collection and analysis, rather than a strict execution trace. The stages below
          describe what the system actually does — nothing more.
        </p>
      </SectionHead>

      <Reveal className="pipe" delay={100}>
        <div className="pipe-rail" aria-hidden="true">
          <span className="pipe-rail-line" />
          <span className="pipe-rail-signal" />
        </div>
        <ol className="pipe-stages">
          {PIPELINE.map((stage, i) => (
            <li className="pipe-stage" tabIndex={0} key={stage.name} style={{ '--i': i }}>
              <span className="pipe-dot" aria-hidden="true" />
              <div className="pipe-body">
                <div className="pipe-top">
                  <span className="pipe-idx">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{stage.name}</h3>
                  <span className="pipe-meta">{stage.meta}</span>
                </div>
                <p>{stage.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · THE SOURCES                                                     */
/* ------------------------------------------------------------------ */

function SourceNode({ source, index }) {
  const tierLabel = source.tier ? `Tier ${source.tier}` : null;
  const typeLabel = source.type === 'primary' ? 'Primary' : source.type === 'research' ? 'Research' : 'Journalism';
  return (
    <li className="src-node" data-cursor="inspect" tabIndex={0} style={{ '--i': index }}>
      <span className="src-name">{source.name}</span>
      <span className="src-detail">
        {source.category ? source.category + " / " : ""}{typeLabel}{tierLabel ? ` · ${tierLabel}` : ''}
        {source.health ? ` · ${source.health}` : ''}
        {!source.enabled && ' · paused in registry'}
      </span>
    </li>
  );
}

function SourcesSection({ sources, sourceCount, status }) {
  return (
    <section className="sec" id="sources-sec" aria-label="The sources">
      <SectionHead
        no="03"
        id="sources"
        sub="The sources"
        title={<>The information comes<br />from labs and independent reporting.</>}
      >
        <p className="sec-lead">
          {Number.isFinite(sourceCount)
            ? <>The source registry contains <ResolvedNumber value={sourceCount} /> feeds from their publishers; availability is shown below.</>
            : <>The system monitors its registry of primary feeds, straight from their publishers.</>}
          {' '}Source classifications and availability stay visible; focus a node to highlight it.
        </p>
      </SectionHead>

      <SourceSnapshot status={status} />
      <div className="src-net">
        <Reveal className="src-bus" delay={80}>
          <span className="src-bus-label">Intelligence layer</span>
          <span className="src-bus-line" aria-hidden="true" />
        </Reveal>

        <div className="src-groups">
          {SOURCE_GROUPS.map((group, gi) => (
            <Reveal className="src-group" key={group.label} delay={140 + gi * 110}>
              <span className="src-drop" aria-hidden="true" />
              <header className="src-ghead">
                <h3>{group.label}</h3>
                <span className="m-label">{group.note} · {group.sources.length}</span>
              </header>
              <ul>
                {group.sources.map((source, i) => (
                  <SourceNode key={source.name} index={i} source={{ ...source, health: sources?.get(source.name) }} />
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 04 · FROM NOISE TO INTELLIGENCE                                      */
/* ------------------------------------------------------------------ */

function NoiseToIntelligence() {
  return (
    <section className="sec" id="intelligence-sec" aria-label="From noise to intelligence">
      <SectionHead no="04" id="intelligence" sub="The output" title={<>Many perspectives.<br />One readable event.</>} />
      <Reveal className="transformation-reveal"><EventTransformation /></Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 05 · THE INTELLIGENCE LAYER + MISSION                                */
/* ------------------------------------------------------------------ */

const CONCEPTS = [
  ['Clustering', 'Related coverage becomes one event, not five headlines.'],
  ['Deduplication', 'Repeated reporting is recognized and reduced.'],
  ['Importance', 'Developments are ranked by significance, not recency alone.'],
  ['Credibility', 'Source evidence and tier shape the confidence signal.'],
  ['Summarization', 'Long reporting becomes concise, structured intelligence.'],
  ['Continuous monitoring', 'The record keeps updating as new information arrives.'],
];

function MissionSection() {
  return (
    <section className="sec" id="mission-sec" aria-label="Intelligence layer and mission">
      <SectionHead
        no="05"
        id="mission"
        sub="The intelligence layer"
        title={<>Context, kept together.</>}
      />

      <Reveal className="layer-list" delay={100}>
        <ol>
          {CONCEPTS.map(([name, note], i) => (
            <li key={name} style={{ '--i': i }}>
              <span className="layer-idx">{String(i + 1).padStart(2, '0')}</span>
              <h3>{name}</h3>
              <p>{note}</p>
            </li>
          ))}
        </ol>
      </Reveal>

      <div className="mission">
        <Reveal as="p" className="mission-line" delay={80}>
          AI News Aggregator exists to make the rapidly changing AI ecosystem
          understandable — <em>without asking anyone to monitor dozens of
          blogs, labs, research feeds and publications by hand.</em>
        </Reveal>
        <Reveal as="p" className="mission-sub" delay={220}>
          The system continuously collects relevant developments and reduces
          them into a structured intelligence record. You read the record,
          not the firehose.
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* FINAL CTA + FOOTER                                                   */
/* ------------------------------------------------------------------ */

function FinalCta() {
  function enter() { navigate(ROUTES.NEWS); }

  return (
    <section className="outro" id="enter" aria-label="Enter the dashboard">
      <span className="outro-line" aria-hidden="true" />
      <Reveal as="p" className="m-label outro-k" delay={60}>Ready to enter the live feed?</Reveal>
      <Reveal as="h2" className="outro-h" delay={160}>
        Read the development.<br />Keep the context.
      </Reveal>
      <Reveal delay={320}>
        <button type="button" className="btn-cta outro-cta" data-cursor="cta" onClick={enter}>
          <span className="btn-cta-label">Enter the live feed</span>
          <span className="btn-cta-line" aria-hidden="true" />
          <span className="btn-cta-arr" aria-hidden="true">→</span>
        </button>
      </Reveal>

    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="lfoot">
      <div className="lfoot-in">
        <span className="product-name">AI News Aggregator</span>
        <span className="m-label">The AI world, without the noise</span>
        <span className="grow" aria-hidden="true" />
        <span>V.RUSHANTH RAYUDU</span>
        <a href="https://github.com/Rushanth-Rayudu" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* PAGE                                                                 */
/* ------------------------------------------------------------------ */

export default function Landing({ theme, onThemeChange }) {
  const [status, setStatus] = useState(null);
  const [healthByName, setHealthByName] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchStatus().then(data => { if (alive) setStatus(data); }).catch(() => {});
    fetchSources().then(list => {
      if (!alive || !Array.isArray(list)) return;
      const map = new Map();
      list.forEach(s => {
        const health = s.health || (s.lastError ? 'degraded' : 'pending');
        map.set(s.sourceName, health);
      });
      setHealthByName(map);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const apiTotal = Number(status?.sources?.total);
  const sourceCount = Number.isFinite(apiTotal) && apiTotal > 0 ? apiTotal : STATIC_SOURCE_COUNT;

  return (
    <LandingExperience><div className="landing" data-cursor-page="true">
      <LandingNav theme={theme} onThemeChange={onThemeChange} status={status} />
      <main>
        <Hero status={status} />
        <ProblemSection />
        <PipelineSection />
        <SourcesSection sources={healthByName} sourceCount={sourceCount} status={status} />
        <NoiseToIntelligence />
        <MissionSection />
        <FinalCta />
      </main>
      <LandingFooter />
      <BackToTop />
    </div></LandingExperience>
  );
}
