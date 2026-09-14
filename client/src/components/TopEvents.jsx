import Reveal from './Reveal';
import { formatDistanceToNow } from '../utils/timeUtils';
import {
  cleanSummary,
  cleanWhy,
  storyStateOf,
} from '../utils/format';

function EventTags({ event, state }) {
  const sources = event.sources || [];
  const hasPrimary = sources.some(s => s && s.isPrimary);
  return (
    <div className="te-tags">
      <span className="tag tag-cat">{event.category || 'AI News'}</span>
      {state && <span className={`tag ${state.tagCls}`}>{state.label}</span>}
      {hasPrimary && <span className="tag tag-official">Official source</span>}
      {event.isNew && <span className="tag tag-new">New</span>}
    </div>
  );
}

/**
 * 01 · Priority wire. One dominant story plus a secondary column of up to
 * three entries. The two halves always form one balanced composition: the
 * stack rows flex to share the height of the primary story, so there is
 * never an empty cell or reserved blank space — regardless of headline or
 * summary length, or how many secondary stories exist.
 */
export default function TopEvents({ events, onSelect }) {
  if (!events || events.length === 0) return null;

  const primary = events[0];
  const side = events.slice(1, 4);
  const primaryState = storyStateOf(primary);
  const primarySources = primary.sources || [];
  const primarySource = primary.primarySource || primarySources[0] || {};

  return (
    <section className="band" aria-label="Top AI events">
      <Reveal>
        <header className="band-head">
          <span className="band-no">01</span>
          <div className="band-title">
            <h2>Top AI events</h2>
            <span className="m-label m-sub">Priority wire · strongest signals first</span>
          </div>
          <div className="band-aside">
            <span className="m-label">{events.length} tracked</span>
          </div>
        </header>
      </Reveal>

      <Reveal delay={80}>
        <div className="te">
          <article
            className="te-main"
            role="button"
            tabIndex={0}
            onClick={() => onSelect(primary)}
            onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(primary); } }}
            aria-label={`Open dossier: ${primary.title}`}
          >
            <EventTags event={primary} state={primaryState} />
            <h3 className="te-title">{primary.title}</h3>
            {cleanSummary(primary.summary) && <p className="te-sum">{cleanSummary(primary.summary)}</p>}
            {cleanWhy(primary.whyItMatters) && (
              <div className="te-why">
                <span className="m-label">Why it matters</span>
                <p>{cleanWhy(primary.whyItMatters)}</p>
              </div>
            )}
            <div className="te-foot">
              <span>{primarySources.length} source{primarySources.length !== 1 ? 's' : ''}</span>
              <span className="sep" aria-hidden="true" />
              <span>{primary.organizationCount ?? new Set(primarySources.map(s => s.organization || s.sourceName)).size} publishing organization(s)</span>
              {primarySource.sourceName && (
                <>
                  <span className="sep" aria-hidden="true" />
                  <span>{primarySource.sourceName}</span>
                </>
              )}
              <span className="te-open" aria-hidden="true">Open dossier →</span>
            </div>
          </article>

          {side.length > 0 && (
            <div className="te-side">
              {side.map((event, i) => {
                const state = storyStateOf(event);
                const sources = event.sources || [];
                return (
                  <article
                    key={event.id}
                    className="te-item"
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(event)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(event); } }}
                    aria-label={`Open dossier: ${event.title}`}
                  >
                    <span className="te-idx">{String(i + 2).padStart(2, '0')}</span>
                    <h3>{event.title}</h3>
                    {cleanSummary(event.summary) && <p>{cleanSummary(event.summary)}</p>}
                    <div className="te-mm">
                      <span>{event.category || 'AI News'}</span>
                      <span>{formatDistanceToNow(event.publishedAt || event.discoveredAt)}</span>
                      <span>{sources.length} src</span>
                      {state && <span className={`tag ${state.tagCls}`}>{state.label}</span>}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </Reveal>
    </section>
  );
}
