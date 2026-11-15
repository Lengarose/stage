const { EXECUTESQL, withTransaction } = require('../db/database');
const { v4: uuid } = require('uuid');
const { wallClockToOffsetIso, resolveTimeZone } = require('../utils/datetime');
const fail = (message,status=409) => { throw Object.assign(new Error(message),{status}); };

// SQL DATETIME has no offset. Interpret it in the saved window zone, never the
// Node process zone. Midnight is an exact deadline, not an implicit extra day.
function instant(value, timezone='Europe/Brussels') {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  const text=/^\d{4}-\d{2}-\d{2}$/.test(String(value))?`${value} 00:00:00`:String(value);
  const iso=/[T ]\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/.test(text)?text:wallClockToOffsetIso(text,timezone);
  const ms=Date.parse(iso);
  return Number.isFinite(ms)?ms:NaN;
}
function isTransferWindowEndPassed(endDate,timezone='Europe/Brussels',now=Date.now()) {
  return Boolean(endDate) && !(instant(endDate,timezone)>now);
}
function windowState(row,now=Date.now()) {
  if (!row || row.status!=='open' || isTransferWindowEndPassed(row.end_date,row.timezone,now)) return 'closed';
  const start=instant(row.start_date,row.timezone);
  if (Number.isNaN(start)) return 'closed';
  return start!=null&&start>now?'scheduled':'open';
}
function present(row) {
  if(!row)return null;
  const timezone=resolveTimeZone(row.timezone),state=windowState(row);
  const iso=value=>{const ms=instant(value,timezone);return value&&Number.isFinite(ms)?new Date(ms).toISOString():null;};
  return {...row,status:state==='closed'?'closed':row.status,timezone,window_state:state,is_open:state==='open',can_open_new:state==='closed',start_date:iso(row.start_date),end_date:iso(row.end_date)};
}
function sqlTime(ms,timezone) {
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms));
  const value=key=>parts.find(p=>p.type===key).value;
  return `${value('year')}-${value('month')}-${value('day')} ${value('hour')}:${value('minute')}:${value('second')}`;
}
async function ensureTransferWindowsTable() {
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS transfer_windows (
    id VARCHAR(36) PRIMARY KEY,label VARCHAR(255),status VARCHAR(50) DEFAULT 'open',
    start_date DATETIME,end_date DATETIME,timezone VARCHAR(80) NOT NULL DEFAULT 'Europe/Brussels',notes TEXT,
    transfers_executed INT DEFAULT 0,created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);
}
async function expire(rows,q) {
  const current=[];
  for(const row of rows){
    if(windowState(row)==='closed') await q("UPDATE transfer_windows SET status = 'closed', updated_date = NOW() WHERE id = ? AND status = 'open'",[row.id]);
    else current.push(row);
  }
  return current;
}
async function availableWindows() {
  await ensureTransferWindowsTable();
  const rows=await EXECUTESQL("SELECT * FROM transfer_windows WHERE status = 'open' ORDER BY created_date DESC, id DESC",[]);
  return expire(rows,EXECUTESQL);
}
async function getCurrentTransferWindow() {
  return present((await availableWindows()).find(row=>windowState(row)==='open'));
}
async function getLatestTransferWindow() {
  const rows=await availableWindows();
  const reserved=rows.find(row=>windowState(row)==='open')||rows[0];
  if(reserved)return present(reserved);
  const latest=await EXECUTESQL('SELECT * FROM transfer_windows ORDER BY created_date DESC, id DESC LIMIT 1',[]);
  return present(latest[0]);
}
async function requireTransferWindowAdmin(id,q=EXECUTESQL) {
  const [user]=await q('SELECT id,email,role_id,timezone FROM users WHERE id=? LIMIT 1',[id]);
  if(!user||user.role_id==null||![0,2].includes(Number(user.role_id)))fail('Admin access required',403);
  return user;
}
async function audit(q,user,action,before,after) {
  await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)',[uuid(),user.id,user.email,action,'transfer_window',after.id,JSON.stringify(before||null),JSON.stringify(after),'Admin transfer-window control']);
}
async function openTransferWindow(actor,body) {
  await ensureTransferWindowsTable();
  try {return await withTransaction(async q=>{
    const user=await requireTransferWindowAdmin(actor,q);
    // Lock the complete global-window range, including the empty-table gap, so
    // simultaneous Admin opens cannot both insert an active window.
    const rows=await q('SELECT * FROM transfer_windows ORDER BY created_date DESC, id DESC FOR UPDATE',[]);
    const open=await expire(rows.filter(r=>r.status==='open'),q);
    if(open.length)fail('A transfer window is already open or scheduled. Close it before opening another.');
    const timezone=resolveTimeZone(body.timezone||user.timezone),now=Date.now();
    const start=body.start_date?instant(body.start_date,timezone):now,end=body.end_date?instant(body.end_date,timezone):null;
    if(!Number.isFinite(start)||end!=null&&!Number.isFinite(end))fail('Enter valid transfer-window dates.',400);
    if(end!=null&&(end<=start||end<=now))fail('The closing time must be after the opening time and in the future.',400);
    const id=uuid();
    await q("INSERT INTO transfer_windows (id,label,status,start_date,end_date,timezone,notes,transfers_executed,created_date,updated_date) VALUES (?,?,'open',?,?,?,?,0,NOW(),NOW())",[id,body.label||'Transfer Window',sqlTime(start,timezone),end==null?null:sqlTime(end,timezone),timezone,body.notes||'']);
    const [created]=await q('SELECT * FROM transfer_windows WHERE id=?',[id]);
    await audit(q,user,'open_transfer_window',null,created);
    return present(created);
  });}catch(e){if(['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(e.code))fail('Transfer-window state changed. Refresh and try again.');throw e;}
}
async function closeTransferWindow(actor,id) {
  if(!id)fail('Choose a transfer window to close.');
  return withTransaction(async q=>{
    const user=await requireTransferWindowAdmin(actor,q);
    const [before]=await q('SELECT * FROM transfer_windows WHERE id=? FOR UPDATE',[id]);
    if(!before)fail('Transfer window not found.',404);
    if(before.status!=='closed'){
      await q("UPDATE transfer_windows SET status='closed',updated_date=NOW() WHERE id=?",[id]);
      await audit(q,user,'close_transfer_window',before,{...before,status:'closed'});
    }
    return present({...before,status:'closed'});
  });
}
function transferWindowClosedError() {
  return Object.assign(new Error('Transfer window is closed. Contract offers can only be sent while the transfer window is open.'),{status:409,code:'transfer_window_closed'});
}
async function assertTransferWindowOpenForContractOffer() {
  const current=await getCurrentTransferWindow();
  if(!current)throw transferWindowClosedError();
  return current;
}
module.exports={assertTransferWindowOpenForContractOffer,getCurrentTransferWindow,getLatestTransferWindow,isTransferWindowEndPassed,transferWindowClosedError,windowState,openTransferWindow,closeTransferWindow,requireTransferWindowAdmin};
