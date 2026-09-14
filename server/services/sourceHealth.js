// Operational diagnostics use the existing system_logs table; no schema migration.
async function recordFetch(database,source,details){
 const previous=await database.prepare("SELECT message FROM system_logs WHERE module=? ORDER BY id DESC LIMIT 1").get('feed-health:'+source.id);
 let old={};try{old=JSON.parse(previous?.message||'{}');}catch{}
 const status={...old,...details,lastFetch:new Date().toISOString(),consecutiveFailures:details.failure?(old.consecutiveFailures||0)+1:0};
 await database.prepare('INSERT INTO system_logs(level,module,message) VALUES(?,?,?)').run(details.failure?'warning':'info','feed-health:'+source.id,JSON.stringify(status));
}
async function fetchDiagnostics(database){
 const rows=await database.prepare("SELECT module,message FROM (SELECT module,message,ROW_NUMBER() OVER(PARTITION BY module ORDER BY id DESC) AS rn FROM system_logs WHERE module LIKE 'feed-health:%') ranked WHERE rn=1").all();
 const result={};for(const row of rows){try{result[row.module.split(':')[1]]=JSON.parse(row.message);}catch{}}
 return result;
}
module.exports={recordFetch,fetchDiagnostics};
