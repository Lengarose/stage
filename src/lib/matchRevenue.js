import { stageClient } from '@/api/stageClient';

/**
 * processSoloMatchRevenue — settle wager for player-vs-player (non-club) matches.
 * Delegates entirely to the server-side processSoloWager handler which guards against
 * double-settlement via an atomic status claim.
 */
export async function processSoloMatchRevenue(gameSnapshot) {
  if (gameSnapshot.mode === 'club') return;
  if (!gameSnapshot.wager_stc || gameSnapshot.wager_status !== 'active') return;
  try {
    await stageClient.functions.invoke('processSoloWager', { match_id: gameSnapshot.id });
  } catch (err) {
    console.warn('[matchRevenue] solo wager settlement failed:', err);
  }
}

/**
 * processMatchRevenue — no-op stub kept for call-site compatibility.
 *
 * Ticket revenue, win-streak updates, club balance, transfer budget allocation, and
 * inbox notifications for club matches are now handled entirely server-side inside
 * processMatchCompletion (functionsController.js). That function runs atomically
 * before the client ever calls this function, ensuring:
 *   • No double-processing
 *   • No race conditions between client and server balance writes
 *   • Revenue is captured even if the browser closes after result submission
 */
export async function processMatchRevenue(_gameSnapshot) {
  // All club match revenue logic has moved to the server.
  // This function is intentionally empty and safe to call multiple times.
}
