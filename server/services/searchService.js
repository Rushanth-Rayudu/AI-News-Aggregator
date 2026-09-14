const FOLLOWING = Object.fromEntries(require('../../shared/interests.json').map(t => [t.id, t.keywords]));
const registry = require('../feeds/registry.json');
// Parameterized, database-wide filtering before pagination. No Gemini calls.
function eventQuery(input={}) {
 const conditions=[],params=[],rankParams=[];let ranking='';
 const eventTime = "REPLACE(CAST(COALESCE((SELECT MIN(publishedAt) FROM articles chronology WHERE chronology.eventId=e.id),e.discoveredAt) AS TEXT),'T',' ')";
 const text = "LOWER(COALESCE(e.title,'') || ' ' || COALESCE(e.summary,'') || ' ' || COALESCE(e.whyItMatters,'') || ' ' || COALESCE(e.category,'') || ' ' || COALESCE(e.keyPoints,''))";
 const pattern = value => '%'+value.toLowerCase().replace(/[\\%_]/g,'\\$&')+'%';
 const match = field => `${field} LIKE ? ESCAPE '\\'`;
 const sourceText = "LOWER(COALESCE(s.sourceName,'') || ' ' || COALESCE(a.title,''))";
 const wordField = field => "' ' || " + ['.', ',', ':', ';', '!', '(', ')', '-', '/'].reduce((sql, c) => "REPLACE(" + sql + ", '" + c + "', ' ')", field) + " || ' '";
 const sourceMatch = `EXISTS (SELECT 1 FROM articles a JOIN sources s ON s.id=a.sourceId WHERE a.eventId=e.id AND ${match(sourceText)})`;
 if(input.category&&input.category!=='All'){conditions.push('e.category=?');params.push(input.category);}
 const hours={'6h':6,'24h':24,'7d':168}[input.timeframe];
 if(hours){conditions.push(`${eventTime} >= ?`);params.push(new Date(Date.now()-hours*3600000).toISOString().replace('T',' ').replace('Z',''));}
 if(input.source){
   const names = registry.filter(s => s.organization === input.source || s.sourceName === input.source).map(s => s.sourceName);
   if (!names.length) names.push(String(input.source).slice(0,150));
   conditions.push(`EXISTS (SELECT 1 FROM articles a JOIN sources s ON s.id=a.sourceId WHERE a.eventId=e.id AND s.sourceName IN (${names.map(() => '?').join(',')}))`);params.push(...names);
 }
 if(input.onlyHighConfidence==='true'){conditions.push("LOWER(e.confidenceLabel)='high'");}
 if(input.onlyImportant==='true'){conditions.push('e.importanceScore>=70');}
 if(input.following!==undefined){
   const terms=[...new Set(String(input.following).split(',').flatMap(id=>FOLLOWING[id]||[]))];
   conditions.push(terms.length?'('+terms.map(()=>`(${match(wordField(text))} OR EXISTS (SELECT 1 FROM articles a JOIN sources s ON s.id=a.sourceId WHERE a.eventId=e.id AND ${match(wordField(sourceText))}))`).join(' OR ')+')':'1=0');
   params.push(...terms.flatMap(term => ['% ' + term.replace(/-/g, ' ') + ' %','% ' + term.replace(/-/g, ' ') + ' %']));
 }
 const q=String(input.q||'').trim().slice(0,200);
 if(q){
   for(const term of q.split(/\s+/).slice(0,8)){conditions.push(`(${match(text)} OR ${sourceMatch})`);params.push(pattern(term),pattern(term));}
   ranking=`CASE WHEN LOWER(e.title)=? THEN 100 WHEN ${match('LOWER(e.title)')} THEN 80 WHEN ${match('LOWER(e.category)')} THEN 60 WHEN ${match(text)} THEN 40 ELSE 10 END DESC, `;
   rankParams.push(q.toLowerCase(),pattern(q),pattern(q),pattern(q));
 }
 const order=input.sort==='latest'?`${eventTime} DESC, e.importanceScore DESC`:`e.importanceScore DESC, ${eventTime} DESC`;
 return {query:`SELECT e.* FROM events e${conditions.length?' WHERE '+conditions.join(' AND '):''} ORDER BY ${ranking}${order}, e.id DESC LIMIT ? OFFSET ?`,params:[...params,...rankParams,input.limit||50,input.offset||0]};
}
module.exports={eventQuery,FOLLOWING};
