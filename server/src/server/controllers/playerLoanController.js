const express = require('express');
const router = express.Router();
const PlayerLoan = require('../models/playerLoanModel');
const { requireClubPermission, writeClubAudit } = require('../services/clubOperationsService');
const { resolvePlayerForUserId } = require('../services/identityService');
const {
  proposeLoan,
  rejectLoanByParent,
  acceptLoanByParent,
  rejectLoanByPlayer,
  acceptLoanByPlayer,
  cancelLoan,
} = require('../services/playerLoanService');

function handleError(res, err) {
  res.status(err.status || 400).json({ error: err.message, code: err.code || null });
}

async function loadLoanOr404(req, res) {
  const rows = await new PlayerLoan().selectOne(req.params.id);
  const existing = rows[0];
  if (!existing) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  return existing;
}

async function requireLoanPlayer(req, loan) {
  const player = await resolvePlayerForUserId(req.user?.id);
  if (!player || String(player.id) !== String(loan.player_id)) {
    const err = new Error('Only the player can respond to this loan');
    err.code = 'LOAN_NOT_PLAYER';
    err.status = 403;
    throw err;
  }
  return player;
}

router.get('/', async (req, res) => {
  try {
    const rows = await new PlayerLoan().selectAll(req.query);
    res.json(rows);
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rows = await new PlayerLoan().selectOne(req.params.id);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/', async (req, res) => {
  try {
    const loanClubId = req.body?.loan_club_id;
    const { user } = await requireClubPermission(req, loanClubId, 'offer_contracts');
    const loan = await proposeLoan({
      playerId: req.body.player_id,
      loanClubId,
      proposedByClubId: loanClubId,
      proposedByUserId: user.id,
      startDate: req.body.start_date,
      endDate: req.body.end_date,
      loanFeeStc: req.body.loan_fee_stc,
      parentWagePercentage: req.body.parent_wage_percentage,
      loanWagePercentage: req.body.loan_wage_percentage,
    });
    await writeClubAudit({
      clubId: loanClubId,
      user,
      action: 'loan_proposed',
      entityType: 'player_loan',
      entityId: loan.id,
      newValue: loan,
    });
    res.status(201).json(loan);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/:id/parent-accept', async (req, res) => {
  try {
    const existing = await loadLoanOr404(req, res);
    if (!existing) return;
    const { user } = await requireClubPermission(req, existing.parent_club_id, 'offer_contracts');
    const loan = await acceptLoanByParent({
      loanId: existing.id,
      actorClubId: existing.parent_club_id,
    });
    await writeClubAudit({
      clubId: existing.parent_club_id,
      user,
      action: 'loan_parent_accepted',
      entityType: 'player_loan',
      entityId: loan.id,
      oldValue: existing,
      newValue: loan,
    });
    res.json(loan);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/:id/parent-reject', async (req, res) => {
  try {
    const existing = await loadLoanOr404(req, res);
    if (!existing) return;
    const { user } = await requireClubPermission(req, existing.parent_club_id, 'offer_contracts');
    const loan = await rejectLoanByParent({
      loanId: existing.id,
      actorClubId: existing.parent_club_id,
    });
    await writeClubAudit({
      clubId: existing.parent_club_id,
      user,
      action: 'loan_rejected',
      entityType: 'player_loan',
      entityId: loan.id,
      oldValue: existing,
      newValue: loan,
    });
    res.json(loan);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/:id/player-accept', async (req, res) => {
  try {
    const existing = await loadLoanOr404(req, res);
    if (!existing) return;
    const player = await requireLoanPlayer(req, existing);
    const loan = await acceptLoanByPlayer({
      loanId: existing.id,
      actorPlayerId: player.id,
    });
    res.json(loan);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/:id/player-reject', async (req, res) => {
  try {
    const existing = await loadLoanOr404(req, res);
    if (!existing) return;
    const player = await requireLoanPlayer(req, existing);
    const loan = await rejectLoanByPlayer({
      loanId: existing.id,
      actorPlayerId: player.id,
    });
    res.json(loan);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const existing = await loadLoanOr404(req, res);
    if (!existing) return;
    const actorClubId = req.body?.actor_club_id || existing.parent_club_id;
    const allowedClubId = [existing.parent_club_id, existing.loan_club_id].includes(actorClubId)
      ? actorClubId
      : existing.parent_club_id;
    const { user } = await requireClubPermission(req, allowedClubId, 'offer_contracts');
    const loan = await cancelLoan({
      loanId: existing.id,
      actorClubId: allowedClubId,
    });
    await writeClubAudit({
      clubId: allowedClubId,
      user,
      action: 'loan_cancelled',
      entityType: 'player_loan',
      entityId: loan.id,
      oldValue: existing,
      newValue: loan,
    });
    res.json(loan);
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;
