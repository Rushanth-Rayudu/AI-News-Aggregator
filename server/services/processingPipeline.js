const fs = require('fs');
const path = require('path');
const db = require('../database/db');
const { withTransaction } = require('./transaction');
const { fetchFeed } = require('./rssService');
const { findMatchingEvent } = require('./deduplicationService');
const { processArticle } = require('../ai/geminiService');
const { recordFetch } = require('./sourceHealth');
const { rankSources, officialFor, timestampMs } = require('./sourceIntelligence');

async function processSource(source, dependencies = {}) {
    const database = dependencies.db || db;
    const fetch = dependencies.fetchFeed || fetchFeed;
    const analyze = dependencies.processArticle || processArticle;
    let processed = 0;
    try {
        const items = await fetch(source.feedUrl);
        if (!items.length) throw new Error('No recent dated articles extracted');
        const maxItems = Math.max(1, parseInt(process.env.MAX_NEW_ITEMS_PER_SOURCE || '10', 10));
        for (const item of items) {
            if (processed >= maxItems) break;
            if (await database.prepare('SELECT id FROM articles WHERE fingerprint=? OR url=?').get(item.fingerprint,item.url)) continue;
            const aiData = await analyze(item.title,item.description,source.credibilityTier,item.url);
            if (!aiData.isAiRelated) continue;
            await withTransaction(database, async transaction => {
            const event = await findMatchingEvent(item.title,item.description,transaction,item.publishedAt);
            const isPrimary = officialFor({...source,...item});
            let eventId = event?.id;
            if (!event) {
                const result = await transaction.prepare('INSERT INTO events (title,summary,whyItMatters,keyPoints,category,importanceScore,confidenceScore,confidenceLabel) VALUES (?,?,?,?,?,?,?,?)').run(
                    item.title,aiData.summary.whatHappened,aiData.summary.whyItMatters,JSON.stringify(aiData.summary.keyPoints||[]),aiData.category,
                    Math.max(0,Math.min(100,aiData.importanceScore||0)),0,aiData.confidenceLabel);
                eventId=result.lastInsertRowid;
            }
            await transaction.prepare('INSERT INTO articles (eventId,sourceId,title,description,url,imageUrl,publishedAt,fingerprint,isPrimary) VALUES (?,?,?,?,?,?,?,?,?)').run(
                eventId,source.id,item.title,item.description,item.url,item.imageUrl,item.publishedAt.toISOString(),item.fingerprint,transaction.pool?isPrimary:Number(isPrimary));
            if(event){
                const coverage = await transaction.prepare('SELECT a.*, s.sourceName, s.sourceType, s.credibilityTier FROM articles a JOIN sources s ON s.id=a.sourceId WHERE a.eventId=?').all(eventId);
                const best=rankSources(coverage,event)[0];
                if(best.url===item.url){
                    await transaction.prepare('UPDATE events SET title=?,summary=?,whyItMatters=?,keyPoints=?,category=?,importanceScore=?,confidenceLabel=?,updatedAt=CURRENT_TIMESTAMP WHERE id=?').run(
                        item.title,aiData.summary.whatHappened,aiData.summary.whyItMatters,JSON.stringify(aiData.summary.keyPoints||[]),aiData.category,
                        Math.min(100,Math.max(event.importanceScore||0,aiData.importanceScore||0)),aiData.confidenceLabel,eventId);
                }else await transaction.prepare('UPDATE events SET updatedAt=CURRENT_TIMESTAMP WHERE id=?').run(eventId);
            }
            });
            processed++;
        }
        await database.prepare('UPDATE sources SET lastSuccessfulFetch=CURRENT_TIMESTAMP,lastError=NULL WHERE id=?').run(source.id);
        await recordFetch(database,source,{failure:false,httpStatus:null,lastArticleAt:new Date(Math.max(...items.map(i=>i.publishedAt.getTime()))).toISOString()});
        return {processed};
    } catch(error) {
        // Feed-specific errors cannot prevent later sources from running.
        const reason=/429/.test(error.message)?'HTTP 429: rate limited':/403/.test(error.message)?'HTTP 403: access denied':/404/.test(error.message)?'HTTP 404: feed missing':/timeout|timed out|abort/i.test(error.message)?'Fetch timeout':/No recent/.test(error.message)?'No recent dated articles extracted':'Feed fetch, parsing or processing failed';
        try {
            await database.prepare('UPDATE sources SET lastError=? WHERE id=?').run(reason,source.id);
            await recordFetch(database,source,{failure:true,httpStatus:Number(error.message.match(/\b(4\d\d|5\d\d)\b/)?.[1])||null});
        } catch {
            // Preserve committed additions even when recording diagnostics fails.
            throw Object.assign(new Error('Unable to record source health'), { processed });
        }
        return {error:reason,processed};
    }
}
async function syncSourcesWithRegistry(){
    const registry=JSON.parse(fs.readFileSync(path.join(__dirname,'../feeds/registry.json'),'utf8'));
    for(const s of registry){
        const existing=await db.prepare('SELECT id FROM sources WHERE feedUrl=? OR sourceName=?').get(s.feedUrl,s.sourceName);
        const enabled=db.pool?s.enabled!==false:Number(s.enabled!==false);
        const values=[s.sourceName,s.feedUrl,s.homepageUrl,s.sourceType,s.credibilityTier,s.category,enabled,s.pollingInterval||30];
        if(existing)await db.prepare('UPDATE sources SET sourceName=?,feedUrl=?,homepageUrl=?,sourceType=?,credibilityTier=?,category=?,enabled=?,pollingInterval=? WHERE id=?').run(...values,existing.id);
        else await db.prepare('INSERT INTO sources (sourceName,feedUrl,homepageUrl,sourceType,credibilityTier,category,enabled,pollingInterval) VALUES (?,?,?,?,?,?,?,?)').run(...values);
    }
}
let activeRun=null;
function runPipeline(){
    if(!activeRun)activeRun=(async()=>{
        await syncSourcesWithRegistry();
        const sources=await db.prepare('SELECT * FROM sources WHERE enabled=TRUE').all();
        const result = { sourcesTotal:sources.length, attempted:0, succeeded:0, failed:0, skipped:0, articlesAdded:0 };
        for(const source of sources){
            if(source.lastSuccessfulFetch && Date.now()-timestampMs(source.lastSuccessfulFetch)<(source.pollingInterval||30)*60000){ result.skipped++; continue; }
            result.attempted++;
            try {
                const outcome = await processSource(source);
                result.articlesAdded += outcome.processed || 0;
                if (outcome.error) result.failed++;
                else result.succeeded++;
            } catch (error) { result.failed++; result.articlesAdded += error.processed || 0; console.error('Unable to record source health for source',source.id); }
        }
        return { ...result, status:result.failed ? (result.succeeded ? 'partial' : 'failed') : 'completed', completedAt:new Date().toISOString() };
    })().finally(()=>{activeRun=null;});
    return activeRun;
}
module.exports={runPipeline,syncSourcesWithRegistry,processSource};
