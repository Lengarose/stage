'use strict';
const crypto=require('crypto');
const parse=value=>typeof value==='string'?JSON.parse(value):value;
const types={cup:'regional_cup_progress',cycle:'regional_cycle_progress'};
const jobId=(kind,id)=>{if(!Object.hasOwn(types,kind))throw Error('Unsupported regional progress kind');const h=crypto.createHash('sha256').update(`regional-${kind}-progress:${id}`).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;};
class RegionalProgressModel {
  constructor(kind) {if(!Object.hasOwn(types,kind))throw Error('Unsupported regional progress kind');this.kind=kind;this.entityType=types[kind];}
  async claim(sourceId,now,leaseUntil,attemptId,q) {
    const id=jobId(this.kind,sourceId),initial={id,source_id:sourceId,status:'queued',attempts:0};
    await q(`INSERT IGNORE INTO league_entities (id,entity_type,data_json,status) VALUES (?,'${this.entityType}',?,'queued')`,[id,JSON.stringify(initial)]);
    const [row]=await q(`SELECT * FROM league_entities WHERE id=? AND entity_type='${this.entityType}' FOR UPDATE`,[id]);
    const previous=parse(row.data_json);
    if(previous.next_attempt_at && previous.next_attempt_at>now)return null;
    const job={...previous,id,source_id:sourceId,status:'running',attempts:Number(previous.attempts || 0)+1,attempt_id:attemptId,last_checked_at:now,lease_until:leaseUntil,next_attempt_at:leaseUntil};
    await this.save(job,q);return job;
  }
  async save(job,q) {await q(`UPDATE league_entities SET data_json=?,status=?,updated_date=NOW() WHERE id=? AND entity_type='${this.entityType}'`,[JSON.stringify(job),job.status,job.id]);}
  async finish(job,result,q) {
    const [row]=await q(`SELECT * FROM league_entities WHERE id=? AND entity_type='${this.entityType}' FOR UPDATE`,[job.id]);
    if(!row || parse(row.data_json).attempt_id!==job.attempt_id)return false;
    await this.save({...job,...result,lease_until:null},q);return true;
  }
}
module.exports={RegionalProgressModel,jobId};
