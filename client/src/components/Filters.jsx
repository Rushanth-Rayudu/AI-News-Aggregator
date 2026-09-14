import { useEffect, useRef } from 'react';
import { WATCHLIST_TOPICS } from '../utils/storage';

const CATEGORIES = ['All', 'Model Release', 'AI Research', 'Open Source AI', 'AI Agents', 'Generative AI', 'Robotics', 'Computer Vision', 'Multimodal AI', 'AI Coding', 'AI Infrastructure', 'AI Chips / Hardware', 'AI Safety', 'AI Security', 'AI Regulation / Policy', 'AI Companies', 'AI Startups', 'AI Products', 'AI Applications', 'Scientific AI', 'Healthcare AI', 'Education AI', 'Business / Enterprise AI', 'Other'];

export default function Filters({ sources = [], filters, onChange, onReset, watchlist, onManageFollowing }) {
  const searchRef = useRef(null);
  useEffect(() => {
    function onKey(e) {
      if (e.key === '/' && !document.querySelector('[aria-modal="true"]') && !document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')) { e.preventDefault(); searchRef.current?.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const organizations = [...new Set(sources.map(s => s.organization || s.sourceName))].sort();
  const mode = filters.forYou ? 'following' : filters.sort;
  const chips = [
    ...(filters.search ? [{ key: 'search', label: `“${filters.search}”`, value: '' }] : []),
    ...(filters.category !== 'All' ? [{ key: 'category', label: filters.category, value: 'All' }] : []),
    ...(filters.source ? [{ key: 'source', label: filters.source, value: '' }] : []),
  ];
  return <section className="cmd" aria-label="Feed controls">
    <div className="cmd-row">
      <div className="cmd-search"><span aria-hidden="true">⌕</span><input ref={searchRef} type="search" list="intelligence-suggestions" placeholder="Search AI intelligence…" aria-label="Search AI intelligence" value={filters.search} onChange={e => onChange({ ...filters, search: e.target.value })} /><span className="key" aria-hidden="true">/</span></div>
      <datalist id="intelligence-suggestions">{[...new Set([...WATCHLIST_TOPICS.map(t => t.label), ...organizations, ...CATEGORIES.slice(1)])].map(label => <option key={label} value={label} />)}</datalist>
      <div className="seg" role="group" aria-label="Intelligence view">
        {[['latest', 'Latest'], ['importance', 'Important'], ['following', 'Following']].map(([id, label]) => <button key={id} className={mode === id ? 'on' : ''} aria-pressed={mode === id} onClick={() => onChange({ ...filters, sort: id === 'importance' ? 'importance' : 'latest', forYou: id === 'following', onlyHighConfidence: false, onlyImportant: false })}>{label}</button>)}
      </div>
      <button className="btn-quiet" type="button" onClick={onManageFollowing}>Manage Following ({watchlist.length})</button>
    </div>
    <div className="cmd-row sub">
      <label className="discovery-select">Time<select aria-label="Time" value={filters.timeframe || ''} onChange={e => onChange({ ...filters, timeframe: e.target.value || null })}><option value="6h">Last 6 hours</option><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option><option value="">All time</option></select></label>
      <label className="discovery-select">Topic<select aria-label="Topic" value={filters.category} onChange={e => onChange({ ...filters, category: e.target.value })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
      <label className="discovery-select">Source<select aria-label="Source" value={filters.source || ''} onChange={e => onChange({ ...filters, source: e.target.value })}><option value="">All organizations</option>{organizations.map(org => <option key={org}>{org}</option>)}</select></label>
    </div>
    <div className="cmd-summary"><span className="m-label">{filters.timeframe || 'All time'} · {mode === 'following' ? 'Your followed interests' : mode === 'latest' ? 'Newest first' : 'Highest significance'}</span><div className="tokens">{chips.map(chip => <span className="token" key={chip.key}>{chip.label}<button aria-label={`Remove filter ${chip.label}`} onClick={() => onChange({ ...filters, [chip.key]: chip.value })}>✕</button></span>)}</div><button className="btn-quiet" onClick={onReset}>Clear all</button></div>
  </section>;
}
