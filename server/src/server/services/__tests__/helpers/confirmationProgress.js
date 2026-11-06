'use strict';
const {jobId}=require('../../../models/regionalProgressModel');
function fixture() {
  const jobs=new Map();let queue=Promise.resolve();
  const query=async(sql,v)=>{
    if(sql.startsWith('INSERT IGNORE')){if(!jobs.has(v[0]))jobs.set(v[0],JSON.parse(v[1]));return {};}
    if(sql.startsWith('SELECT *')){const job=jobs.get(v[0]);return job?[{data_json:JSON.stringify(job)}]:[];}
    if(sql.startsWith('UPDATE')){jobs.set(v[2],JSON.parse(v[0]));return {};}
    throw Error('Unexpected checkpoint SQL');
  };
  const transaction=fn=>{
    const run=queue.then(async()=>{const before=structuredClone(jobs);try{return await fn(query);}catch(e){jobs.clear();for(const [k,v] of before)jobs.set(k,v);throw e;}});
    queue=run.catch(()=>{});return run;
  };
  return {jobs,query,transaction,job:id=>jobs.get(jobId('confirmation_notice',id))};
}
module.exports={fixture};
