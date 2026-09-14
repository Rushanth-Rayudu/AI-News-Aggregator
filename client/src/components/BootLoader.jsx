import { useEffect, useState } from 'react';

const STEPS = [
  'CONNECTING SOURCES',
  'SYNCHRONIZING EVENTS',
  'BUILDING INTELLIGENCE LAYER',
  'SIGNAL LOCKED',
];

/**
 * Signal-acquisition boot sequence. Steps advance on a short timer; the whole
 * overlay fades as soon as `done` arrives (first data load) — never later than
 * the hard cap held by the Dashboard.
 */
export default function BootLoader({ done }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (progress >= STEPS.length) return undefined;
    const id = setTimeout(() => setProgress(p => p + 1), 280);
    return () => clearTimeout(id);
  }, [progress]);

  const visible = done ? STEPS.length : progress;

  return (
    <div className={`boot${done ? ' done' : ''}`} aria-hidden="true">
      <div className="boot-inner">
        <div className="boot-brand"><i />AI News Aggregator</div>
        <div className="boot-sub">SIGNAL ACQUISITION</div>
        <div className="boot-steps">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`boot-step${i < visible ? ' done' : i === visible ? ' act' : ''}`}
            >
              <span className="tick">{i < visible ? '▪' : i === visible ? '▸' : '·'}</span>
              {label}
            </div>
          ))}
        </div>
        <div className="boot-track"><i /></div>
        <div className="boot-meta"><span>AI-IDB / 01</span><span>LIVE SIGNAL</span></div>
      </div>
    </div>
  );
}
