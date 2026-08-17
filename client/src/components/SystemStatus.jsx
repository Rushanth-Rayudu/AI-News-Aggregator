import { useEffect, useState } from 'react';
import { formatDate, formatDistanceToNow } from '../utils/timeUtils';
import { fetchSources } from '../utils/api';

function StatusItem({ label, value, dotClass }) {
  return (
    <div className="status-card">
      <span className={`status-dot ${dotClass}`} aria-hidden="true" />
      <div>
        <div className="status-card-label">{label}</div>
        <div className="status-card-value">{value}</div>
      </div>
    </div>
  );
}

function healthOf(source) {
  if (source.lastError) return 'unhealthy';
  if (source.lastSuccessfulFetch) return 'healthy';
  return 'pending';
}

export default function SystemStatus({ status, refreshing, onRefresh }) {
  const [open, setOpen] = useState(true);
  const [sources, setSources] = useState(null);
  const [sourcesError, setSourcesError] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    fetchSources()
      .then(data => {
        if (active) {
          setSources(data);
          setSourcesError(false);
        }
      })
      .catch(() => {
        if (active) setSourcesError(true);
      });
    return () => {
      active = false;
    };
  }, [open]);

  if (!status) return null;

  const sourcesLabel = `${status.sources.healthy}/${status.sources.total} connected`;

  return (
    <section className="status-panel glass-panel">
      <div className="status-panel-header">
        <div>
          <p className="eyebrow">Source health monitor</p>
          <h3>Pipeline and source delivery.</h3>
        </div>

        <div className="status-panel-actions">
          <button type="button" className="btn-secondary" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh feeds'}
          </button>
          <button type="button" className="btn-icon" onClick={() => setOpen(o => !o)} aria-expanded={open}>
            {open ? 'Hide' : 'Details'}
          </button>
        </div>
      </div>

      {open && (
        <>
          <div className="status-grid">
            <StatusItem label="RSS sources" value={sourcesLabel} dotClass={status.sources.healthy === status.sources.total ? 'green' : 'amber'} />
            <StatusItem label="Gemini AI" value={status.geminiConfigured ? 'Connected' : 'Not configured'} dotClass={status.geminiConfigured ? 'green' : 'grey'} />
            <StatusItem label="SMTP" value={status.smtpConfigured ? 'Configured' : 'Not configured'} dotClass={status.smtpConfigured ? 'green' : 'grey'} />
            <StatusItem label="Articles processed" value={status.articles} dotClass="green" />
            <StatusItem label="Events detected" value={status.events} dotClass="green" />
            <StatusItem label="Last digest" value={status.lastDigest ? formatDate(status.lastDigest) : 'No digest yet'} dotClass={status.lastDigest ? 'green' : 'grey'} />
          </div>

          <div className="source-monitor-head">
            <span>Source</span>
            <span>Health</span>
            <span>Last successful fetch</span>
            <span>Latest article</span>
            <span>Credibility</span>
          </div>

          <div className="source-monitor-list" aria-live="polite">
            {sourcesError && (
              <p className="source-monitor-note">Could not load source details right now.</p>
            )}
            {!sources && !sourcesError && (
              <p className="source-monitor-note">Loading source details…</p>
            )}
            {sources && sources.map(source => {
              const health = healthOf(source);
              const dotClass = health === 'healthy' ? 'green' : (health === 'unhealthy' ? 'red' : 'grey');
              return (
                <div className="source-monitor-row" key={source.id}>
                  <div className="source-monitor-name">
                    <span className={`status-dot ${dotClass}`} aria-hidden="true" />
                    <span>
                      <span className="source-monitor-title">{source.sourceName}</span>
                      <span className="source-type-tag">{source.sourceType || '—'}</span>
                    </span>
                  </div>
                  <div className="source-monitor-cell">
                    {health === 'healthy' && 'Healthy'}
                    {health === 'unhealthy' && 'Unhealthy'}
                    {health === 'pending' && '—'}
                  </div>
                  <div className="source-monitor-cell">
                    {source.lastSuccessfulFetch ? formatDistanceToNow(source.lastSuccessfulFetch) : '—'}
                  </div>
                  <div className="source-monitor-cell source-monitor-latest">
                    {source.latestArticle
                      ? `${source.latestArticle.title}${source.latestArticle.publishedAt ? ` · ${formatDistanceToNow(source.latestArticle.publishedAt)}` : ''}`
                      : '—'}
                  </div>
                  <div className="source-monitor-cell">
                    {source.credibilityTier ? `Tier ${source.credibilityTier}` : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

