import SectionState from './SectionState';
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
export default function TopEvents({ events, onSelect, loading, error, onRetry, ingestion }) {
  const fetchStale = ingestion?.sourceFetchStatus === 'stale';
  if (loading || error || !events?.length) return <SectionState number="01" title="Top AI events" loading={loading} error={error} onRetry={onRetry} empty={fetchStale ? "News collection is overdue. No qualifying priority events are available." : "No priority events available in the current window."} />;

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
            <span className="m-label m-sub">Priority developments · {events.some(event => event.freshnessBucket !== '24h') ? 'Recent coverage' : 'Last 24 hours'}</span>
          </div>
          <div className="band-aside">
            <span className="m-label">{events.length} shown</span>
          </div>
        </header>
      </Reveal>

      {fetchStale && <p className="m-label" role="status">News collection is overdue · coverage may be incomplete.</p>}
      <Reveal delay={80}>
        <div className="te">
          <article
            className="te-main"
          >
            <EventTags event={primary} state={primaryState} />
            <h3 className="te-title"><button type="button" className="te-dossier" onClick={() => onSelect(primary)} aria-label={`Open dossier: ${primary.title}`}>{primary.title}</button></h3>
            {cleanSummary(primary.summary) && <p className="te-sum">{cleanSummary(primary.summary)}</p>}
            {cleanWhy(primary.whyItMatters) && (
              <div className="te-why">
                <span className="m-label">Why it matters</span>
                <p>{cleanWhy(primary.whyItMatters)}</p>
              </div>
            )}
            <div className="te-foot">
              <time dateTime={primary.publishedAt}>{formatDistanceToNow(primary.publishedAt)}</time>
              <span className="sep" aria-hidden="true" />
              <span>{primarySources.length} source{primarySources.length !== 1 ? 's' : ''}</span>
              <span className="sep" aria-hidden="true" />
              <span>{primary.organizationCount ?? new Set(primarySources.map(s => s.organization || s.sourceName)).size} publishing organization(s)</span>
              {primarySource.sourceName && (
                <>
                  <span className="sep" aria-hidden="true" />
                  <span>{primarySource.sourceName}</span>
                </>
              )}
              <button type="button" className="te-dossier te-open" onClick={() => onSelect(primary)}>Open dossier →</button>
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
                  >
                    <span className="te-idx">{String(i + 2).padStart(2, '0')}</span>
                    <h3><button type="button" className="te-dossier" onClick={() => onSelect(event)} aria-label={`Open dossier: ${event.title}`}>{event.title}</button></h3>
                    {cleanSummary(event.summary) && <p>{cleanSummary(event.summary)}</p>}
                    <div className="te-mm">
                      <span>{event.category || 'AI News'}</span>
                      <time dateTime={event.publishedAt}>{formatDistanceToNow(event.publishedAt)}</time>
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
