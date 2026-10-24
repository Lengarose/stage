const express=require('express');
const router=express.Router();
const Model=require('../models/trophyAwardModel');
const model=new Model();
router.get('/',async(req,res)=>{try{res.json(await model.selectAll(req.query));}catch(e){res.status(500).json({error:e.message});}});
router.get('/:id',async(req,res)=>{try{const [row]=await model.selectOne(req.params.id);res.status(row?200:404).json(row||{error:'Not found'});}catch(e){res.status(500).json({error:e.message});}});
for(const method of ['post','patch','delete'])router[method](['/', '/:id'],(req,res)=>res.status(403).json({error:'Trophy entitlement is awarded only by verified competition outcomes; use audited admin review for corrections'}));
module.exports=router;
