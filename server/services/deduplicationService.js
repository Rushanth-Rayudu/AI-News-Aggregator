const STOP_WORDS = new Set('the and for with that this from about have has had will would could should been were was are is be into over after than more most some such only other then them these they what which when where its new latest ai model models'.split(' '));
function tokens(text) {
 return new Set(String(text||'').toLowerCase().replace(/[‐‑–—]/g,'-').replace(/([a-z])[-](\d)/g,'$1$2').replace(/[^a-z0-9.\s]/g,' ').split(/\s+/).map(w=> /^(launches?|launched|releases?|released|unveils?|unveiled|introduces?|introduced|announcing|announces?|arrives?)$/.test(w)?'release':w).filter(w=>(w.length>1||/\d/.test(w))&&!STOP_WORDS.has(w)));
}
function calculateTitleSimilarity(a,b){const x=tokens(a),y=tokens(b);const intersection=[...x].filter(w=>y.has(w)).length;return intersection/(x.size+y.size-intersection)||0;}
function matchScore(a,b){
 const x=tokens(a),y=tokens(b);
 const versions=s=>[...s].filter(w=>/\d/.test(w));
 const av=versions(x),bv=versions(y);
 if(av.length&&bv.length&&!av.some(v=>bv.includes(v)))return 0;
 // API availability, pricing, acquisitions and safety incidents are separate developments.
 for(const facet of ['api','pricing','price','acquisition','lawsuit','outage','vulnerability','partnership','safety','rollout','apologizes','benchmark']) if(x.has(facet)!==y.has(facet))return 0;
 const shared=[...x].filter(w=>y.has(w));
 const similarity=calculateTitleSimilarity(a,b);
 if(shared.length<2)return 0;
 if(similarity>=0.60)return similarity;
 const sharedVersion=av.some(v=>bv.includes(v));
 // A distinctive version plus model name can survive an abbreviated launch headline.
 if(sharedVersion && av.length===bv.length && shared.length>=2 && Math.max(x.size,y.size)<=7 && (x.has('release')||y.has('release')||x.has('generation')||y.has('generation')) && shared.length/Math.min(x.size,y.size)>=0.9 && /gpt|claude|gemini|llama|weathernext/i.test(a+' '+b)) return Math.max(similarity,0.7);
 if(sharedVersion&&shared.length>=3&&x.has('release')&&y.has('release'))return Math.max(similarity,0.65);
 return 0;
}
async function findMatchingEvent(title,description,db,publishedAt=new Date()) {
 const at=new Date(publishedAt);if(!Number.isFinite(at.getTime()))return null;
 const start=new Date(at.getTime()-3*86400000).toISOString();
 const end=new Date(at.getTime()+3*86400000).toISOString();
 const candidates=await db.prepare('SELECT DISTINCT e.* FROM events e JOIN articles a ON a.eventId=e.id WHERE a.publishedAt >= ? AND a.publishedAt <= ?').all(start,end);
 const ranked=candidates.map(event=>({event,score:matchScore(title,event.title)})).filter(r=>r.score>=0.6).sort((a,b)=>b.score-a.score||a.event.id-b.event.id);
 // Ambiguous matches stay separate rather than silently merging distinct records.
 if(ranked.length>1&&ranked[0].score-ranked[1].score<0.08)return null;
 return ranked[0]?.event||null;
}
module.exports={findMatchingEvent,calculateTitleSimilarity,matchScore};
