const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
function routerWithOffer(offer){
 const servicePath=path.resolve(__dirname,'../../services/clubAgreementService.js');
 const controllerPath=path.resolve(__dirname,'../playerContractController.js');
 require.cache[servicePath]={id:servicePath,filename:servicePath,loaded:true,exports:{offer}};
 delete require.cache[controllerPath];return require(controllerPath);
}
function handler(router,method,route){return router.stack.find(layer=>layer.route?.path===route&&layer.route.methods[method]).route.stack[0].handle;}
function response(){return {statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
test('legacy contract POST delegates to the versioned agreement business action with authenticated actor',async()=>{
 const body={team_id:'club',user_id:'player',weekly_salary_stc:10000,duration_type:'fixed_12_weeks'},actor={id:'manager'};
 const router=routerWithOffer(async(received,user)=>{assert.deepEqual(received,body);assert.deepEqual(user,actor);return {id:'proposal',version:1,status:'pending'};});
 const res=response();await handler(router,'post','/')({body,user:actor},res);
 assert.equal(res.statusCode,201);assert.equal(res.body.status,'pending');assert.equal(res.body.version,1);
});
test('business-action errors retain status and transfer-window code for legacy consumers',async()=>{
 const router=routerWithOffer(async()=>{throw Object.assign(new Error('Transfer window closed'),{status:409,code:'transfer_window_closed'});}),res=response();
 await handler(router,'post','/')({body:{},user:{id:'manager'}},res);assert.equal(res.statusCode,409);assert.equal(res.body.code,'transfer_window_closed');
});
test('generic PATCH cannot overwrite accepted terms or proposal states',async()=>{
 const router=routerWithOffer(async()=>{throw new Error('must not call');}),res=response();
 handler(router,'patch','/:id')({body:{weekly_salary_stc:999999}},res);assert.equal(res.statusCode,409);
});
