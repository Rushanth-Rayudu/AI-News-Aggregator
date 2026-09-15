const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export async function fetchTopEvents() {
  const res = await fetch(`${BASE}/events/top`);
  if (!res.ok) throw new Error('Failed to fetch top events');
  return res.json();
}

export async function fetchEvents(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}/events${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json();
}

export async function fetchEvent(id) {
  const res = await fetch(`${BASE}/events/${id}`);
  if (!res.ok) throw new Error('Event not found');
  return res.json();
}

export async function fetchEventsSince(since, limit = 50) {
  const params = new URLSearchParams();
  if (since) params.set('since', since);
  params.set('limit', String(limit));
  const res = await fetch(`${BASE}/events/since?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch recent events');
  return res.json();
}

export async function fetchThemes() {
  const res = await fetch(`${BASE}/themes`);
  if (!res.ok) throw new Error('Failed to fetch themes');
  return res.json();
}

export async function fetchSources() {
  const res = await fetch(`${BASE}/sources`);
  if (!res.ok) throw new Error('Failed to fetch sources');
  return res.json();
}

export async function fetchStatus() {
  const res = await fetch(`${BASE}/status`);
  if (!res.ok) throw new Error('Failed to fetch status');
  return res.json();
}

export async function triggerRefresh() {
  const res = await fetch(`${BASE}/refresh`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to trigger refresh');
  return res.json();
}
