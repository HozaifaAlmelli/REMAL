import test from "node:test";
import assert from "node:assert/strict";
import {
  clampGuestCount,
  formatGuestCount,
  normalizeGuestCapacity,
  stepGuestCount,
} from "./guest-count";

test("keeps guest counts between one and the unit capacity", () => {
  assert.equal(clampGuestCount(-3, 6), 1);
  assert.equal(clampGuestCount(4, 6), 4);
  assert.equal(clampGuestCount(8, 6), 6);
  assert.equal(stepGuestCount(1, -1, 6), 1);
  assert.equal(stepGuestCount(6, 1, 6), 6);
});

test("normalizes invalid capacities without allowing zero guests", () => {
  assert.equal(normalizeGuestCapacity(Number.NaN), 1);
  assert.equal(normalizeGuestCapacity(0), 1);
  assert.equal(normalizeGuestCapacity(6.9), 6);
});

test("formats common Arabic guest counts clearly", () => {
  assert.equal(formatGuestCount(1), "ضيف واحد");
  assert.equal(formatGuestCount(2), "ضيفان");
  assert.equal(formatGuestCount(6), "6 ضيوف");
});
