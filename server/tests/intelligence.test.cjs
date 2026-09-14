process.env.DATABASE_URL='';
process.env.DATABASE_PATH=':memory:';
const test=require('node:test');const assert=require('node:assert/strict');
const db=require('../database/db');
const {matchScore}=require('../services/deduplicationService');
const {enrichEvent}=require('../services/sourceIntelligence');
const {eventQuery}=require('../services/searchService');
const {processSource}=require('../services/processingPipeline');
const {canonicalUrl}=require('../services/rssService');
test('canonical URLs remove tracking but preserve meaningful query values',()=>{
 assert.equal(canonicalUrl('https://example.com/story?utm_source=x&id=2#section'),'https://example.com/story?id=2');assert.equal(canonicalUrl('javascript:alert(1)'),'');
});
test('same release matches; API, version, and unrelated developments stay separate',()=>{
 assert.ok(matchScore('Anthropic launches Claude 4','Anthropic unveils Claude 4')>=.6);
 assert.equal(matchScore('Anthropic launches Claude 4','Anthropic launches Claude 4 API'),0);
 assert.equal(matchScore('Anthropic launches Claude 4','Anthropic launches Claude 5'),0);
 assert.equal(matchScore('OpenAI launches GPT-5','OpenAI announces funding round'),0);
});
test('organization counts and appropriate official source selection',()=>{
 const e=enrichEvent({},[{sourceName:'NVIDIA AI Blog',title:'NVIDIA introduces Blackwell',url:'https://a'},{sourceName:'NVIDIA Developer Blog',title:'NVIDIA introduces Blackwell',url:'https://b'},{sourceName:'TechCrunch AI',title:'NVIDIA introduces Blackwell',url:'https://c'}]);
 assert.equal(e.organizationCount,2);assert.equal(e.documentCount,3);assert.equal(e.sources[0].organization,'NVIDIA');
});
test('first-party items remain official when the headline omits the publisher name',()=>{
 const e=enrichEvent({},[{sourceName:'OpenAI Blog',title:'Daybreak for Frontline Defenders',url:'https://openai.com/index/daybreak-for-frontline-defenders'}]);
 assert.equal(e.sources[0].isPrimary,true);
 assert.equal(e.evidenceLabel,'Official source');
});
test('database search finds records beyond first page and escapes SQL wildcards',()=>{
 for(let i=0;i<60;i++)db.prepare('INSERT INTO events(title,summary,category,importanceScore) VALUES(?,?,?,?)').run('Record '+i,'summary','Other',80);
 db.prepare('INSERT INTO events(title,whyItMatters,category,importanceScore) VALUES(?,?,?,?)').run('OpenAI releases GPT-5','agentic workflows','Model Release',50);
 let q=eventQuery({q:'OpenAI',limit:50});assert.equal(db.prepare(q.query).all(...q.params).length,1);
 q=eventQuery({q:'agentic workflows'});assert.equal(db.prepare(q.query).all(...q.params).length,1);
 q=eventQuery({q:'%'});assert.equal(db.prepare(q.query).all(...q.params).length,0);
 q=eventQuery({following:''});assert.equal(db.prepare(q.query).all(...q.params).length,0);
});
test('later official coverage upgrades one event and retains independent report; bad feed isolated',async()=>{
 const sources=[{sourceName:'TechCrunch AI',feedUrl:'https://tc',sourceType:'journalism',credibilityTier:3},{sourceName:'OpenAI Blog',feedUrl:'https://oa',sourceType:'primary',credibilityTier:1}];
 for(const s of sources)s.id=db.prepare('INSERT INTO sources(sourceName,feedUrl,sourceType,credibilityTier) VALUES(?,?,?,?)').run(s.sourceName,s.feedUrl,s.sourceType,s.credibilityTier).lastInsertRowid;
 const analyze=async()=>({isAiRelated:true,summary:{whatHappened:'Launch',whyItMatters:'New capabilities',keyPoints:[]},category:'Model Release',importanceScore:80,confidenceLabel:'High'});
 const item=(n)=>({title:'OpenAI launches GPT-7',description:'OpenAI releases its new model',url:'https://example.com/'+n,publishedAt:new Date(),fingerprint:n,imageUrl:null});
 const before=db.prepare('SELECT COUNT(*) n FROM events').get().n;
 assert.equal((await processSource(sources[0],{db,fetchFeed:async()=>[item('report')],processArticle:analyze})).processed,1);
 assert.equal((await processSource(sources[1],{db,fetchFeed:async()=>[item('official')],processArticle:analyze})).processed,1);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM events').get().n,before+1);
 const rows=db.prepare('SELECT a.*,s.sourceName,s.sourceType,s.credibilityTier FROM articles a JOIN sources s ON s.id=a.sourceId').all();
 const e=enrichEvent({},rows);assert.equal(e.sources[0].sourceName,'OpenAI Blog');assert.equal(e.documentCount,2);
 assert.ok((await processSource(sources[0],{db,fetchFeed:async()=>{throw Error('HTTP 429');}})).error);
});

test('real feed coverage: model launch, Google announcement, NVIDIA duplicate URL and arXiv cross-listing',async()=>{
 const fixtures=require('./real-coverage.json');
 const analyze=async()=>({isAiRelated:true,summary:{whatHappened:'Fixture summary',whyItMatters:'Fixture',keyPoints:[]},category:'Other',importanceScore:70,confidenceLabel:'Medium'});
 for(const reports of fixtures){
  const database=new (require('better-sqlite3'))(':memory:');database.exec(require('fs').readFileSync(require('path').join(__dirname,'../database/schema.sql'),'utf8'));
  // Independent report first exercises upgrading when the official report follows.
  for(const report of [...reports].reverse()){
   const entry=require('../feeds/registry.json').find(s=>s.sourceName===report.source);
   const source={...entry,id:database.prepare('INSERT INTO sources(sourceName,feedUrl,sourceType,credibilityTier) VALUES(?,?,?,?)').run(entry.sourceName,entry.feedUrl,entry.sourceType,entry.credibilityTier).lastInsertRowid};
   const item={...report,description:report.title,imageUrl:null,publishedAt:new Date(report.publishedAt),fingerprint:report.url};
   const result=await processSource(source,{db:database,fetchFeed:async()=>[item],processArticle:analyze});assert.ok(!result.error,result.error);
  }
  assert.equal(database.prepare('SELECT COUNT(*) n FROM events').get().n,1,reports[0].title);
  const articles=database.prepare('SELECT a.*,s.sourceName,s.sourceType,s.credibilityTier FROM articles a JOIN sources s ON s.id=a.sourceId').all();
  assert.equal(articles.length,reports[0].url===reports[1].url?1:2);
  const enriched=enrichEvent({},articles);
  if(reports[0].source==='OpenAI Blog')assert.equal(enriched.primarySource.sourceName,'OpenAI Blog');
  if(reports[0].source.startsWith('Google'))assert.equal(enriched.organizationCount,1);
  database.close();
 }
});
test('real case studies and safety follow-ups do not merge into a model launch',()=>{
 assert.equal(matchScore('Playco cut manual fixes 50% prototyping games with GPT-6 Astra','GPT‑6 Astra'),0);
 assert.equal(matchScore('Safety overview: GPT-6 Astra','GPT-6 Astra: A new generation of intelligence'),0);
});
test('organization filtering includes multiple feeds and Following searches supporting coverage',()=>{
 const source=db.prepare('INSERT INTO sources(sourceName,feedUrl) VALUES(?,?)').run('NVIDIA Developer Blog','https://test-nvidia').lastInsertRowid;
 const event=db.prepare('INSERT INTO events(title,category) VALUES(?,?)').run('New tools for builders','AI Coding').lastInsertRowid;
 db.prepare('INSERT INTO articles(eventId,sourceId,title,url,fingerprint,publishedAt) VALUES(?,?,?,?,?,?)').run(event,source,'NVIDIA agent tooling','https://test-nvidia/story','test-nvidia-story',new Date().toISOString());
 for(const input of [{source:'NVIDIA'},{following:'nvidia'},{q:'agent tooling'}]) { const q=eventQuery(input);assert.ok(db.prepare(q.query).all(...q.params).some(e=>e.id===event)); }
});
test('publication age prevents an old article from entering the recent scope',()=>{
 const event=db.prepare('INSERT INTO events(title,category) VALUES(?,?)').run('Old archived story','Other').lastInsertRowid;
 db.prepare('INSERT INTO articles(eventId,title,url,fingerprint,publishedAt) VALUES(?,?,?,?,?)').run(event,'Old archived story','https://old-example','old-example','2020-01-01T00:00:00Z');
 const q=eventQuery({timeframe:'24h'});assert.ok(!db.prepare(q.query).all(...q.params).some(e=>e.id===event));
});

test('Following respects word boundaries and accepts the full interest catalog',()=>{
 const id=db.prepare('INSERT INTO events(title,summary) VALUES(?,?)').run('Metabolic science and metadata','A neutral research record').lastInsertRowid;
 const q=eventQuery({following:'meta'});assert.ok(!db.prepare(q.query).all(...q.params).some(e=>e.id===id));
 const all=eventQuery({following:Object.keys(require('../services/searchService').FOLLOWING).join(',')});
 assert.doesNotThrow(()=>db.prepare(all.query).all(...all.params));
});
