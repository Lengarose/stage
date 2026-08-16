import assert from "node:assert/strict";
import test from "node:test";
import {
  applyLoanAnnotations,
  canExercisePurchaseOption,
  canProposeEarlyEnd,
  getLoanForContract,
  getPurchaseDeadline,
  getPlayingClubId,
  isEarlyEndWaitingOnClub,
  isLoanRecallable,
  splitSquadByLoan,
} from "../playerLoanDisplay.js";

const loan = {
  id: "loan-1",
  player_id: "player-1",
  contract_id: "contract-1",
  parent_club_id: "club-a",
  loan_club_id: "club-b",
  end_date: "2027-06-30",
  status: "ACTIVE",
};

test("borrower squad shows a LOAN badge and the owner lists the player as on loan", () => {
  const players = [{ id: "player-1", gamertag: "Player X" }];
  const atBorrower = applyLoanAnnotations(players, [loan], "club-b");
  assert.equal(atBorrower[0].loan_badge, "LOAN");
  assert.equal(atBorrower[0].selectable, true);

  const atOwner = applyLoanAnnotations(players, [loan], "club-a");
  const groups = splitSquadByLoan(atOwner);
  assert.equal(groups.selectable.length, 0);
  assert.equal(groups.onLoan[0].on_loan_club_id, "club-b");
  assert.equal(groups.onLoan[0].loan_end_date, "2027-06-30");
});

test("profile current club is the playing club while the parent contract stays the owner", () => {
  assert.equal(getPlayingClubId({ id: "player-1", club_id: "club-a" }, [loan]), "club-b");
  assert.equal(getLoanForContract({ id: "contract-1" }, [loan]).id, "loan-1");
});

test("owner squad annotations keep loan id and recall fields for the Recall control", () => {
  const players = [{ id: "player-1", gamertag: "Player X" }];
  const atOwner = applyLoanAnnotations(players, [{
    ...loan,
    recall_allowed: 1,
    recall_after_date: "2099-01-01",
  }], "club-a");
  assert.equal(atOwner[0].loan_id, "loan-1");
  assert.equal(atOwner[0].recall_allowed, 1);
  assert.equal(atOwner[0].recall_after_date, "2099-01-01");
  assert.equal(atOwner[0].loan_recallable, false);
});

test("isLoanRecallable is true for an active loan with default recall terms", () => {
  assert.equal(isLoanRecallable(loan, "2027-01-15"), true);
  assert.equal(isLoanRecallable({ ...loan, recall_allowed: 0 }, "2027-01-15"), false);
  assert.equal(isLoanRecallable({ ...loan, recall_after_date: "2027-03-01" }, "2027-01-15"), false);
  assert.equal(isLoanRecallable({ ...loan, recall_after_date: "2027-03-01" }, "2027-03-01"), true);
  assert.equal(isLoanRecallable({ ...loan, status: "RECALLED" }, "2027-01-15"), false);
});

test("squad annotations expose a pending early-end proposer for Request return and Accept return", () => {
  const players = [{ id: "player-1", gamertag: "Player X" }];
  const pending = { ...loan, early_end_proposed_by_club_id: "club-a" };
  const atOwner = applyLoanAnnotations(players, [pending], "club-a");
  const atBorrower = applyLoanAnnotations(players, [pending], "club-b");

  assert.equal(atOwner[0].early_end_proposed_by_club_id, "club-a");
  assert.equal(atBorrower[0].early_end_proposed_by_club_id, "club-a");
  assert.equal(canProposeEarlyEnd(pending, "club-a"), true);
  assert.equal(canProposeEarlyEnd(pending, "club-b"), false);
  assert.equal(isEarlyEndWaitingOnClub(pending, "club-b"), true);
  assert.equal(isEarlyEndWaitingOnClub(pending, "club-a"), false);
  assert.equal(canProposeEarlyEnd(loan, "club-b"), true);
});

test("only the borrowing club can exercise an option, and only once, before the deadline", () => {
  const loan = {
    status: "ACTIVE",
    loan_club_id: "club-b",
    parent_club_id: "club-a",
    purchase_type: "OPTIONAL",
    purchase_option_stc: 40000,
    purchase_option_deadline: "2027-06-01",
    end_date: "2027-06-30",
  };
  assert.equal(canExercisePurchaseOption(loan, "club-b", new Date("2027-03-01")), true);
  assert.equal(canExercisePurchaseOption(loan, "club-a", new Date("2027-03-01")), false);
  assert.equal(canExercisePurchaseOption(loan, "club-b", new Date("2027-06-02")), false);
  assert.equal(
    canExercisePurchaseOption({ ...loan, purchase_offer_status: "AWAITING_PLAYER" }, "club-b", new Date("2027-03-01")),
    false,
  );
  assert.equal(
    canExercisePurchaseOption({ ...loan, purchase_type: "MANDATORY" }, "club-b", new Date("2027-03-01")),
    false,
  );
  assert.equal(
    canExercisePurchaseOption({ ...loan, status: "COMPLETED" }, "club-b", new Date("2027-03-01")),
    false,
  );
});

test("a null purchase deadline falls back to the loan end date", () => {
  const loan = {
    status: "ACTIVE",
    loan_club_id: "club-b",
    purchase_type: "OPTIONAL",
    purchase_option_deadline: null,
    end_date: "2027-06-30",
  };
  assert.equal(getPurchaseDeadline(loan), "2027-06-30");
  assert.equal(canExercisePurchaseOption(loan, "club-b", new Date("2027-06-30")), true);
  assert.equal(canExercisePurchaseOption(loan, "club-b", new Date("2027-07-01")), false);
});

test("a purchased player carries no loan annotation", () => {
  const purchased = [{
    id: "loan-1",
    status: "PURCHASED",
    player_id: "player-1",
    parent_club_id: "club-a",
    loan_club_id: "club-b",
  }];
  const [player] = applyLoanAnnotations([{ id: "player-1", club_id: "club-b" }], purchased, "club-b");
  assert.equal(player.loan_badge, undefined);
  assert.equal(player.loan_status, undefined);
  assert.equal(player.selectable, true);
});
