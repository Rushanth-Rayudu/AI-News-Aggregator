import { useEffect, useRef, useState } from 'react';
import { WATCHLIST_TOPICS } from '../utils/storage';

export default function ManageFollowing({ watchlist, onToggle, onClear, onClose }) {
  const [search, setSearch] = useState('');
  const panel = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current.querySelector('button').focus();
    function onKey(e) {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key !== 'Tab') return;
      const nodes = [...panel.current.querySelectorAll('button:not(:disabled),input')];
      if (e.shiftKey && document.activeElement === nodes[0]) { e.preventDefault(); nodes.at(-1).focus(); }
      if (!e.shiftKey && document.activeElement === nodes.at(-1)) { e.preventDefault(); nodes[0].focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; previous?.focus(); document.removeEventListener('keydown', onKey); };
  }, []);
  const visible = WATCHLIST_TOPICS.filter(t => t.label.toLowerCase().includes(search.toLowerCase()));
  return <div className="modal" role="dialog" aria-modal="true" aria-labelledby="following-title" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal-panel following-panel" ref={panel}>
      <button className="modal-x" type="button" aria-label="Close Manage Following" onClick={onClose}>✕</button>
      <div className="modal-body">
        <h2 id="following-title">Manage Following</h2>
        <p className="d-text dim">Choose interests to see matching intelligence in Following. Saved on this browser.</p>
        <label className="cmd-search">Search interests<input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <div className="cmd-summary"><span>{watchlist.length} followed</span><button className="btn-quiet" disabled={!watchlist.length} onClick={onClear}>Unfollow all</button></div>
        {['Organizations', 'Topics', 'Model families'].map(group => <section className="d-sec" key={group}>
          <h3 className="m-label">{group}</h3>
          <div className="following-options">{visible.filter(t => t.group === group).map(t => <button key={t.id} className={`chip${watchlist.includes(t.id) ? ' on' : ''}`} aria-pressed={watchlist.includes(t.id)} onClick={() => onToggle(t.id)}>{watchlist.includes(t.id) ? '✓ ' : '+ '}{t.label}</button>)}</div>
        </section>)}
        {!visible.length && <p>No matching interests.</p>}
        <button type="button" className="btn btn-acc" onClick={onClose}>Done</button>
      </div>
    </div>
  </div>;
}
