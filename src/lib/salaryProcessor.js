import { stageClient } from '@/api/stageClient';

const SESSION_KEY = 'salary_last_checked';

function shouldCheck() {
  const last = sessionStorage.getItem(SESSION_KEY);
  if (!last) return true;
  return Date.now() - Number(last) > 60 * 60 * 1000; // once per hour per session
}

/**
 * Triggers a server-side salary payment for the current player.
 * The server checks if 7+ days have passed since last payment and pays if due.
 * Returns the amount paid (0 if nothing was due or no contract).
 */
export async function processPlayerSalary(_player) {
  if (!shouldCheck()) return 0;
  sessionStorage.setItem(SESSION_KEY, String(Date.now()));
  try {
    const res = await stageClient.functions.invoke('playerWallet', { action: 'pay_salary' });
    return Number(res?.data?.new_balance ? (res.data.new_balance - (_player?.stc || 0)) : 0);
  } catch {
    // Not due yet or no contract — silent
    return 0;
  }
}
