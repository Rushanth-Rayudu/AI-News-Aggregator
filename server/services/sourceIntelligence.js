const registry = require('../feeds/registry.json');
const { decodeFeedText } = require('./textNormalization');
function timestampMs(value) {
  if (!value) return NaN;
  const normalized = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value;
  return Date.parse(normalized);
}
function metadata(source) {
  const known = registry.find(s => s.sourceName === source.sourceName || s.feedUrl === source.feedUrl);
  // Community posts on Hugging Face retain the actual publishing namespace.
  if(source.sourceName==='Hugging Face Blog') {
    try { const parts=new URL(source.url).pathname.split('/').filter(Boolean);
      if(parts[0]==='blog' && parts.length>2) return {...source,organization:'Hugging Face community: '+parts[1],qualityTier:'C',sourceType:'research'};
    } catch { /* no article URL in source registry responses */ }
  }
  return { sourceType: known?.sourceType, credibilityTier: known?.credibilityTier, disabledReason: known?.disabledReason, ...source, organization: known?.organization || source.organization || source.sourceName,
    qualityTier: known?.qualityTier || (source.sourceType === 'primary' ? 'A' : source.sourceType === 'journalism' ? 'B' : 'C') };
}
function officialFor(article) {
  const s = metadata(article);
  if (s.sourceType !== 'primary') return false;
  const text = `${article.title || ''} ${article.description || ''}`.toLowerCase();
  const own = registry.filter(r => r.organization === s.organization).flatMap(r => r.aliases || [r.organization]).filter(Boolean);
  const mentionedOther = ['openai','anthropic','nvidia','microsoft','google','meta','apple','amazon'].some(name => !own.some(alias => String(alias).toLowerCase().includes(name)) && new RegExp(`\\b${name}\\b`).test(text));
  return !mentionedOther || own.some(alias => text.includes(String(alias).toLowerCase()));
}
function rankSources(articles, event = {}) {
  const contested = /\b(alleg|lawsuit|sues|sued|investigation|controvers|leak|reportedly)/i.test(event.title || '');
  return articles.map(a => ({ ...metadata(a), isPrimary: officialFor(a) })).sort((a,b) => {
    const rank = s => s.qualityTier === 'A' && !s.isPrimary ? 3 : ({ A:0,B:1,C:2,D:3 }[s.qualityTier] ?? 4);
    return (contested ? Number(b.sourceType === 'journalism') - Number(a.sourceType === 'journalism') : 0) || rank(a)-rank(b) || Number(b.isPrimary)-Number(a.isPrimary) ||
      (a.credibilityTier||4)-(b.credibilityTier||4) ||
      Math.min((b.description||'').length,2000)-Math.min((a.description||'').length,2000) ||
      (timestampMs(a.publishedAt)||0)-(timestampMs(b.publishedAt)||0) || String(a.url).localeCompare(String(b.url));
  });
}
function enrichEvent(event, articles = event.sources || []) {
  const sources = rankSources(articles, event);
  const organizationCount = new Set(sources.map(s=>s.organization).filter(Boolean)).size;
  const times=sources.map(s=>timestampMs(s.publishedAt)).filter(Number.isFinite);
  return {...event, title:decodeFeedText(event.title), summary:decodeFeedText(event.summary), publishedAt:times.length?new Date(Math.min(...times)).toISOString():event.discoveredAt, sources, primarySource: sources[0] || null, documentCount: sources.length, organizationCount,
    evidenceLabel: sources.some(s=>s.isPrimary) ? 'Official source' : organizationCount > 1 ? 'Multiple organizations' : 'Single source'};
}
function healthOf(source, latestArticle, now=Date.now()) {
  if (source.enabled === false || source.enabled === 0) return {health:'disabled',healthReason:metadata(source).disabledReason || 'Disabled: no usable feed verified'};
  if (/No recent dated articles/i.test(source.lastError || '')) return {health:'stale',healthReason:'No dated articles within the 30-day collection window'};
  if(source.lastError) return {health:source.lastSuccessfulFetch?'degraded':'failed', healthReason: /429/.test(source.lastError)?'Rate limited (HTTP 429)':/403/.test(source.lastError)?'Access denied (HTTP 403)':/404/.test(source.lastError)?'Feed not found (HTTP 404)':/timeout|abort/i.test(source.lastError)?'Fetch timed out':'Feed fetch or parsing failed'};
  if(!source.lastSuccessfulFetch) return {health:'degraded',healthReason:'Awaiting first successful fetch'};
  if(now-timestampMs(source.lastSuccessfulFetch)>Math.max(3600000,(source.pollingInterval||30)*180000)) return {health:'stale',healthReason:'Fetch overdue'};
  if(!latestArticle?.publishedAt) return {health:'degraded',healthReason:'No dated articles extracted'};
  if(now-timestampMs(latestArticle.publishedAt)>30*86400000) return {health:'stale',healthReason:'Latest article is over 30 days old'};
  return {health:'healthy',healthReason:'Feed fetched successfully with recent articles'};
}
module.exports={metadata,officialFor,rankSources,enrichEvent,healthOf,timestampMs};
