export function isActiveLoan(loan) {
  return String(loan?.status || "").toUpperCase() === "ACTIVE";
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
