import assert from "node:assert/strict";
import test from "node:test";

import {
  canCreateContractOffer,
  canShowTransferNav,
  filterTransferWindowNavGroups,
  getTransferWindowIndicatorLabel,
} from "../transferWindowAccess.js";

test("transfer navigation is visible only while the transfer window is open", () => {
  assert.equal(canShowTransferNav(true), true);
  assert.equal(canShowTransferNav(false), false);
  assert.equal(canShowTransferNav(null), false);
});

test("new contract offers are allowed only while the transfer window is open", () => {
  assert.equal(canCreateContractOffer(true), true);
  assert.equal(canCreateContractOffer(false), false);
  assert.equal(canCreateContractOffer(undefined), false);
});

test("the global transfer-window label appears only for an open window", () => {
  assert.equal(getTransferWindowIndicatorLabel(true), "Transfer window open");
  assert.equal(getTransferWindowIndicatorLabel(false), null);
});

test("transfer-only nav entries are removed while the window is closed", () => {
  const groups = [
    {
      label: "Market",
      items: [
        { path: "/recruitment", label: "Recruitment" },
        { path: "/transfer-market", label: "Transfers" },
        { path: "/contracts/create?club=club-1", label: "Contracts" },
      ],
    },
  ];

  assert.deepEqual(
    filterTransferWindowNavGroups(groups, false)[0].items.map((item) => item.path),
    ["/recruitment"]
  );
  assert.equal(filterTransferWindowNavGroups(groups, true)[0].items.length, 3);
});
