async function withTransaction(database,callback){
 if(database.withTransaction)return database.withTransaction(callback);
 database.exec('BEGIN IMMEDIATE');
 try{const value=await callback(database);database.exec('COMMIT');return value;}
 catch(error){database.exec('ROLLBACK');throw error;}
}
module.exports={withTransaction};
