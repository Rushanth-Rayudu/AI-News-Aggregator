const test = require('node:test');
const assert = require('node:assert/strict');
const {healthOf,timestampMs,enrichEvent} = require('../services/sourceIntelligence');
const {inferCategory} = require('../services/taxonomy');

test('SQL UTC timestamps and disabled health are honest', () => {
 assert.equal(timestampMs('2026-09-07 12:00:00'), Date.parse('2026-09-07T12:00:00Z'));
 assert.equal(healthOf({enabled:false,sourceName:'Anthropic News'}).health,'disabled');
 assert.match(healthOf({enabled:false,sourceName:'Anthropic News'}).healthReason,/404/);
 assert.equal(healthOf({enabled:true,lastSuccessfulFetch:'2026-09-07 12:00:00'}, {publishedAt:'2026-09-07T11:00:00Z'},Date.parse('2026-09-07T12:10:00Z')).health,'healthy');
});
test('ordinary recent stories and old stories do not become Breaking on ingestion', async () => {
 const {deriveStoryState}=await import('../../client/src/utils/eventIntelligence.js');
 const base={title:'OpenAI releases a model',importanceScore:80,confidenceLabel:'Low',discoveredAt:new Date().toISOString(),sources:[{sourceName:'OpenAI',organization:'OpenAI',isPrimary:true,publishedAt:new Date().toISOString()}]};
 assert.equal(deriveStoryState(base),null);
 assert.equal(deriveStoryState({...base,importanceScore:95,confidenceLabel:'Medium'}),'Breaking');
 assert.equal(deriveStoryState({...base,importanceScore:95,confidenceLabel:'Medium',sources:[{...base.sources[0],publishedAt:'2025-01-01T00:00:00Z'}]}),null);
 assert.equal(deriveStoryState({...base,confidenceLabel:'High'}),'Confirmed');
});
test('timeline retains simultaneous reports and uses recorded addition timestamps', async () => {
 const {buildTimeline}=await import('../../client/src/utils/eventIntelligence.js');
 const at='2026-09-07T12:00:00Z';
 const items=buildTimeline({discoveredAt:at,updatedAt:at,sources:[{sourceName:'A',url:'https://a',publishedAt:at,discoveredAt:at},{sourceName:'B',url:'https://b',publishedAt:at,discoveredAt:at}]});
 assert.equal(items.filter(i=>i.kind==='source').length,2);
 assert.equal(items.filter(i=>i.kind==='added').length,2);
 assert.equal(items.filter(i=>i.kind==='updated').length,0);
});
test('fallback taxonomy classifies supported topics without guessing significance',()=>{
 assert.equal(inferCategory('New research on neural training'),'AI Research');
 assert.equal(inferCategory('Robot learns to walk'),'Robotics');
 assert.equal(inferCategory('OpenAI releases GPT model'),'Model Release');
 assert.equal(inferCategory('An unrelated opinion'),'Other');
});
test('contested reporting can retain independent display source',()=>{
 const event=enrichEvent({title:'OpenAI lawsuit investigation'},[{sourceName:'OpenAI Blog',title:'Our response to a lawsuit',url:'https://openai.com/response'},{sourceName:'TechCrunch AI',title:'OpenAI lawsuit investigation',url:'https://techcrunch.com/report'}]);
 assert.equal(event.primarySource.sourceName,'TechCrunch AI');
 assert.equal(event.documentCount,2);
});

test('feed entities render as text and quiet feeds are stale',()=>{
 const {decodeFeedText}=require('../services/textNormalization');
 assert.equal(decodeFeedText('Meta says it&amp;#8217;s changing'),'Meta says it\u2019s changing');
 assert.equal(healthOf({enabled:true,lastError:'No recent dated articles extracted'}).health,'stale');
});

test('clear current feed subjects receive supported fallback categories', () => {
 assert.equal(inferCategory('New AI regulation takes effect'), 'AI Regulation / Policy');
 assert.equal(inferCategory('From Hacks to Bioweapons, Claude Misuse Is Now Everywhere'), 'AI Safety');
 assert.equal(inferCategory('Build interactive MCP Apps using Amazon Bedrock AgentCore'), 'AI Agents');
 assert.equal(inferCategory('Health Plans: Can Your AI Tell You Why?'), 'Healthcare AI');
 assert.equal(inferCategory('Meet the People Using Chatbots to Write Custom Fiction'), 'Generative AI');
});
