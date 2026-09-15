const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { backendOrigin, configuration, requestJson, run, IngestionError } = require('../../.github/scripts/ingest.cjs');
const env = { BACKEND_URL:'https://example.test/', INGEST_SECRET:'dummy-test-token' };
const complete = overrides => ({ status:'completed',pipelineCompleted:true,pipelineFailures:0,failedSources:[],sourcesTotal:3,attempted:3,succeeded:3,failed:0,skipped:0,articlesAdded:2,completedAt:'2026-09-15T16:00:00Z',...overrides });
const health = {status:200,json:{sources:{enabled:3}}};

test('URL construction accepts origins and normalizes one trailing slash', () => {
    for(const value of ['https://example.com','https://example.com/'])assert.equal(backendOrigin(value),'https://example.com');
});
test('URL construction rejects missing, path, whitespace, quotes, malformed host and scheme', () => {
    for(const value of ['',undefined,'example.com','http://example.com','https://example.com/api','https://example.com/api/..',
        ' https://example.com','https://example.com\n','https://exam\nple.com','"https://example.com"',"'https://example.com'",
        'https://https://example.com','https://-bad.example','https://.','https://example.com?','https://example.com#',
        'https://user:password@example.com','https://example.com\\api']) {
        assert.throws(()=>backendOrigin(value), /BACKEND_URL must contain/);
    }
});
test('missing authentication fails before any network request', async () => {
    let calls=0;
    for(const secret of ['',undefined,' \n'])await assert.rejects(run({...env,INGEST_SECRET:secret},{request:async()=>{calls++;}}),/INGEST_SECRET is missing/);
    assert.equal(calls,0);assert.throws(()=>configuration({...env,INGEST_SECRET:'dummy\nvalue'}),/newline/);
});
test('cold-start retries are read-only; one authenticated POST validates completion counts', async () => {
    const calls=[],waits=[],logs=[];
    const result=await run(env,{request:async(url,options)=>{
        calls.push({url,options});
        if(calls.length<3)return {status:503,json:null};
        return options.method==='POST'?{status:200,json:{result:complete()}}:health;
    },wait:async ms=>waits.push(ms),log:message=>logs.push(message)});
    assert.deepEqual(waits,[15000,15000]);assert.equal(calls.length,4);
    assert.equal(calls[3].url,'https://example.test/api/internal/ingest');
    assert.equal(calls[3].options.headers['x-ingest-secret'],env.INGEST_SECRET);
    assert.equal(calls[3].options.timeoutMs,1200000);
    assert.ok(calls.slice(0,3).every(c=>!c.options.headers&&!c.options.method));
    assert.equal(result.articlesAdded,2);assert.ok(!logs.join(' ').includes(env.INGEST_SECRET));
});
test('unreachable backend fails after three wake checks without a POST', async () => {
    let calls=0;
    await assert.rejects(run(env,{request:async()=>{calls++;throw new Error('network');},wait:async()=>{},log:()=>{}}),/wake-up failed/);
    assert.equal(calls,3);
});
test('authentication, non-2xx, timeout and network POST failures never retry processing', async () => {
    for(const status of [401,403,404,500,503,302,'timeout','network']) {
        let posts=0;
        await assert.rejects(run(env,{request:async(url,options)=>{
            if(options.method!=='POST')return health;
            posts++;
            if(typeof status==='string')throw new IngestionError('Backend '+status+' failed.');
            return {status,json:{error:'private response must not be logged'}};
        },log:()=>{}}),/failed|HTTP/);
        assert.equal(posts,1);
    }
});
test('HTTP 200 alone, malformed or unclassified failures and zero sources cannot report success', async () => {
    for(const result of [undefined,complete({attempted:99}),complete({failed:1,succeeded:2,status:'partial'}),complete({sourcesTotal:0,attempted:0,succeeded:0})]){
        await assert.rejects(run(env,{request:async(url,options)=>options.method==='POST'?{status:200,json:{status:'ingest started',result}}:health,log:()=>{}}));
    }
    const skipped=complete({attempted:0,succeeded:0,skipped:3,articlesAdded:0});
    assert.equal((await run(env,{request:async(url,options)=>options.method==='POST'?{status:200,json:{result:skipped}}:health,log:()=>{}})).skipped,3);
});
test('transport enforces deadline and does not follow redirects or leak response bodies', async () => {
    let targetRequests=0;
    const server=http.createServer((req,res)=>{
        if(req.url==='/hang')return;
        if(req.url==='/redirect'){res.writeHead(302,{Location:'/target'});res.end();return;}
        if(req.url==='/large'){res.end('x'.repeat(70000));return;}
        targetRequests++;res.end('private invalid JSON');
    }).listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    try {
        await assert.rejects(requestJson(base+'/hang',{timeoutMs:30},http),/timed out/);
        assert.equal((await requestJson(base+'/redirect',{},http)).status,302);assert.equal(targetRequests,0);
        await assert.rejects(requestJson(base+'/large',{},http),/expected size/);
        assert.equal((await requestJson(base+'/target',{},http)).json,null);
    }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

function pipelineFixture({fetchFeed,processArticle}={}) {
    const Database=require('better-sqlite3'),db=new Database(':memory:');
    db.exec(fs.readFileSync(path.join(__dirname,'../database/schema.sql'),'utf8'));
    const filename=path.join(__dirname,'../services/processingPipeline.js'),localRequire=createRequire(filename);
    const registry=[1,2,3].map(id=>({sourceName:'Fixture '+id,feedUrl:'https://fixture.test/'+id,homepageUrl:'https://fixture.test',sourceType:'research',credibilityTier:2,category:'AI Research',enabled:true,pollingInterval:30}));
    const item=url=>({title:'Fixture research '+url.split('/').pop(),description:'Research',url,publishedAt:new Date(),fingerprint:url,imageUrl:null});
    const mocks={
        fs:{readFileSync:()=>JSON.stringify(registry)},'../database/db':db,
        './rssService':{fetchFeed:fetchFeed|| (async url=>[item(url)])},
        '../ai/geminiService':{processArticle:processArticle|| (async()=>({isAiRelated:true,summary:{whatHappened:'Research',whyItMatters:'Fixture',keyPoints:[]},category:'AI Research',importanceScore:70,confidenceLabel:'Medium'}))},
    };
    const module={exports:{}};
    vm.runInNewContext(fs.readFileSync(filename,'utf8'),{require:name=>Object.hasOwn(mocks,name)?mocks[name]:localRequire(name),module,__dirname:path.dirname(filename),process:{env:{}},console:{error:()=>{}},Date});
    return {db,...module.exports,item};
}
test('pipeline reports real additions and later not-due sources without changing deduplication', async()=>{
    const fixture=pipelineFixture();
    try {
        const first=await fixture.runPipeline();assert.equal(first.status,'completed');assert.equal(first.articlesAdded,3);assert.equal(first.succeeded,3);
        const second=await fixture.runPipeline();assert.equal(second.skipped,3);assert.equal(second.articlesAdded,0);
        assert.equal(fixture.db.prepare('SELECT COUNT(*) n FROM articles').get().n,3);
    }finally{fixture.db.close();}
});
test('source failures remain isolated and partial completion is explicit', async()=>{
    const fixture=pipelineFixture({fetchFeed:async url=>{if(url.endsWith('/2'))throw Error('HTTP 429');return [{title:'Research '+url,url,publishedAt:new Date(),fingerprint:url}];}});
    try{const result=await fixture.runPipeline();assert.equal(result.status,'partial');assert.equal(result.failed,1);assert.equal(result.succeeded,2);assert.equal(result.articlesAdded,2);}finally{fixture.db.close();}
});
test('overlapping triggers share one promise and do not process twice', async()=>{
    let release,requests=0;
    const gate=new Promise(resolve=>{release=resolve;});
    const fixture=pipelineFixture({fetchFeed:async url=>{requests++;await gate;return [{title:'Research '+url,url,publishedAt:new Date(),fingerprint:url}];}});
    try{
        const a=fixture.runPipeline(),b=fixture.runPipeline();assert.equal(a,b);
        release();const [one,two]=await Promise.all([a,b]);assert.equal(one,two);assert.equal(requests,3);
    }finally{fixture.db.close();}
});
test('all feed failures produce a partial summary and the next trigger can run again',async()=>{
    const fixture=pipelineFixture({fetchFeed:async()=>{throw Error('HTTP 503');}});
    try{for(let i=0;i<2;i++){const result=await fixture.runPipeline();assert.equal(result.status,'partial');assert.equal(result.pipelineFailures,0);assert.equal(result.failedSources.length,3);assert.equal(result.failed,3);assert.equal(result.articlesAdded,0);}}finally{fixture.db.close();}
});
test('partial source failure retains the count of already committed articles',async()=>{
    let analyses=0;
    const fixture=pipelineFixture({processArticle:async()=>{if(++analyses===2)throw Error('processing unavailable');return {isAiRelated:true,summary:{whatHappened:'Fixture',whyItMatters:'Fixture'},category:'AI Research',importanceScore:70,confidenceLabel:'Medium'};}});
    try{
        const source={id:fixture.db.prepare('INSERT INTO sources(sourceName,feedUrl) VALUES(?,?)').run('Fixture','https://fixture.test').lastInsertRowid};
        const result=await fixture.processSource(source,{db:fixture.db,fetchFeed:async()=>[fixture.item('https://fixture.test/1'),fixture.item('https://fixture.test/2')]});
        assert.equal(result.processed,1);assert.ok(result.error);
        assert.equal(fixture.db.prepare('SELECT COUNT(*) n FROM articles').get().n,1);
    }finally{fixture.db.close();}
});

test('authenticated ingestion route awaits completion, preserves legacy status, and reports fatal errors', async()=>{
    const express=require('express'),filename=path.join(__dirname,'../routes/api.js'),localRequire=createRequire(filename);
    let release,started=0,fail=false;
    const gate=new Promise(resolve=>{release=resolve;}),runtime={env:{INGEST_SECRET:'dummy-route-secret'}};
    const module={exports:{}};
    vm.runInNewContext(fs.readFileSync(filename,'utf8'),{
        require:name=>name==='../database/db'?{}:name==='../services/processingPipeline'?{runPipeline:async()=>{started++;await gate;if(fail)throw Error('database unavailable');return complete();}}:name==='../email/digestService'?{}:localRequire(name),
        module,process:runtime,console,
    });
    const app=express();app.use('/api',module.exports);
    const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
    const url='http://127.0.0.1:'+server.address().port+'/api/internal/ingest';
    try {
        assert.equal((await fetch(url,{method:'POST'})).status,401);assert.equal(started,0);
        let settled=false;
        const pending=fetch(url,{method:'POST',headers:{'x-ingest-secret':'dummy-route-secret'}}).then(r=>{settled=true;return r;});
        while(!started)await new Promise(resolve=>setTimeout(resolve,1));
        assert.equal(settled,false);release();
        const response=await pending;assert.equal(response.status,200);
        const body=await response.json();assert.equal(body.status,'ingest started');assert.equal(body.result.status,'completed');assert.equal(body.result.articlesAdded,2);
        fail=true;assert.equal((await fetch(url,{method:'POST',headers:{'x-ingest-secret':'dummy-route-secret'}})).status,500);
        delete runtime.env.INGEST_SECRET;assert.equal((await fetch(url,{method:'POST'})).status,500);
    }finally{release();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('CMU timeout and several source failures are successful completed runs with warnings', async()=>{
    for(const failed of [1,3]){
        const logs=[];
        const result=complete({sourcesTotal:32,attempted:failed,succeeded:0,failed,skipped:32-failed,articlesAdded:0,status:'partial',
            failedSources:Array.from({length:failed},(_,i)=>({sourceName:i?'Fixture '+i:'ML@CMU',reason:'Fetch timeout'}))});
        const actual=await run(env,{request:async(url,options)=>options.method==='POST'?{status:200,json:{result}}:health,log:line=>logs.push(line)});
        assert.equal(actual,result);
        assert.ok(logs.some(line=>line.startsWith('::warning::Ingestion completed with source warnings')));
        assert.ok(logs.some(line=>line.includes('ML@CMU - Fetch timeout')));
    }
});
test('pipeline failure and absent completion proof remain errors despite HTTP 200', async()=>{
    for(const result of [
        complete({pipelineCompleted:false}),
        complete({pipelineCompleted:undefined}),
        complete({status:'failed',failed:1,succeeded:2,pipelineFailures:1}),
        complete({status:'completed',failed:1,succeeded:2,failedSources:[{sourceName:'CMU',reason:'Fetch timeout'}]}),
    ])await assert.rejects(run(env,{request:async(url,options)=>options.method==='POST'?{status:200,json:{result}}:health,log:()=>{}}));
});
test('zero additions with successful fetched sources succeeds',async()=>{
    const result=complete({articlesAdded:0});
    assert.equal((await run(env,{request:async(url,options)=>options.method==='POST'?{status:200,json:{result}}:health,log:()=>{}})).articlesAdded,0);
});
test('warning output cannot echo an authentication secret or inject a new workflow command',async()=>{
    const logs=[];
    const result=complete({status:'partial',failed:1,succeeded:2,failedSources:[{sourceName:env.INGEST_SECRET+'\n::error::fake',reason:'Fetch timeout'}]});
    await run(env,{request:async(url,options)=>options.method==='POST'?{status:200,json:{result}}:health,log:line=>logs.push(line)});
    assert.ok(!logs.join('').includes(env.INGEST_SECRET));
    assert.ok(logs.every(line=>!line.includes('\n')));
});
test('processing and database exceptions are classified as pipeline failures',async()=>{
    const fixture=pipelineFixture({processArticle:async()=>{throw Error('processing/database failure');}});
    try {
        const result=await fixture.runPipeline();
        assert.equal(result.status,'failed');assert.equal(result.pipelineFailures,3);assert.equal(result.failedSources.length,0);
        await assert.rejects(run(env,{request:async(url,options)=>options.method==='POST'?{status:200,json:{result}}:health,log:()=>{}}),/pipeline\/database/);
    } finally {fixture.db.close();}
});

test('database write failures cannot be downgraded to feed warnings',async()=>{
    const fixture=pipelineFixture();
    const prepare=fixture.db.prepare.bind(fixture.db);
    fixture.db.prepare=sql=>{
        if(sql.startsWith('INSERT INTO articles'))throw Error('database write failed');
        return prepare(sql);
    };
    try {
        const result=await fixture.runPipeline();
        assert.equal(result.pipelineFailures,3);assert.equal(result.status,'failed');
        assert.equal(result.failedSources.length,0);
        await assert.rejects(run(env,{request:async(url,options)=>options.method==='POST'?{status:200,json:{result}}:health,log:()=>{}}),/pipeline\/database/);
    } finally {fixture.db.close();}
});
