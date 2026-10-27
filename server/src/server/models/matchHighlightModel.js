const {EXECUTESQL}=require('../db/database');
class MatchHighlight {
  selectAll({match_id,limit=50,offset=0},query=EXECUTESQL){return query("SELECT * FROM match_highlights WHERE match_id=? AND status='published' ORDER BY created_date,id LIMIT ? OFFSET ?",[match_id,limit,offset]);}
  selectOne(id,query=EXECUTESQL){return query('SELECT * FROM match_highlights WHERE id=?',[id]);}
  create(row,query=EXECUTESQL){return query('INSERT INTO match_highlights (id,match_id,uploader_user_id,image_url,image_sha256,caption,status) VALUES (?,?,?,?,?,?,?)',[row.id,row.match_id,row.uploader_user_id,row.image_url,row.image_sha256,row.caption,'published']);}
  update(id,status,query=EXECUTESQL){return query('UPDATE match_highlights SET status=?,updated_date=NOW() WHERE id=?',[status,id]);}
  delete(id,query=EXECUTESQL){return this.update(id,'removed',query);}
}
module.exports=MatchHighlight;
