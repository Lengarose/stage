export function isActiveLoan(loan) {
  return String(loan?.status || "").toUpperCase() === "ACTIVE";
}

function dateOnly(value) {
  if (value == null || value === "") return null;
  const text = String(value);
  return text.length >= 10 ? text.slice(0, 10) : text;
}

function asAllowedFlag(value) {
  if (value === undefined || value === null || value === "") return true;
  if (value === false || value === 0 || value === "0") return false;
  return true;
}

export function isLoanRecallable(loan, today = new Date()) {
  if (!isActiveLoan(loan) || !asAllowedFlag(loan?.recall_allowed)) return false;
  const afterDate = dateOnly(loan?.recall_after_date);
  if (!afterDate) return true;
  const todayText = dateOnly(today instanceof Date ? today.toISOString() : today);
  return Boolean(todayText && todayText >= afterDate);
}

export function isEarlyEndWaitingOnClub(loan, clubId) {
  const pendingBy = String(loan?.early_end_proposed_by_club_id || "");
  return isActiveLoan(loan) && Boolean(pendingBy) && pendingBy !== String(clubId);
}

export function canProposeEarlyEnd(loan, clubId) {
  if (!isActiveLoan(loan)) return false;
  const isParty = String(loan.parent_club_id) === String(clubId) || String(loan.loan_club_id) === String(clubId);
  if (!isParty) return false;
  return !isEarlyEndWaitingOnClub(loan, clubId);
}

export function getPurchaseType(loan) {
  return String(loan?.purchase_type || "NONE").toUpperCase();
}

export function getPurchaseDeadline(loan) {
  return dateOnly(loan?.purchase_option_deadline) || dateOnly(loan?.end_date);
}

// Only the borrowing club exercises, only on an ACTIVE optional loan, only
// before the deadline, and only once — after that the player has to answer.
export function canExercisePurchaseOption(loan, clubId, today = new Date()) {
  if (!isActiveLoan(loan)) return false;
  if (String(loan?.loan_club_id) !== String(clubId)) return false;
  if (getPurchaseType(loan) !== "OPTIONAL") return false;
  if (loan?.purchase_offer_status) return false;
  const deadline = getPurchaseDeadline(loan);
  if (!deadline) return true;
  const todayText = dateOnly(today instanceof Date ? today.toISOString() : today);
  return Boolean(todayText && todayText <= deadline);
}

export function isPurchaseAwaitingPlayer(loan) {
  return isActiveLoan(loan) && String(loan?.purchase_offer_status || "") === "AWAITING_PLAYER";
}

export function isPurchasePendingWindow(loan) {
  return isActiveLoan(loan) && String(loan?.purchase_offer_status || "") === "PENDING_WINDOW";
}

export function applyLoanAnnotations(players = [], loans = [], clubId) {
  const active = (loans || []).filter(isActiveLoan);
  const byPlayer = new Map(active.map((loan) => [String(loan.player_id), loan]));
  return (players || []).map((player) => {
    const loan = byPlayer.get(String(player.id));
    if (!loan) return { ...player, selectable: player.selectable !== false };
    const isBorrower = String(loan.loan_club_id) === String(clubId);
    if (isBorrower) {
      return {
        ...player,
        loan_id: loan.id,
        loan_badge: "LOAN",
        loan_status: "loaned_in",
        selectable: true,
        loan_from_club_id: loan.parent_club_id,
        loan_from_club_name: loan.parent_club_name,
        loan_end_date: loan.end_date,
        early_end_proposed_by_club_id: loan.early_end_proposed_by_club_id || null,
        purchase_type: getPurchaseType(loan),
        purchase_option_stc: loan.purchase_option_stc || 0,
        purchase_option_deadline: getPurchaseDeadline(loan),
        purchase_offer_status: loan.purchase_offer_status || null,
        can_exercise_purchase_option: canExercisePurchaseOption(loan, clubId),
      };
    }
    return {
      ...player,
      loan_id: loan.id,
      loan_status: "loaned_out",
      selectable: false,
      on_loan_club_id: loan.loan_club_id,
      on_loan_club_name: loan.loan_club_name,
      loan_end_date: loan.end_date,
      recall_allowed: loan.recall_allowed,
      recall_after_date: loan.recall_after_date,
      loan_recallable: isLoanRecallable(loan),
      early_end_proposed_by_club_id: loan.early_end_proposed_by_club_id || null,
      purchase_type: getPurchaseType(loan),
      purchase_option_stc: loan.purchase_option_stc || 0,
      purchase_option_deadline: getPurchaseDeadline(loan),
      purchase_offer_status: loan.purchase_offer_status || null,
    };
  });
}

export function splitSquadByLoan(players = []) {
  const list = players || [];
  return {
    selectable: list.filter((player) => player.loan_status !== "loaned_out"),
    onLoan: list.filter((player) => player.loan_status === "loaned_out"),
  };
}

export function getPlayingClubId(player, loans = []) {
  const loan = (loans || []).find((row) => isActiveLoan(row) && String(row.player_id) === String(player?.id));
  return loan?.loan_club_id || player?.club_id || null;
}

export function getLoanForContract(contract, loans = []) {
  return (loans || []).find((loan) => (
    isActiveLoan(loan) && String(loan.contract_id) === String(contract?.id)
  )) || null;
}
