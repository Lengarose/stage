'use strict';
// This helper is intentionally separate from application startup. It only creates
// fresh acceptance schemas on the explicitly selected temporary local instance.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
function configure(){
 const socket=process.env.STAGE_ACCEPTANCE_SOCKET;
 if(!socket || !/^\/private\/tmp\/stage-season-acceptance[^/]*\.sock$/.test(socket))throw Error('Set STAGE_ACCEPTANCE_SOCKET to the dedicated /private/tmp/stage-season-acceptance*.sock instance.');
 const database='stage_acceptance_'+crypto.randomBytes(6).toString('hex');
 Object.assign(process.env,{DB_SOCKET_PATH:socket,DB_USER:'root',DB_PASSWORD:'',DB_NAME:database,DB_TIME_ZONE:'+00:00',ACCESS_TOKEN_SECRET:crypto.randomBytes(32).toString('hex'),REFRESH_TOKEN_SECRET:crypto.randomBytes(32).toString('hex'),SMTP_USER:'',SMTP_PASS:'',SOCKET_SERVER_URL:'',SOCKET_SERVER_SECRET:'',ONESIGNAL_REST_API_KEY:''});
 return {socket,database};
}
async function bootstrap(config){
 const mysql=require('mysql2/promise');
 const connection=await mysql.createConnection({socketPath:config.socket,user:'root',password:'',multipleStatements:true});
 try{
  const schema=fs.readFileSync(path.resolve(__dirname,'../../schema.sql'),'utf8').replace(/^CREATE DATABASE IF NOT EXISTS stage_league.*$/m,`CREATE DATABASE \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`).replace(/^USE stage_league;$/m,`USE \`${config.database}\`;`);
  await connection.query(schema);
 }finally{await connection.end();}
 return require('../../src/server/db/database');
}
module.exports={configure,bootstrap};
if(require.main===module)(async()=>{const config=configure();const db=await bootstrap(config);console.log(JSON.stringify({database:config.database,schema:'created',mysql:(await db.EXECUTESQL('SELECT VERSION() AS version'))[0].version}));await db.pool.promise().end();})().catch(error=>{console.error(error.message);process.exitCode=1;});
