import { useState } from 'react';
import { formatDistanceToNow } from '../utils/timeUtils';
import { buildConfidenceEvidence, deriveStoryState } from '../utils/eventIntelligence';
import CredibilityTooltip from './CredibilityTooltip';

const CATEGORY_CLASS_MAP = {
  'Model Release': 'model',
  'AI Research': 'research',
  'Open Source AI': 'open-source',
  'AI Safety': 'safety',
  'AI Security': 'safety',
  'AI Regulation / Policy': 'policy',
  'AI Chips / Hardware': 'hardware',
};

function getCategoryClass(category) {
  return CATEGORY_CLASS_MAP[category] || 'default';
}

function ConfidenceLabel({ label }) {
  const cls = { High: 'conf-high', Medium: 'conf-medium', Low: 'conf-low' }[label] || 'conf-medium';
  return <span className={`confidence-pill ${cls}`}>{label || 'Medium'}</span>;
}

export default function EventCard({ event, onClick, index = 0 }) {
  const [pointer, setPointer] = useState({ x: '50%', y: '50%' });
  const sources = event.sources || [];
  const primarySource = sources.find(s => s.isPrimary) || sources[0] || {};
  const importancePct = Math.round(Math.min(100, event.importanceScore || 0));
  const timeAgo = formatDistanceToNow(event.updatedAt || event.discoveredAt);
  const storyState = deriveStoryState(event);
  const confidenceEvidence = buildConfidenceEvidence(event);
  const hasPrimarySource = sources.some(s => s && s.isPrimary);

  function handlePointerMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPointer({ x: `${x}%`, y: `${y}%` });
  }

  return (
    <article
      className={`event-card glass-panel${event.isNew ? ' is-new' : ''}`}
      style={{ '--pointer-x': pointer.x, '--pointer-y': pointer.y, '--index': index }}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setPointer({ x: '50%', y: '50%' })}
      onClick={() => onClick(event)}
      onKeyDown={e => e.key === 'Enter' && onClick(event)}
      role="button"
      tabIndex={0}
      aria-label={event.title}
    >
      <div className="card-top-row">
        <span className={`card-chip ${getCategoryClass(event.category)}`}>{event.category || 'AI News'}</span>
        {storyState && (
          <span className={`story-state-badge ${storyState.toLowerCase()}`}>{storyState}</span>
        )}
        {hasPrimarySource && (
          <span className="official-source-badge" title="A primary/official source reported this">
            Official Source
          </span>
        )}
        {event.isNew && <span className="new-badge">New</span>}
        <span className="card-chip time-tag">{timeAgo}</span>
      </div>

      <div className="story-trust-row">
        <CredibilityTooltip label={event.confidenceLabel} evidence={confidenceEvidence}>
          <ConfidenceLabel label={event.confidenceLabel} />
        </CredibilityTooltip>
        <span className="card-trust-meta">{importancePct}% importance</span>
        <span className="card-trust-meta">{sources.length} sources</span>
      </div>

      <h3 className="card-title">{event.title}</h3>

      {event.summary && <p className="card-summary">{event.summary}</p>}

      {event.whyItMatters && (
        <div className="card-matters">
          <span>Why it matters</span>
          <p>{event.whyItMatters}</p>
        </div>
      )}

      <div className="source-strip">
        <span className="source-strip-label">Primary source</span>
        <span className="source-strip-name">{primarySource.sourceName || 'Source tracking'}</span>
      </div>

      <div className="card-bottom-row">
        <div className="card-stats">
          <span className="source-count">{sources.length} source{sources.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="card-actions">
          <a
            href={primarySource.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="source-link"
            onClick={e => e.stopPropagation()}
          >
            Original source ↗
          </a>
        </div>
      </div>
    </article>
  );
}

