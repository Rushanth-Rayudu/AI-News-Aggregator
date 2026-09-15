import { formatDistanceToNow } from '../utils/timeUtils';

/**
 * Opening view — a live context band, not a marketing hero.
 * Everything shown comes from real status/feed data.
 */
export default function SituationBand({ status, storyCount }) {
  const totalSources = status?.sources?.enabled ?? null;

  const ingestion = status?.ingestion;
  const freshness = ingestion?.sourceFetchStatus;
  const freshnessLabel = freshness === 'current' ? 'Current' : freshness === 'stale' ? 'Overdue' : 'Unknown';
  // A categorical indicator of the backend status, not another age calculation.
  const freshnessPct = freshness === 'current' ? 100 : freshness === 'stale' ? 8 : 0;

  return (
    <section className="sit" aria-label="Live intelligence context">
      <div className="sit-copy">
        <span className="sit-kicker rise" style={{ '--d': '40ms' }}>
          <span className="m-label">Live intelligence brief</span>
        </span>
        <h1 className="rise" style={{ '--d': '110ms' }}>
          The AI world, <em>without the noise.</em>
        </h1>
        <p className="sit-sub rise" style={{ '--d': '190ms' }}>
          Important developments from the sources that matter — clustered, scored and
          reduced to a continuous intelligence record.
        </p>
      </div>

      <div className="sit-read rise" style={{ '--d': '270ms' }}>
        <div className="read-row">
          <span className="rl">Sources monitored</span>
          <b>{totalSources !== null ? `${totalSources} active` : 'Connecting…'}</b>
        </div>
        <div className="read-row">
          <span className="rl">Source freshness</span>
          <b className="acc">{freshnessLabel}</b>
        </div>
        <div className="fresh" role="presentation">
          <i style={{ width: `${freshnessPct}%` }} />
        </div>
        <div className="read-row">
          <span className="rl">Stories in view</span>
          <b>{storyCount}</b>
        </div>
        <div className="read-row">
          <span className="rl">Last source fetch</span>
          <b>{ingestion?.lastSuccessfulSourceFetchAt ? formatDistanceToNow(ingestion.lastSuccessfulSourceFetchAt) : 'Unknown'}</b>
        </div>
      </div>
    </section>
  );
}
