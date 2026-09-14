const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { runTransaction } = require('../database/postgresAdapter');
const { runBackgroundJob } = require('../services/backgroundJob');

function fixture(query) {
 const client = new EventEmitter();
 const calls = [];
 client.query = async sql => { calls.push(sql); return query ? query(sql) : {rows: []}; };
 client.release = error => { client.released = true; client.releaseError = error; };
 return { client, calls, pool: { connect: async () => client } };
}
test('checked-out connection loss rejects transaction and destroys client without an unhandled event', async () => {
 const f = fixture(); const dropped = new Error('Connection terminated unexpectedly');
 await assert.rejects(runTransaction(f.pool, async tx => {
   f.client.emit('error', dropped);
   await tx.prepare('SELECT 1').all();
 }), error => error === dropped);
 assert.deepEqual(f.calls, ['BEGIN']);
 assert.equal(f.client.releaseError, dropped);
 assert.equal(f.client.listenerCount('error'), 0);
});
test('rollback failure preserves original failure and destroys unusable connection', async () => {
 const original = new Error('statement failed'), rollback = new Error('connection lost');
 const f = fixture(sql => { if(sql === 'ROLLBACK') throw rollback; return {rows: []}; });
 await assert.rejects(runTransaction(f.pool, async () => { throw original; }), e => e === original);
 assert.equal(f.client.releaseError, rollback);
});
test('healthy transactions commit and release while failed statements roll back', async () => {
 const f = fixture();
 assert.equal(await runTransaction(f.pool, async () => 42), 42);
 assert.deepEqual(f.calls, ['BEGIN', 'COMMIT']);
 assert.equal(f.client.releaseError, undefined);
 const g = fixture();
 await assert.rejects(runTransaction(g.pool, async () => { throw new Error('bad statement'); }));
 assert.deepEqual(g.calls, ['BEGIN', 'ROLLBACK']);
 assert.equal(g.client.releaseError, undefined);
});
test('connection acquisition timeout propagates to caller', async () => {
 await assert.rejects(runTransaction({connect: async () => {throw new Error('timeout');}}, () => {}), /timeout/);
});
test('background rejection is contained and later invocation can succeed', async () => {
 let ran = false;
 await runBackgroundJob('Test outage', async () => {throw new Error('private connection details');});
 await runBackgroundJob('Test recovery', async () => {ran = true;});
 assert.equal(ran, true);
});
