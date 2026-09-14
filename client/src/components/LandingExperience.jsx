import { useEffect, useRef, useState } from 'react';

const INTRO_KEY = 'ai-news-aggregator:intro';
function shouldIntroduce() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  try { return sessionStorage.getItem(INTRO_KEY) !== 'seen'; } catch { return true; }
}

export default function LandingExperience({ children }) {
  const [intro, setIntro] = useState(shouldIntroduce);
  const skipped = useRef(false);
  useEffect(() => {
    try { sessionStorage.setItem(INTRO_KEY, 'seen'); } catch { /* optional storage */ }
    if (!intro) {
      if (skipped.current) document.querySelector('.hero-h1')?.focus({ preventScroll: true });
      return undefined;
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finish = () => setIntro(false);
    const change = () => { if (media.matches) finish(); };
    const timer = setTimeout(finish, 2100);
    media.addEventListener('change', change);
    return () => { clearTimeout(timer); media.removeEventListener('change', change); };
  }, [intro]);
  useEffect(() => {
    if (intro || !window.IntersectionObserver) return undefined;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.target.classList.toggle('motion-idle', !entry.isIntersecting));
    }, { rootMargin: '100px' });
    document.querySelectorAll('.landing .hero, .landing .sec, .landing .outro').forEach(n => observer.observe(n));
    return () => observer.disconnect();
  }, [intro]);
  if (!intro) return children;
  return (
    <section className="landing-intro" aria-label="AI News Aggregator introduction">
      <div className="intro-composition">
        <svg className="intro-traces" viewBox="0 0 600 200" aria-hidden="true">
          <path d="M0 40 H150 L200 100 H400 L450 40 H600 M0 160 H150 L200 100 M400 100 L450 160 H600" />
          <circle className="intro-packet" cx="0" cy="100" r="3" />
        </svg>
        <span className="intro-mark" aria-hidden="true">AI</span>
        <p className="intro-name">AI News Aggregator</p>
        <p className="intro-meta">Sources / Context / One record</p>
        <span className="intro-track" aria-hidden="true"><i /></span>
        <p className="intro-caption">A clearer view of AI news.</p>
      </div>
      <button className="intro-skip" onClick={() => { skipped.current = true; setIntro(false); }}>Skip intro <span aria-hidden="true">→</span></button>
    </section>
  );
}

export function BackToTop() {
  const ref = useRef(null);
  useEffect(() => {
    const button = ref.current;
    const hero = document.querySelector('.hero');
    if (!hero || !button || !window.IntersectionObserver) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      button.hidden = entry.isIntersecting || entry.boundingClientRect.bottom > 0;
    });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);
  return <button ref={ref} hidden className="back-top" aria-label="Back to top" onClick={() => {
    document.querySelector('.hero-h1')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }}><span aria-hidden="true">↑</span><span>Top</span></button>;
}
