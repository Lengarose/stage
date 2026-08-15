const express = require('express');
const router = express.Router();
const PlayerLoan = require('../models/playerLoanModel');
const { requireClubPermission, writeClubAudit } = require('../services/clubOperationsService');
const { proposeLoan, rejectLoanByParent } = require('../services/playerLoanService');

function handleError(res, err) {
  res.status(err.status || 400).json({ error: err.message, code: err.code || null });
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

router.post('/:id/parent-reject', async (req, res) => {
  try {
    const rows = await new PlayerLoan().selectOne(req.params.id);
    const existing = rows[0];
    if (!existing) return res.status(404).json({ error: 'Not found' });
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

module.exports = router;
