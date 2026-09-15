export const CATEGORIES = ['All', 'Model Release', 'AI Research', 'Open Source AI', 'AI Agents', 'Generative AI', 'Robotics', 'Computer Vision', 'Multimodal AI', 'AI Coding', 'AI Infrastructure', 'AI Chips / Hardware', 'AI Safety', 'AI Security', 'AI Regulation / Policy', 'AI Companies', 'AI Startups', 'AI Products', 'AI Applications', 'Scientific AI', 'Healthcare AI', 'Education AI', 'Business / Enterprise AI', 'Other'];
export const DEFAULT_FILTERS = { category:'All', timeframe:'7d', search:'', sort:'latest', source:'', onlyHighConfidence:false, onlyImportant:false, forYou:false };
const KEYS = ['time','category','q','source','sort'];
const bounded = (value, size) => typeof value === 'string' ? [...value].filter(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127).join('').slice(0,size) : '';

export function normalizeFilters(value = {}) {
  return { ...DEFAULT_FILTERS,
    category:CATEGORIES.includes(value.category) ? value.category : 'All',
    timeframe:[null,'','6h','24h','7d'].includes(value.timeframe) ? (value.timeframe || null) : '7d',
    search:bounded(value.search,200), source:bounded(value.source,120),
    sort:value.sort === 'importance' ? 'importance' : 'latest', forYou:value.forYou === true
  };
}
export function readFilters(search, base = DEFAULT_FILTERS) {
  const params = new URLSearchParams(search);
  if (!KEYS.some(key => params.has(key))) return normalizeFilters(base);
  return normalizeFilters({ ...DEFAULT_FILTERS, forYou:base.forYou,
    timeframe:params.get('time') === 'all' ? null : params.get('time') || '7d',
    category:params.get('category') || 'All', search:params.get('q') || '',
    source:params.get('source') || '', sort:params.get('sort') || 'latest'
  });
}
export function filtersUrl(filters, href) {
  const url = new URL(href);
  const values = { time:filters.timeframe || 'all', sort:filters.sort,
    category:filters.category === 'All' ? '' : filters.category, q:filters.search, source:filters.source };
  for (const key of KEYS) { if (values[key]) url.searchParams.set(key,values[key]); else url.searchParams.delete(key); }
  return url.pathname + url.search + url.hash;
}
export function eventIdFrom(search) {
  const raw = new URLSearchParams(search).get('event');
  if (raw === null) return null;
  return /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw)) ? raw : '';
}
