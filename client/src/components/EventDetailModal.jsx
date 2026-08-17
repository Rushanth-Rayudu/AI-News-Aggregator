import { formatDate, formatDistanceToNow } from '../utils/timeUtils';
import { buildConfidenceEvidence, buildTimeline, deriveStoryState } from '../utils/eventIntelligence';

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
        {source.credibilityTier ? <span className="tier-badge">Tier {source.credibilityTier}</span> : null}
      </div>
      <div className="source-item-meta">
        {source.publishedAt && (
          <span className="source-item-time">{formatDistanceToNow(source.publishedAt)}</span>
        )}
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
    </div>
  );
}

function Timeline({ items }) {
  if (!items || items.length < 2) return null;

  return (
    <div className="modal-section">
      <div className="modal-section-title">Timeline</div>
      <div className="modal-timeline">
        {items.map((item, i) => (
          <div className="modal-timeline-item" key={`${item.kind}-${item.at}-${i}`}>
            <span className={`timeline-dot ${item.kind}`} aria-hidden="true" />
            <div className="timeline-content">
              <span className="timeline-label">{item.label}</span>
              <span className="timeline-time">{formatDate(item.at)}</span>
            </div>
          </div>
        ))}
      </div>
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
  } catch {
    // ignore malformed keyPoints
  }

  const sources = event.sources || [];
  const primarySource = sources.find(s => s.isPrimary) || sources[0];
  const hasPrimarySource = sources.some(s => s && s.isPrimary);
  const storyState = deriveStoryState(event);
  const confidenceEvidence = buildConfidenceEvidence(event);
  const timelineItems = buildTimeline(event);

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
            {storyState && (
              <span className={`story-state-badge ${storyState.toLowerCase()}`}>{storyState}</span>
            )}
            {hasPrimarySource && (
              <span className="official-source-badge">Official Source</span>
            )}
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

          {confidenceEvidence.length > 0 && (
            <div className="modal-section">
              <div className="modal-section-title">Confidence & source evidence</div>
              <div className="modal-evidence">
                {confidenceEvidence.map((item, i) => (
                  <div className="modal-evidence-item" key={i}>{item}</div>
                ))}
              </div>
            </div>
          )}

          <Timeline items={timelineItems} />

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
