import { formatDistanceToNow, parseTimestamp } from '../utils/timeUtils';

/**
 * Opening view — a live context band, not a marketing hero.
 * Everything shown comes from real status/feed data.
 */
export default function SituationBand({ status, storyCount, lastUpdated }) {
  const totalSources = status?.sources?.enabled ?? null;

  let freshnessPct = 8;
  if (lastUpdated) {
    const ageHours = (Date.now() - parseTimestamp(lastUpdated).getTime()) / 3600000;
    if (Number.isFinite(ageHours)) {
      freshnessPct = Math.max(4, Math.min(100, Math.round(100 - (ageHours / 24) * 100)));
    }
  }

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
          <span className="rl">Signal freshness</span>
          <b className="acc">{lastUpdated ? formatDistanceToNow(lastUpdated) : 'Checking…'}</b>
        </div>
        <div className="fresh" role="presentation">
          <i style={{ width: `${freshnessPct}%` }} />
        </div>
        <div className="read-row">
          <span className="rl">Stories in view</span>
          <b>{storyCount}</b>
        </div>
        <div className="read-row">
          <span className="rl">Analysis engine</span>
          <b>{status ? (status.geminiConfigured ? 'Configured' : 'Not configured') : '…'}</b>
        </div>
      </div>
    </section>
  );
}
