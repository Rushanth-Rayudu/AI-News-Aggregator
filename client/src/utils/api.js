const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

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
