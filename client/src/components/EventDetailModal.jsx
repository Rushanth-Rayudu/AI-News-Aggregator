import { useEffect, useRef, useState } from 'react';
import { formatDate, formatDistanceToNow } from '../utils/timeUtils';
import { buildConfidenceEvidence, buildTimeline, deriveStoryState, evidenceLabel, topicMatchesEvent } from '../utils/eventIntelligence';
import { WATCHLIST_TOPICS } from '../utils/storage';
import { cleanWhy, clampPercent } from '../utils/format';
import CredibilityTooltip from './CredibilityTooltip';

function ConfidenceTag({ event }) {
  const label = event.confidenceLabel || 'Medium';
  const evidence = buildConfidenceEvidence(event);
  return (
    <CredibilityTooltip label={label} evidence={evidence}>
      <span className="tag tag-cat" style={{ cursor: 'help' }}>
        {evidenceLabel(event)}
      </span>
    </CredibilityTooltip>
  );
}

/**
 * Event dossier — opens as a focused intelligence brief with a restrained
 * entrance, Escape/overlay dismissal and body scroll lock.
 */
export default function EventDetailModal({ event, onClose, watchlist = [], onToggleTopic }) {
  const [closing, setClosing] = useState(false);
  const closeRef = useRef(null);
  const closeTimer = useRef(null);

  function requestClose() {
    if (closeTimer.current !== null) return;
    setClosing(true);
    closeTimer.current = setTimeout(onClose, 190);
  }

  useEffect(() => {
    const previousFocus=document.activeElement;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = e => {
      if (e.key === 'Escape') requestClose();
      if(e.key==='Tab'){
        const nodes=[...closeRef.current.closest('.modal').querySelectorAll('button,a[href],input,select,[tabindex="0"]')].filter(n=>!n.disabled);
        const first=nodes[0],last=nodes[nodes.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
        if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      clearTimeout(closeTimer.current);
      previousFocus?.focus();
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!event) return null;

  let keyPoints = [];
  try {
    keyPoints = typeof event.keyPoints === 'string'
      ? JSON.parse(event.keyPoints)
      : (event.keyPoints || []);
  } catch {
    // ignore malformed keyPoints
  }
  keyPoints = (Array.isArray(keyPoints) ? keyPoints : []).filter(pt => pt && pt !== 'Read original article for details.');

  const sources = event.sources || [];
  const primarySource = event.primarySource || sources[0];
  const hasPrimarySource = sources.some(s => s && s.isPrimary);
  const storyState = deriveStoryState(event);
  const timelineItems = buildTimeline(event);

  return (
    <div
      className={`modal${closing ? ' closing' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) requestClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={event.title}
    >
      <div className="modal-panel">
        <div className="modal-top" aria-hidden="true" />
        <button ref={closeRef} type="button" className="modal-x" onClick={requestClose} aria-label="Close dossier">✕</button>

        <div className="modal-body">
          <div className="d-tags">
            <span className="tag tag-cat">{event.category || 'AI News'}</span>
            {storyState && (
              <span className={`tag tag-${storyState.toLowerCase()}`}>{storyState}</span>
            )}
            {hasPrimarySource && <span className="tag tag-official">Official source</span>}
          </div>

          <h2 className="d-title">{event.title}</h2>

          <div className="d-meta">
            <ConfidenceTag event={event} />
            <span>IMPORTANCE <b>{clampPercent(event.importanceScore)}/100</b></span>
            <span>SOURCES <b>{sources.length}</b></span>
            <span>DISCOVERED <b>{formatDate(event.discoveredAt) || '—'}</b></span>
            <span>UPDATED <b>{formatDate(event.updatedAt) || '—'}</b></span>
          </div>

          <div className="d-sec">
            <span className="m-label">Summary</span>
            <p className="d-text">{event.summary || 'No summary is available for this event yet.'}</p>
          </div>

          {cleanWhy(event.whyItMatters) && (
            <div className="d-sec">
              <span className="m-label">Why it matters</span>
              <p className="d-text dim">{cleanWhy(event.whyItMatters)}</p>
            </div>
          )}

          {keyPoints.length > 0 && (
            <div className="d-sec">
              <span className="m-label">Key points</span>
              <ul className="d-kp">
                {keyPoints.map((pt, i) => <li key={i}>{pt}</li>)}
              </ul>
            </div>
          )}
          {buildConfidenceEvidence(event).length > 0 && (
            <div className="d-sec">
              <span className="m-label">Source authority & evidence</span>
              <div className="d-ev">
                {buildConfidenceEvidence(event).map((item, i) => (
                  <span key={i}>{item}</span>
                ))}
              </div>
            </div>
          )}

          {timelineItems.length >= 2 && (
            <div className="d-sec">
              <span className="m-label">Event & publication timeline</span>
              <p className="d-text dim">Publication times and recorded event timestamps. Publication does not indicate when coverage was added.</p>
              <div className="d-tl">
                {timelineItems.map((item, i) => (
                  <div className={`d-tl-item k-${item.kind}`} key={`${item.kind}-${item.at}-${i}`}>
                    <span className="tl-label">{item.label}</span>
                    <span className="tl-time">{formatDate(item.at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {onToggleTopic && <section className="d-sec"><h3 className="m-label">Follow this intelligence</h3><div className="following-options">{WATCHLIST_TOPICS.filter(topic => topicMatchesEvent(topic, event)).map(topic => <button key={topic.id} className={`chip${watchlist.includes(topic.id) ? ' on' : ''}`} aria-pressed={watchlist.includes(topic.id)} onClick={() => onToggleTopic(topic.id)}>{watchlist.includes(topic.id) ? 'Following ' : 'Follow '}{topic.label}</button>)}</div></section>}
          {sources.length > 0 && (
            <div className="d-sec">
              <span className="m-label">Primary source & additional coverage · {sources.length} source{sources.length !== 1 ? 's' : ''}</span>
              <div>
                {sources.map((src, i) => (
                  <div className="d-src-row" key={i}>
                    <span className="d-src-name">
                      {src.sourceName}
                      {i===0 && <span className="badge pri">Display source</span>}{src.isPrimary && <span className="badge pri">Official</span>}
                      {src.credibilityTier && <span className="badge">Tier {src.qualityTier || src.credibilityTier}</span>}
                    </span>
                    <span className="d-src-meta">
                      {src.publishedAt && <span>{formatDistanceToNow(src.publishedAt)}</span>}
                      {src.url && (
                        <a className="d-src-link" href={src.url} target="_blank" rel="noopener noreferrer">
                          Read ↗
                        </a>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        <div className="modal-foot">
          <span className="m-label">Intelligence dossier</span>
          {primarySource?.url && (
            <a className="btn btn-acc" href={primarySource.url} target="_blank" rel="noopener noreferrer">
              Read original source ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
