import { formatDistanceToNow } from '../utils/timeUtils';
import { clampPercent } from '../utils/format';

/**
 * "Since your last visit" — an analyst briefing band. Highlights are the
 * strongest developments discovered since the visitor's previous session
 * (localStorage-backed, never reset by the UI).
 */
export default function AnalystBrief({ info, onOpen, onDismiss }) {
  if (!info || !info.count) return null;

  return (
    <section className="brief rise" style={{ '--d': '60ms' }} aria-label="Since your last visit">
      <div className="brief-count">
        <span className="m-label">Since your last visit</span>
        <strong>
          <i>{info.count}</i> new development{info.count !== 1 ? 's' : ''}
        </strong>
      </div>

      {info.events?.length > 0 && (
        <div className="brief-list">
          {info.events.map(evt => (
            <button
              key={evt.id}
              type="button"
              className="brief-item"
              onClick={() => onOpen(evt)}
              title={evt.title}
            >
              <span className="pct" title="Heuristic importance score, out of 100">{clampPercent(evt.importanceScore)}/100</span>
              <span className="t">{evt.title}</span>
              <time>{formatDistanceToNow(evt.discoveredAt)}</time>
            </button>
          ))}
        </div>
      )}

      <button type="button" className="btn-quiet" onClick={onDismiss}>
        Dismiss
      </button>
    </section>
  );
}
