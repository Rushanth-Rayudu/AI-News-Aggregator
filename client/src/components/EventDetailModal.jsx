import { formatDate } from '../utils/timeUtils';

function StatChip({ label, value }) {
  return (
    <div className="stat-chip">
      <div className="stat-chip-label">{label}</div>
      <div className="stat-chip-value">{value}</div>
    </div>
  );
}

function SourceItem({ source }) {
  return (
    <div className="source-item">
      <div className="source-name">
        {source.sourceName}
        {source.isPrimary ? <span className="primary-badge">Primary</span> : null}
      </div>
      {source.url && (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="source-link"
          onClick={e => e.stopPropagation()}
        >
          Read ↗
        </a>
      )}
    </div>
  );
}

export default function EventDetailModal({ event, onClose }) {
  if (!event) return null;

  let keyPoints = [];
  try {
    keyPoints = typeof event.keyPoints === 'string'
      ? JSON.parse(event.keyPoints)
      : (event.keyPoints || []);
  } catch (e) {}

  const sources = event.sources || [];
  const primarySource = sources.find(s => s.isPrimary) || sources[0];

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick} role="dialog" aria-modal="true">
      <div className="modal-panel">
        <div className="modal-top-bar" />
        <div className="modal-body">
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>

          <div className="modal-category-row">
            <span className="category-tag">{event.category || 'AI News'}</span>
          </div>

          <h2 className="modal-title">{event.title}</h2>

          <div className="modal-stats-row">
            <StatChip label="Confidence" value={event.confidenceLabel || '—'} />
            <StatChip label="Importance" value={`${event.importanceScore || 0}/100`} />
            <StatChip label="Sources" value={sources.length} />
          </div>

          {event.summary && (
            <div className="modal-section">
              <div className="modal-section-title">Summary</div>
              <p className="modal-text">{event.summary}</p>
            </div>
          )}

          {event.whyItMatters && (
            <div className="modal-section">
              <div className="modal-section-title">Why it matters</div>
              <p className="modal-text">{event.whyItMatters}</p>
            </div>
          )}

          {keyPoints.length > 0 && (
            <div className="modal-section">
              <div className="modal-section-title">Key points</div>
              <div className="modal-key-points">
                {keyPoints.map((pt, i) => (
                  <div className="modal-key-point" key={i}>{pt}</div>
                ))}
              </div>
            </div>
          )}

          {sources.length > 0 && (
            <div className="modal-section">
              <div className="modal-section-title">
                Reported by {sources.length} source{sources.length !== 1 ? 's' : ''}
              </div>
              <div className="modal-sources">
                {sources.map((src, i) => <SourceItem key={i} source={src} />)}
              </div>
            </div>
          )}

          <div className="modal-section" style={{ marginBottom: 0 }}>
            <div className="modal-section-title">Timestamps</div>
            <p className="modal-text" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Discovered: {formatDate(event.discoveredAt)} · Updated: {formatDate(event.updatedAt)}
            </p>
          </div>
        </div>

        {primarySource?.url && (
          <div className="modal-footer">
            <a
              href={primarySource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline"
            >
              ↗ Read original source
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
