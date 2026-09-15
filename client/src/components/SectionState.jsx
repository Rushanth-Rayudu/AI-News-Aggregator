export default function SectionState({ number, title, loading, error, empty, onRetry }) {
  return <section className="band" aria-label={title} aria-busy={loading}>
    <header className="band-head"><span className="band-no">{number}</span><div className="band-title"><h2>{title}</h2></div></header>
    <div className="section-state" role={error ? 'alert' : 'status'}>
      <p>{loading ? 'Loading...' : error ? 'Unable to load this section.' : empty}</p>
      {error && <button className="btn" type="button" onClick={onRetry}>Retry</button>}
    </div>
  </section>;
}
