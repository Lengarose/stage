const express        = require('express');
const router         = express.Router();
const PlayerContract = require('../models/playerContractModel');
const { EXECUTESQL } = require('../db/database');
const { requireClubPermission, writeClubAudit } = require('../services/clubOperationsService');
const { assertContractCanBeDeleted } = require('../services/lifecycleOwnedContracts');
const { v4: uuidv4 } = require('uuid');

async function insertClubLedgerRow({
  clubId,
  amount = 0,
  type,
  category,
  description,
  relatedEntityType = 'player_contract',
  relatedEntityId = null,
  referenceId,
}) {
  const rows = await EXECUTESQL('SELECT stc FROM clubs WHERE id = ? LIMIT 1', [clubId]).catch(() => []);
  if (!rows.length) return;
  const balanceAfter = Number(rows[0].stc || 0) + Number(amount || 0);
  if (Number(amount || 0) !== 0) {
    await EXECUTESQL('UPDATE clubs SET stc = ?, updated_date = NOW() WHERE id = ?', [balanceAfter, clubId]);
  }
  await EXECUTESQL(
    `INSERT INTO stc_transactions
     (id, club_id, amount, balance_after, type, category, description, related_entity_type, related_entity_id, reference_id, created_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [uuidv4(), clubId, Number(amount || 0), balanceAfter, type, category, description, relatedEntityType, relatedEntityId || referenceId, referenceId]
  ).catch(() => {});
}

async function cancelContractOffer(contractId, req, reason = null) {
  const existing = await new PlayerContract().selectOne(contractId);
  const contract = existing[0];
  if (!contract) {
    const err = new Error('Not found');
    err.status = 404;
    throw err;
  }
  if(contract.compensation_policy_version)throw Object.assign(new Error('Use the versioned Board proposal action'),{status:409});
  if (!['pending', 'pending_window', 'negotiating'].includes(contract.status)) {
    const err = new Error('Only pending contract offers can be cancelled');
    err.status = 400;
    throw err;
  }

  const { user } = await requireClubPermission(req, contract.team_id, 'offer_contracts');
  await EXECUTESQL(
    `UPDATE player_contracts
        SET status = 'cancelled',
            start_date = NULL,
            end_date = NULL
      WHERE id = ?`,
    [contractId]
  );

  await EXECUTESQL(
    `UPDATE inbox_messages
        SET status = 'cancelled',
            is_read = 1
      WHERE related_entity_id = ?
        AND message_type = 'contract_offer'`,
    [contractId]
  ).catch(() => {});

  if (Number(contract.transfer_fee_stc || 0) > 0) {
    await insertClubLedgerRow({
      clubId: contract.team_id,
      amount: 0,
      type: 'released',
      category: 'transfer_release',
      description: `Transfer lock released for cancelled offer (${Number(contract.transfer_fee_stc || 0).toLocaleString()} STC)`,
      referenceId: contractId,
    });
  }

  await EXECUTESQL(
    `UPDATE notifications
        SET \`read\` = 1
      WHERE related_id = ?
        AND type = 'contract_offer'`,
    [contractId]
  ).catch(() => {});

  await EXECUTESQL(
    `UPDATE players p
       LEFT JOIN player_contracts active_pc
         ON active_pc.user_id = p.id
        AND active_pc.team_id = ?
        AND active_pc.status = 'active'
       LEFT JOIN club_staff_roles csr
         ON csr.player_id = p.id
        AND csr.club_id = ?
        SET p.club_id = NULL,
            p.role = 'member',
            p.club_roles = JSON_ARRAY('member'),
            p.status = 'free_agent',
            p.updated_date = NOW()
      WHERE p.id = ?
        AND p.club_id = ?
        AND active_pc.id IS NULL
        AND csr.id IS NULL`,
    [contract.team_id, contract.team_id, contract.user_id, contract.team_id]
  ).catch(() => {});
  await EXECUTESQL(
    `UPDATE club_memberships cm
       LEFT JOIN player_contracts active_pc
         ON active_pc.user_id = cm.player_id
        AND active_pc.team_id = cm.club_id
        AND active_pc.status = 'active'
       LEFT JOIN club_staff_roles csr
         ON csr.player_id = cm.player_id
        AND csr.club_id = cm.club_id
        SET cm.status = 'inactive',
            cm.updated_date = NOW()
      WHERE cm.player_id = ?
        AND cm.club_id = ?
        AND cm.status = 'active'
        AND active_pc.id IS NULL
        AND csr.id IS NULL`,
    [contract.user_id, contract.team_id]
  ).catch(() => {});

  await writeClubAudit({
    clubId: contract.team_id,
    user,
    action: 'contract_offer_cancelled',
    entityType: 'player_contract',
    entityId: contractId,
    oldValue: contract,
    newValue: { ...contract, status: 'cancelled' },
    reason,
  });

  const updated = await new PlayerContract().selectOne(contractId);
  return updated[0];
}

// GET /
router.get('/', async (req, res) => {
  try {
    const { team_id, user_id, status, page } = req.query;
    const contract = new PlayerContract();
    let result;
    if (team_id && status)   result = await contract.selectByTeamAndStatus(team_id, status);
    else if (user_id && status) result = await contract.selectByUserAndStatus(user_id, status);
    else if (team_id)        result = await contract.selectByTeam(team_id);
    else if (user_id)        result = await contract.selectByUser(user_id);
    else if (status)         result = await contract.selectByStatus(status);
    else result = await contract.selectAll(Number(page) || 1);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const contract = new PlayerContract();
    const result   = await contract.selectOne(req.params.id);
    if (!result.length) return res.status(404).json({ error: 'Not found' });
    res.json(result[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /
router.post('/', async (req,res)=>{
  try {res.status(201).json(await require('../services/clubAgreementService').offer(req.body||{},req.user));}
  catch(err){res.status(err.status||500).json({error:err.message,details:err.details,code:err.code||null});}
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const updated = await cancelContractOffer(req.params.id, req, req.body?.reason || null);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PATCH /:id
router.patch('/:id', (_req, res) => {
  res.status(409).json({ error: 'Use the contract offer, response or termination action. Contracts cannot be changed through generic profile updates.' });
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new PlayerContract().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    assertContractCanBeDeleted(existing[0]);
    await new PlayerContract().delete(id);
    res.json({ success: true });
  } catch (err) {
    const status = Number(err?.status) >= 400 && Number(err.status) < 600 ? Number(err.status) : 500;
    if (status >= 500) console.error(err);
    const payload = { error: err.message };
    if (err?.code) payload.code = String(err.code);
    res.status(status).json(payload);
  }
});

module.exports = router;
