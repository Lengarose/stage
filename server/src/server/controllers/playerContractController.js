const express        = require('express');
const router         = express.Router();
const PlayerContract = require('../models/playerContractModel');
const InboxMessage   = require('../models/inboxMessageModel');
const Notification   = require('../models/notificationModel');
const { EXECUTESQL } = require('../db/database');
const { requireClubPermission, writeClubAudit } = require('../services/clubOperationsService');

function contractBody({ club, player, contract }) {
  const typeLabel = String(contract.contract_type || 'squad').replace(/_/g, ' ');
  const salary = Number(contract.weekly_salary_stc || 0);
  const bonus = Number(contract.signing_bonus_stc || 0);
  return [
    `${club?.name || 'A club'} has sent you a ${typeLabel} contract offer.`,
    '',
    `Duration: ${contract.max_games || 0} games / ${contract.max_days || 0} days`,
    `Weekly Salary: ${salary.toLocaleString()} STC / week`,
    bonus > 0 ? `Signing Bonus: ${bonus.toLocaleString()} STC` : null,
    contract.offer_note ? `\nClub note:\n${contract.offer_note}` : null,
    '',
    'Please respond using the buttons below. You can accept the offer, send a counter-offer, or decline it.',
  ].filter(Boolean).join('\n');
}

async function deliverContractOffer(contractId) {
  const rows = await EXECUTESQL(
    `SELECT pc.*, c.name AS club_name, c.logo_url AS club_logo_url, c.owner_email AS club_owner_email,
            p.email AS player_email, p.gamertag AS player_gamertag, p.avatar_url AS player_avatar_url,
            u.email AS user_email
       FROM player_contracts pc
       LEFT JOIN clubs c ON c.id = pc.team_id
       LEFT JOIN players p ON p.id = pc.user_id
       LEFT JOIN users u ON u.player_id = p.id OR u.id = p.user_id
      WHERE pc.id = ?
      LIMIT 1`,
    [contractId]
  );
  const contract = rows[0];
  if (!contract) return;
  const recipientEmail = String(contract.player_email || contract.user_email || '').trim().toLowerCase();
  if (!recipientEmail) return;
  const club = { name: contract.club_name, logo_url: contract.club_logo_url, owner_email: contract.club_owner_email };
  const player = { gamertag: contract.player_gamertag };
  const body = contractBody({ club, player, contract });
  const existingInbox = await EXECUTESQL(
    "SELECT id, recipient_email FROM inbox_messages WHERE related_entity_id = ? AND message_type = 'contract_offer' LIMIT 1",
    [contractId]
  );
  if (existingInbox.length) {
    const currentRecipient = String(existingInbox[0].recipient_email || '').trim().toLowerCase();
    if (currentRecipient !== recipientEmail) {
      await EXECUTESQL(
        `UPDATE inbox_messages
            SET recipient_email = ?,
                status = 'pending',
                is_read = 0
          WHERE id = ?`,
        [recipientEmail, existingInbox[0].id]
      ).catch(() => {});
    }
  } else {
    await new InboxMessage({
      recipient_email: recipientEmail,
      sender_email: contract.club_owner_email || 'system@stage.com',
      sender_gamertag: contract.club_name || 'Club Management',
      sender_avatar_url: contract.club_logo_url || '',
      sender_club_name: contract.club_name || '',
      subject: `Contract Offer from ${contract.club_name || 'Club'}`,
      body,
      message_type: 'contract_offer',
      action_type: 'contract_negotiation',
      related_entity_id: contractId,
      related_entity_type: 'player_contract',
      status: 'pending',
      is_read: false,
      is_system: false,
      metadata: {
        contract_id: contractId,
        club_id: contract.team_id,
        club_name: contract.club_name,
        contract_type: contract.contract_type,
      },
    }).create();
  }
  const existingNotification = await EXECUTESQL(
    "SELECT id, recipient_email FROM notifications WHERE related_id = ? AND type = 'contract_offer' LIMIT 1",
    [contractId]
  );
  if (existingNotification.length) {
    const currentRecipient = String(existingNotification[0].recipient_email || '').trim().toLowerCase();
    if (currentRecipient !== recipientEmail) {
      await EXECUTESQL(
        `UPDATE notifications
            SET recipient_email = ?,
                \`read\` = 0,
                link = '/inbox'
          WHERE id = ?`,
        [recipientEmail, existingNotification[0].id]
      ).catch(() => {});
    }
  } else {
    await new Notification({
      recipient_email: recipientEmail,
      type: 'contract_offer',
      title: `Contract Offer from ${contract.club_name || 'Club'}`,
      body: `${contract.club_name || 'A club'} has sent you a ${contract.contract_type || 'squad'} contract offer.`,
      read: false,
      link: '/inbox',
      related_id: contractId,
    }).create();
  }
}

async function cancelContractOffer(contractId, req, reason = null) {
  const existing = await new PlayerContract().selectOne(contractId);
  const contract = existing[0];
  if (!contract) {
    const err = new Error('Not found');
    err.status = 404;
    throw err;
  }
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
router.post('/', async (req, res) => {
  try {
    const safeBody = {
      ...req.body,
      status: ['pending', 'pending_window'].includes(req.body?.status) ? req.body.status : 'pending',
      start_date: null,
      end_date: null,
      games_played: Number(req.body?.games_played || 0),
    };
    const contract = new PlayerContract(safeBody);
    await contract.create();
    const created = await contract.selectOne(contract.id);
    await deliverContractOffer(contract.id).catch(err => console.error('[contract delivery]', err.message));
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/cancel
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
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new PlayerContract().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const contract = new PlayerContract({ ...existing[0], ...req.body });
    await contract.update(id);
    const updated = await contract.selectOne(id);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new PlayerContract().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new PlayerContract().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
