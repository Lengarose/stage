export const ACCOUNT_INTENT_KEY = "stage-account-intent";

const PLAYER_INTENT = "player";
const PRESIDENT_INTENTS = new Set(["president", "both"]);
const VALID_INTENTS = new Set([PLAYER_INTENT, ...PRESIDENT_INTENTS]);

function getAccountIntentKey(userId) {
  return `${ACCOUNT_INTENT_KEY}:${userId}`;
}

function normalizeAccountIntent(intent) {
  return VALID_INTENTS.has(intent) ? intent : PLAYER_INTENT;
}

export function isPresidentAccountIntent(intent) {
  return PRESIDENT_INTENTS.has(normalizeAccountIntent(intent));
}

export function readAccountIntent(userId) {
  if (!userId) return PLAYER_INTENT;
  try {
    return normalizeAccountIntent(localStorage.getItem(getAccountIntentKey(userId)));
  } catch {
    return PLAYER_INTENT;
  }
}

export function writeAccountIntent(intent, userId) {
  if (!userId) return;
  try {
    localStorage.setItem(getAccountIntentKey(userId), normalizeAccountIntent(intent));
  } catch {
    /* ignore */
  }
}

export function clearAccountIntent(userId) {
  try {
    localStorage.removeItem(ACCOUNT_INTENT_KEY);
    if (userId) localStorage.removeItem(getAccountIntentKey(userId));
  } catch {
    /* ignore */
  }
}
