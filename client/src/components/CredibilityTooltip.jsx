import { useEffect, useRef, useState } from 'react';

/**
 * Small popover that explains WHY a story carries its confidence rating.
 * Uses only real event data (primary-source presence, source count,
 * credibility tiers, confidence score) — never invented reasons.
 */
export default function CredibilityTooltip({ label, evidence, children }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = e => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!evidence || evidence.length === 0) {
    return <>{children}</>;
  }

  return (
    <span className="cred-tooltip-wrap" ref={wrapRef}>
      <button
        type="button"
        className="cred-tooltip-trigger"
        aria-expanded={open}
        aria-label={`Why is this story ${label ? label.toLowerCase() : ''} confidence?`}
        onClick={e => {
          e.stopPropagation();
          setOpen(o => !o);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {children}
      </button>
      {open && (
        <span className="cred-tooltip" role="tooltip">
          <span className="cred-tooltip-title">
            Why {label ? label.toLowerCase() : ''} confidence
          </span>
          <ul className="cred-tooltip-list">
            {evidence.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </span>
      )}
    </span>
  );
}
