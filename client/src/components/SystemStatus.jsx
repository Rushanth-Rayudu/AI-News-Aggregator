import { useState } from 'react';
import { formatDate, formatDistanceToNow } from '../utils/timeUtils';
import Reveal from './Reveal';

function healthOf(source) {
  if (source.health) return source.health;
  if (source.lastError) return 'failed';
  if (source.lastSuccessfulFetch) return 'healthy';
  return 'pending';
}

/**
 * 04 · Source health — an operational monitor. Compact status readout built
 * from the real /api/status payload, plus the live per-source table from
 * /api/sources. No invented operational data.
 */
export default function SystemStatus({ status, statusError, sources, sourcesError, onRetrySources, refreshing, onRefresh }) {
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  if (!status) return (
    <section className="band" aria-label="Source health">
      <h2>Source health</h2>
      <p className="sh-note" role="status">{statusError ? 'Source status is unavailable.' : 'Loading source status...'}</p>
      {statusError && <button className="btn" onClick={onRefresh} disabled={refreshing}>Retry source status</button>}
    </section>
  );

  const healthy = Number(status.sources?.healthy) || 0;
  const total = Number(status.sources?.total) || 0;
  const allHealthy = total > 0 && healthy === Number(status.sources?.enabled);

  return (
    <section className="band" aria-label="Source health">
      <Reveal>
        <header className="band-head">
          <span className="band-no">04</span>
          <div className="band-title">
            <h2>Source health</h2>
            <span className="m-label m-sub">Operational monitor · live source delivery</span>
          </div>
          <div className="band-aside">
            <button type="button" className="btn" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? 'Checking...' : 'Check updates'}
            </button>
            <button
              type="button"
              className="btn-quiet"
              onClick={() => setOpen(o => !o)}
              aria-expanded={open}
            >
              {open ? 'Hide details' : 'Details'}
            </button>
          </div>
        </header>
      </Reveal>

      <Reveal delay={70}>
        <div className="sh-status">
          <span className="sh-item">
            <span className={`dot ${allHealthy ? 'dot-hi' : 'dot-med'}`} aria-hidden="true" />
            Sources <b>{status.sources?.enabled ?? '—'} active · {healthy} healthy · {status.sources?.disabled ?? 0} disabled / {total} total</b>
          </span>
          <span className="sh-item">
            Analysis <b>{status.geminiConfigured ? 'Configured' : 'Not configured'}</b>
          </span>
          <span className={`sh-item${status.smtpConfigured ? '' : ' off'}`}>
            SMTP <b>{status.smtpConfigured ? 'Configured' : 'Not configured'}</b>
          </span>
          <span className="sh-item">Articles <b>{(Number(status.articles) || 0).toLocaleString()}</b></span>
          <span className="sh-item">Events <b>{(Number(status.events) || 0).toLocaleString()}</b></span>
          <span className="sh-item">Last digest <b>{status.lastDigest ? formatDate(status.lastDigest) : 'None'}</b></span>
        </div>

        {open && (
          <div className="sh-table" aria-live="polite">
            <div className="sh-thead" aria-hidden="true">
              <span>Source</span>
              <span>Type</span>
              <span>Health</span>
              <span>Latest article</span>
              <span>Tier</span>
            </div>

            {statusError && <p className="sh-note">Status refresh failed. Showing the last available snapshot.</p>}
            {sources && sources.length === 0 && <p className="sh-note">No source details are available.</p>}
            {sourcesError && <p className="sh-note">Could not load source details right now. <button type="button" className="btn" onClick={onRetrySources}>Retry</button></p>}
            {!sources && !sourcesError && <p className="sh-note">Loading source details…</p>}

            {sources && (() => {
              const rows = sources.map(source => ({
                source,
                health: healthOf(source),
              }));
              // Compact default: every non-healthy source stays visible;
              // healthy rows are truncated to keep the monitor scannable.
              const problemRows = rows.filter(r => r.health !== 'healthy');
              const healthyRows = rows.filter(r => r.health === 'healthy');
              const healthyQuota = Math.max(0, 10 - problemRows.length);
              const visible = showAll || healthyRows.length <= healthyQuota
                ? rows
                : [...problemRows, ...healthyRows.slice(0, healthyQuota)];
              return (
                <>
                  {visible.map(({ source, health }) => {
                    const dotClass = health === 'healthy' ? 'dot-hi' : health === 'failed' ? 'dot-lo' : '';
                    return (
                      <div className="sh-row" key={source.id}>
                        <span className="sh-name">
                          <span className={`dot ${dotClass}`} aria-hidden="true" />
                          <span className="sh-title">{source.sourceName}<small style={{display: "block"}}>{source.organization || source.sourceName}</small></span>
                        </span>
                        <span className="sh-type">{source.sourceType || '—'}</span>
                        <span className="sh-health">
                          <span>{health}</span><small style={{display:'block'}}>{source.healthReason || source.lastError || 'Awaiting fetch'}</small><small style={{display:'block'}}>Last success: {source.lastSuccessfulFetch ? formatDistanceToNow(source.lastSuccessfulFetch) : 'Never'}</small><small style={{display:'block'}}>Last attempt: {source.lastFetch ? formatDistanceToNow(source.lastFetch) : 'Unknown'} · Failures: {source.consecutiveFailures ?? 'Unknown'}{source.httpStatus ? ' · HTTP '+source.httpStatus : ''}</small>
                        </span>
                        <span className="sh-latest" title={source.latestArticle?.title || ''}>
                          {source.latestArticle
                            ? `${source.latestArticle.title}${source.latestArticle.publishedAt ? ` · ${formatDistanceToNow(source.latestArticle.publishedAt)}` : ''}`
                            : '—'}
                        </span>
                        <span className="sh-tier">{source.credibilityTier ? `Tier ${source.qualityTier || source.credibilityTier}` : '—'}</span>
                      </div>
                    );
                  })}
                  {!showAll && visible.length < rows.length && (
                    <button
                      type="button"
                      className="btn-quiet sh-more"
                      onClick={() => setShowAll(true)}
                    >
                      Show all {rows.length} sources
                    </button>
                  )}
                  {showAll && rows.length > 10 && (
                    <button type="button" className="btn-quiet sh-more" onClick={() => setShowAll(false)}>
                      Show compact
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </Reveal>
    </section>
  );
}
