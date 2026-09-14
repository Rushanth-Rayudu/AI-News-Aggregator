// Bound memory use and avoid repeatedly analyzing unchanged rejected articles.
class AnalysisCache {
 constructor({limit=500, ttl=86400000, now=Date.now}={}) { this.limit=limit; this.ttl=ttl; this.now=now; this.entries=new Map(); this.blockedUntil=0; }
 get(key) { const item=this.entries.get(key); if(!item)return; if(item.until<=this.now()){this.entries.delete(key);return;} return item.value; }
 set(key,value) { this.entries.delete(key); this.entries.set(key,{value,until:this.now()+this.ttl}); if(this.entries.size>this.limit)this.entries.delete(this.entries.keys().next().value); }
 pause(milliseconds=300000) { this.blockedUntil=this.now()+milliseconds; }
 get paused() { return this.now()<this.blockedUntil; }
}
module.exports={AnalysisCache};
