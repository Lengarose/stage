import assert from "node:assert/strict";
import test from "node:test";

import { stepCarouselIndex, visibleCarouselSlots, wrapIndex } from "../transferCarousel.js";

test("carousel index wraps in both directions", () => {
  assert.equal(wrapIndex(-1, 5), 4);
  assert.equal(wrapIndex(5, 5), 0);
  assert.equal(stepCarouselIndex(0, 4, -1), 3);
  assert.equal(stepCarouselIndex(3, 4, 1), 0);
});

test("carousel window keeps the focused card in the center", () => {
  assert.deepEqual(visibleCarouselSlots(1, 0), [{ index: 0, offset: 0 }]);
  assert.deepEqual(
    visibleCarouselSlots(5, 2),
    [
      { index: 0, offset: -2 },
      { index: 1, offset: -1 },
      { index: 2, offset: 0 },
      { index: 3, offset: 1 },
      { index: 4, offset: 2 },
    ],
  );
});
