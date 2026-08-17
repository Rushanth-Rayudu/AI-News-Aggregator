const CATEGORIES = [
  'All', 'Model Release', 'AI Research', 'Open Source AI', 'AI Agents',
  'Generative AI', 'Robotics', 'Computer Vision', 'Multimodal AI', 'AI Coding',
  'AI Infrastructure', 'AI Chips / Hardware', 'AI Safety', 'AI Security',
  'AI Regulation / Policy', 'AI Companies', 'AI Startups', 'AI Products',
  'AI Applications', 'Scientific AI', 'Healthcare AI', 'Business / Enterprise AI',
];

const TIMEFRAMES = [
  { label: 'Last 6h', value: '6h' },
  { label: 'Last 24h', value: '24h' },
  { label: 'Last 7d', value: '7d' },
];

export default function Filters({ filters, onChange, watchlistEmpty = false }) {
  const { category, timeframe, sort, search, onlyHighConfidence, onlyImportant, forYou } = filters;

  return (
    <section className="filters-panel glass-panel">
      <div className="filters-top-row">
        <div className="search-field">
          <span className="search-icon">⌕</span>
          <input
            type="text"
            placeholder="Search stories…"
            value={search || ''}
            onChange={e => onChange({ ...filters, search: e.target.value })}
            aria-label="Search stories"
          />
        </div>

        <div className="filter-controls">
          <div className="sort-toggle">
            <button
              type="button"
              className={sort === 'importance' ? 'control-pill active' : 'control-pill'}
              onClick={() => onChange({ ...filters, sort: 'importance' })}
            >
              Top stories
            </button>
            <button
              type="button"
              className={sort === 'latest' ? 'control-pill active' : 'control-pill'}
              onClick={() => onChange({ ...filters, sort: 'latest' })}
            >
              Latest
            </button>
          </div>
          <div className="timeframe-row">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.value}
                type="button"
                className={timeframe === tf.value ? 'control-pill active' : 'control-pill'}
                onClick={() => onChange({ ...filters, timeframe: timeframe === tf.value ? null : tf.value })}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="filter-pills-row">
        <button
          type="button"
          className={forYou ? 'toggle-pill active for-you-pill' : 'toggle-pill for-you-pill'}
          onClick={() => onChange({ ...filters, forYou: !forYou })}
          title="Show stories matching your followed topics"
        >
          For You
        </button>
        <button
          type="button"
          className={onlyHighConfidence ? 'toggle-pill active' : 'toggle-pill'}
          onClick={() => onChange({ ...filters, onlyHighConfidence: !onlyHighConfidence })}
        >
          High confidence only
        </button>
        <button
          type="button"
          className={onlyImportant ? 'toggle-pill active' : 'toggle-pill'}
          onClick={() => onChange({ ...filters, onlyImportant: !onlyImportant })}
        >
          Important only
        </button>
      </div>

      {forYou && watchlistEmpty && (
        <p className="for-you-hint">Follow topics below to personalize your For You feed.</p>
      )}

      <div className="category-row" role="tablist" aria-label="Category filters">
        {CATEGORIES.slice(0, 10).map(cat => (
          <button
            key={cat}
            type="button"
            className={`category-pill${category === cat ? ' active' : ''}`}
            onClick={() => onChange({ ...filters, category: cat })}
          >
            {cat}
          </button>
        ))}
      </div>
    </section>
  );
}
