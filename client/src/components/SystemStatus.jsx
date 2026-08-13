import { useState } from 'react';
import { formatDate } from '../utils/timeUtils';

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

export default function SystemStatus({ status, refreshing, onRefresh }) {
  const [open, setOpen] = useState(true);
  if (!status) return null;

  const sourcesLabel = `${status.sources.healthy}/${status.sources.total} connected`;

  return (
    <section className="status-panel glass-panel">
      <div className="status-panel-header">
        <div>
          <p className="eyebrow">System status</p>
          <h3>Pipeline health and delivery.</h3>
        </div>

        <div className="status-panel-actions">
          <button type="button" className="btn-secondary" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh feeds'}
          </button>
          <button type="button" className="btn-icon" onClick={() => setOpen(open => !open)} aria-expanded={open}>
            {open ? 'Hide' : 'Details'}
          </button>
        </div>
      </div>

      {open && (
        <div className="status-grid">
          <StatusItem label="RSS sources" value={sourcesLabel} dotClass={status.sources.healthy === status.sources.total ? 'green' : 'amber'} />
          <StatusItem label="Gemini AI" value={status.geminiConfigured ? 'Connected' : 'Not configured'} dotClass={status.geminiConfigured ? 'green' : 'grey'} />
          <StatusItem label="SMTP" value={status.smtpConfigured ? 'Configured' : 'Not configured'} dotClass={status.smtpConfigured ? 'green' : 'grey'} />
          <StatusItem label="Articles processed" value={status.articles} dotClass="green" />
          <StatusItem label="Events detected" value={status.events} dotClass="green" />
          <StatusItem label="Last digest" value={status.lastDigest ? formatDate(status.lastDigest) : 'No digest yet'} dotClass={status.lastDigest ? 'green' : 'grey'} />
        </div>
      )}
    </section>
  );
}
