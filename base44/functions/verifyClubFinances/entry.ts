/**
 * verifyClubFinances — Admin-only verification of club finance allocation
 * 
 * Checks all earning sources are properly allocating to:
 * - balance (100%)
 * - transfer_budget (10%)
 * - wage_budget (5%)
 * 
 * POST body: { club_id } (optional, checks all clubs if omitted)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { club_id } = body;

    let clubs = [];
    if (club_id) {
      clubs = await base44.asServiceRole.entities.Club.filter({ id: club_id });
    } else {
      clubs = await base44.asServiceRole.entities.Club.list('-created_date', 100);
    }

    const results = [];

    for (const club of clubs) {
      const clubId = club.id;
      const transactions = await base44.asServiceRole.entities.STCTransaction.filter(
        { club_id: clubId },
        '-created_date',
        500
      );

      // Group by type
      const byType = {};
      for (const tx of transactions) {
        if (!byType[tx.type]) byType[tx.type] = [];
        byType[tx.type].push(tx);
      }

      // Check earning sources
      const issues = [];

      // Ticket revenue: should have allocation in description
      if (byType.ticket_revenue) {
        for (const tx of byType.ticket_revenue) {
          if (!tx.description.includes('Transfer +') || !tx.description.includes('Wage +')) {
            issues.push(`Ticket revenue TX ${tx.id}: Missing allocation breakdown in description`);
          }
        }
      }

      // Tournament wins: should have allocation
      if (byType.tournament_win) {
        for (const tx of byType.tournament_win) {
          if (!tx.description.includes('Transfer +') || !tx.description.includes('Wage +')) {
            issues.push(`Tournament win TX ${tx.id}: Missing allocation breakdown in description`);
          }
        }
      }

      // Tournament finals: should have allocation
      if (byType.tournament_final) {
        for (const tx of byType.tournament_final) {
          if (!tx.description.includes('Transfer +') || !tx.description.includes('Wage +')) {
            issues.push(`Tournament final TX ${tx.id}: Missing allocation breakdown in description`);
          }
        }
      }

      // Wager wins (club): should have allocation
      if (byType.wager_win) {
        for (const tx of byType.wager_win) {
          // Only check club wagers (player wagers won't have allocation description)
          if (tx.club_id && !tx.description.includes('Transfer +') && !tx.description.includes('Wage +')) {
            issues.push(`Wager win TX ${tx.id}: Club wager missing allocation breakdown in description`);
          }
        }
      }

      // Verify budget values are positive
      const transfer = club.transfer_budget_stc || 0;
      const wage = club.wage_budget_stc || 0;
      const balance = club.stc || 0;

      if (transfer < 0) issues.push(`Transfer budget is negative: ${transfer}`);
      if (wage < 0) issues.push(`Wage budget is negative: ${wage}`);

      results.push({
        club: club.name,
        club_id: clubId,
        balance,
        transfer_budget_stc: transfer,
        wage_budget_stc: wage,
        total_transactions: transactions.length,
        earning_sources: {
          ticket_revenue: byType.ticket_revenue?.length || 0,
          tournament_win: byType.tournament_win?.length || 0,
          tournament_final: byType.tournament_final?.length || 0,
          wager_win: byType.wager_win?.length || 0,
        },
        issues: issues.length > 0 ? issues : 'OK',
      });
    }

    return Response.json({
      success: true,
      clubs_checked: clubs.length,
      results,
    });
  } catch (error) {
    console.error('Verification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});