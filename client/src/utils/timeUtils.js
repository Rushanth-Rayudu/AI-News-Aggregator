export function parseTimestamp(dateStr) {
  if (!dateStr) return new Date(NaN);
  const normalized = typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(dateStr)
    ? `${dateStr.replace(' ', 'T')}Z`
    : dateStr;
  return new Date(normalized);
}

export function formatDistanceToNow(dateStr) {
  if (!dateStr) return 'Unknown time';
  const date = parseTimestamp(dateStr);
  if (isNaN(date.getTime())) return 'Unknown time';
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = parseTimestamp(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
