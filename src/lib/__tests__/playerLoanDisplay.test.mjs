import assert from "node:assert/strict";
import test from "node:test";
import {
  applyLoanAnnotations,
  getLoanForContract,
  getPlayingClubId,
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
