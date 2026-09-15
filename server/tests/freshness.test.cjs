const test = require('node:test');
const assert = require('node:assert/strict');
const { selectTopEvents, loadTopEvents, ingestionStatus } = require('../services/topEventsService');
const { enrichEvent } = require('../services/sourceIntelligence');
const { matchScore } = require('../services/deduplicationService');
const NOW = Date.parse('2026-09-15T00:30:00Z'), HOUR = 3600000;
const at = hours => new Date(NOW - hours * HOUR).toISOString();
const event = (id, hours, importanceScore = 80, extra = {}) => enrichEvent({
    id, title: 'OpenAI development ' + id, importanceScore, confidenceLabel: 'High',
    updatedAt: at(0), discoveredAt: at(0), ...extra,
}, [{ sourceName: 'OpenAI Blog', title: 'OpenAI development', publishedAt: at(hours), url: 'https://openai.com/' + id }]);

test('case 1: two-hour score 80 precedes four-day score 98', () => {
    assert.deepEqual(selectTopEvents([event(2,96,98),event(1,2)],NOW).map(e=>e.id),[1,2]);
});
test('case 2: four strong current stories exclude old fallback', () => {
    assert.deepEqual(selectTopEvents([event(9,96,98),...[1,2,3,4].map(i=>event(i,i))],NOW).map(e=>e.id),[1,2,3,4]);
});
test('case 3: fallback windows preserve publication age and do not invent slots', () => {
    const result=selectTopEvents([event(3,96,98),event(2,48),event(1,2)],NOW);
    assert.deepEqual(result.map(e=>e.freshnessBucket),['24h','72h','7d']);
    assert.equal(result[2].publishedAt,at(96));assert.equal(result.length,3);
});
test('case 4: repeated coverage and row updates cannot renew an announcement', () => {
    const old=event(2,96,98);old.sources.push({...old.sources[0],publishedAt:at(1),url:'https://repeat.test'});
    const result=selectTopEvents([old,event(1,2)],NOW);
    assert.equal(result[1].publishedAt,at(96));assert.equal(result[1].latestCoverageAt,at(1));
    assert.equal(result[1].freshnessBucket,'7d');
});
test('case 5: distinct API rollout stays separate and qualifies normally', () => {
    assert.equal(matchScore('OpenAI launches GPT-7','OpenAI launches GPT-7 API rollout'),0);
    assert.equal(selectTopEvents([event(1,96),event(2,1,80,{title:'OpenAI launches GPT-7 API rollout'})],NOW)[0].id,2);
});
test('case 6: stopped ingestion is exposed independently of fallback ranking', () => {
    const status=ingestionStatus([{enabled:true,lastSuccessfulFetch:at(96),pollingInterval:30}],at(96),NOW);
    assert.equal(status.sourceFetchStatus,'stale');
    assert.equal(status.lastSuccessfulSourceFetchAt,at(96));
    assert.equal(selectTopEvents([event(1,96)],NOW)[0].freshnessBucket,'7d');
    assert.equal(ingestionStatus([],null,NOW).sourceFetchStatus,'unknown');
    assert.equal(ingestionStatus([{enabled:false,lastSuccessfulFetch:at(0)}],null,NOW).lastSuccessfulSourceFetchAt,null);
    assert.equal(ingestionStatus([{enabled:true,lastSuccessfulFetch:at(0.5)}],at(1),NOW).sourceFetchStatus,'current');
});
test('case 7: rolling UTC boundaries include exactly 24 hours across midnight', () => {
    const result=selectTopEvents([event(1,1),event(2,24),event(3,24.001),event(4,72)],NOW);
    assert.deepEqual(result.map(e=>e.freshnessBucket),['24h','24h','72h','72h']);
    assert.equal(selectTopEvents([event(1,168.001),event(2,-1)],NOW).length,0);
});
test('newness alone cannot promote low importance, low confidence or weak sources', () => {
    const weak=event(3,1);weak.sources[0].qualityTier='D';
    assert.deepEqual(selectTopEvents([event(1,1,40),event(2,1,80,{confidenceLabel:'Low'}),weak,event(4,2)],NOW).map(e=>e.id),[4]);
    assert.equal(selectTopEvents([{id:8,importanceScore:99,confidenceLabel:'High',publishedAt:at(1),sources:[]}],NOW).length,0);
});
test('ties prefer confidence, authority and independent organizations before age', () => {
    const a=event(1,1,80,{confidenceLabel:'Medium'}),b=event(2,2);
    assert.equal(selectTopEvents([a,b],NOW)[0].id,2);
    a.confidenceLabel='High';a.sources[0].qualityTier='C';
    assert.equal(selectTopEvents([a,b],NOW)[0].id,2);
    a.sources[0].qualityTier='A';b.organizationCount=2;
    assert.equal(selectTopEvents([a,b],NOW)[0].id,2);
});
test('Postgres timestamp parser is UTC across host timezones and scoped to the pool', () => {
    const {execFileSync}=require('node:child_process');
    const adapter=require.resolve('../database/postgresAdapter');
    for(const TZ of ['UTC','Asia/Kolkata','America/Los_Angeles']) {
        const value=execFileSync(process.execPath,['-e',`console.log(require(${JSON.stringify(adapter)}).utcTypes.getTypeParser(1114,'text')('2026-09-15 00:30:00').toISOString())`],{env:{...process.env,TZ},encoding:'utf8'}).trim();
        assert.equal(value,'2026-09-15T00:30:00.000Z');
    }
    const {utcTypes}=require('../database/postgresAdapter');
    assert.equal(utcTypes.getTypeParser(23,'text')('42'),42);
});
test('database-wide candidates are ranked before limit, with two queries; Latest remains publication-based', async () => {
    const Database=require('better-sqlite3'),fs=require('node:fs'),path=require('node:path');
    const db=new Database(':memory:');
    try {
        db.exec(fs.readFileSync(path.join(__dirname,'../database/schema.sql'),'utf8'));
        const source=db.prepare('INSERT INTO sources(sourceName,feedUrl,sourceType) VALUES(?,?,?)').run('OpenAI Blog','https://feed.test','primary').lastInsertRowid;
        const add=(hours,score)=> {
            const id=db.prepare('INSERT INTO events(title,importanceScore,confidenceLabel,updatedAt) VALUES(?,?,?,?)').run('OpenAI event',score,'High',at(0)).lastInsertRowid;
            db.prepare('INSERT INTO articles(eventId,sourceId,title,url,fingerprint,publishedAt) VALUES(?,?,?,?,?,?)').run(id,source,'OpenAI event','https://test/'+id,String(id),at(hours));
            return id;
        };
        for(let i=0;i<305;i++)add(96,98);
        const fresh=add(2,80);
        let queries=0;
        const counted={prepare(sql){queries++;return db.prepare(sql);}};
        const top=await loadTopEvents(counted,NOW);
        assert.equal(queries,2);assert.equal(top[0].id,fresh);assert.equal(top.length,4);
        const {eventQuery}=require('../services/searchService');
        const q=eventQuery({sort:'latest',limit:4});
        assert.equal(db.prepare(q.query).all(...q.params)[0].id,fresh);
    } finally {db.close();}
});

test('timestamp precision survives PostgreSQL Date objects and status normalizes SQL UTC', () => {
    const {timestampMs}=require('../services/sourceIntelligence');
    assert.equal(timestampMs(new Date('2026-09-15T00:30:00.123Z')),NOW+123);
    assert.equal(ingestionStatus([], '2026-09-15 00:30:00.123', NOW).latestArticleDiscoveredAt,'2026-09-15T00:30:00.123Z');
});
test('top and status HTTP contracts work without ingestion; protected refresh remains protected', async () => {
    process.env.DATABASE_URL='';process.env.DATABASE_PATH=':memory:';
    process.env.INGEST_SECRET='test-only-secret';
    const db=require('../database/db'),express=require('express');
    const app=express();app.use('/api',require('../routes/api'));
    const server=app.listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    try {
        const base='http://127.0.0.1:'+server.address().port+'/api';
        let res=await fetch(base+'/events/top');assert.equal(res.status,200);assert.deepEqual(await res.json(),[]);
        res=await fetch(base+'/status');assert.equal(res.status,200);
        const status=await res.json();assert.equal(status.ingestion.sourceFetchStatus,'unknown');
        assert.equal(status.ingestion.lastSuccessfulSourceFetchAt,null);
        assert.equal(status.ingestion.latestArticleDiscoveredAt,null);
        assert.ok(!('lastSuccessfulIngestionAt' in status.ingestion));
        res=await fetch(base+'/refresh',{method:'POST'});assert.equal(res.status,401);
    } finally {await new Promise(resolve=>server.close(resolve));db.close();}
});
test('workflow URL preflight rejects malformed configuration without exposing its value', () => {
    const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
    const helper=path.join(__dirname,'../../.github/scripts/ingest.cjs');
    const script='try { require('+JSON.stringify(helper)+').backendOrigin(process.env.BACKEND_URL); } catch(e) { console.error(e.message); process.exit(1); }';
    for(const value of ['',' https://example.test','https://exam\nple.test','https://example.test/api','https://user:secret@example.test','not-a-url']) {
        const result=spawnSync(process.execPath,['-e',script],{env:{...process.env,BACKEND_URL:value},encoding:'utf8'});
        assert.equal(result.status,1);
        assert.match(result.stderr,/BACKEND_URL must contain/);
        if(value)assert.ok(!result.stderr.includes(value));
    }
    for(const value of ['https://example.test','https://example.test/'])assert.equal(spawnSync(process.execPath,['-e',script],{env:{...process.env,BACKEND_URL:value}}).status,0);
});
