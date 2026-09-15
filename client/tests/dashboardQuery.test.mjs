import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FILTERS, normalizeFilters, readFilters, filtersUrl, eventIdFrom } from '../src/utils/dashboardQuery.js';
test('new readers get seven days; saved preferences remain compatible', () => {
 assert.equal(readFilters('').timeframe,'7d');
 assert.equal(readFilters('',{...DEFAULT_FILTERS,timeframe:'24h',forYou:true}).timeframe,'24h');
});
test('shared URL overrides saved search and sort, but keeps Following local', () => {
 const filters=readFilters('?time=7d&q=OpenAI',{...DEFAULT_FILTERS,category:'Robotics',sort:'importance',forYou:true});
 assert.equal(filters.category,'All');assert.equal(filters.sort,'latest');assert.equal(filters.forYou,true);
 const url=filtersUrl(filters,'https://example.com/news?event=42');
 assert.ok(url.includes('event=42'));assert.ok(!url.includes('following'));assert.ok(!url.includes('forYou'));
 assert.deepEqual(readFilters(url.split('?')[1],filters),filters);
});
test('malformed filters are bounded, stripped of control characters and default safely', () => {
 const filters=readFilters('?time=bad&category=bad&sort=bad&q='+encodeURIComponent('a'.repeat(300)+'\u0000'));
 assert.equal(filters.timeframe,'7d');assert.equal(filters.category,'All');assert.equal(filters.sort,'latest');assert.equal(filters.search.length,200);
 assert.equal(normalizeFilters({search:'O\u0000penAI',source:12}).search,'OpenAI');
 assert.equal(readFilters('?time=all').timeframe,null);
});
test('event IDs accept only positive safe integers', () => {
 assert.equal(eventIdFrom(''),null);assert.equal(eventIdFrom('?event=42'),'42');
 for(const value of ['0','-1','abc','1.5','9007199254740992','1/../../'])assert.equal(eventIdFrom('?event='+value),'');
});
