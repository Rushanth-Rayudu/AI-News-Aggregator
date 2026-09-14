const test=require('node:test'),assert=require('node:assert/strict');
const {AnalysisCache}=require('../ai/analysisCache');
test('unchanged analysis is cached including non-AI results; expired results are removed',()=>{
 let now=0;const cache=new AnalysisCache({now:()=>now,ttl:100});
 const result={isAiRelated:false};cache.set('article',result);assert.equal(cache.get('article'),result);
 now=101;assert.equal(cache.get('article'),undefined);
});
test('analysis cache is bounded and quota cooldown expires',()=>{
 let now=0;const cache=new AnalysisCache({limit:2,now:()=>now});
 cache.set('a',1);cache.set('b',2);cache.set('c',3);assert.equal(cache.get('a'),undefined);assert.equal(cache.get('c'),3);
 cache.pause(100);assert.equal(cache.paused,true);now=101;assert.equal(cache.paused,false);
});

test('Gemini service reuses valid rejected analysis and stops calls after quota exhaustion', async () => {
 const fs=require('node:fs'),vm=require('node:vm');
 let calls=0,limited=false;
 const result={isAiRelated:false,category:'Other',importanceScore:12,confidenceLabel:'Low',summary:{whatHappened:'Unrelated article',whyItMatters:'',keyPoints:[]}};
 const context={module:{exports:{}},process:{env:{GEMINI_API_KEY:'test-only'}},console:{error(){}},require(id){
  if(id==='@google/genai')return {GoogleGenAI:class {models={generateContent:async()=>{calls++;if(limited)throw Object.assign(new Error('RESOURCE_EXHAUSTED'),{status:429});return {text:JSON.stringify(result)};}};}};
  if(id==='./analysisCache')return {AnalysisCache};
  if(id==='../services/taxonomy')return require('../services/taxonomy');
  return require(id);
 }};
 vm.runInNewContext(fs.readFileSync(require.resolve('../ai/geminiService'),'utf8'),context);
 const api=context.module.exports;
 assert.equal((await api.processArticle('Music news','A concert','B','https://example.com/music')).isAiRelated,false);
 assert.equal((await api.processArticle('Music news','A concert','B','https://example.com/music')).isAiRelated,false);
 assert.equal(calls,1);
 limited=true;
 await api.processArticle('AI models','new AI model','A','https://example.com/ai');
 await api.processArticle('AI research','research','A','https://example.com/research');
 await api.generateDailyDigest([{title:'AI models',summary:'New release'}]);
 assert.equal(calls,2);
});
