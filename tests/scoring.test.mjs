import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateScat6CognitiveTotal,
  clampBessError,
  normalizeBessScores,
  scat6DomainTotals,
} from "../public/util/scoring.js";

test("SCAT6 cognitive total sums the four paper-form domains", () => {
  assert.deepEqual(
    scat6DomainTotals({
      orientation: 5,
      immediate_memory: 30,
      concentration: 5,
      delayed_recall: 10,
      mBESS_total_errors: 3,
    }),
    { cognitiveTotal: 50, mbessTotalErrors: 3 }
  );
});

test("legacy BESS stance errors are rounded and clamped before use", () => {
  const legacy = {
    mBESS_double_errors: 11.8,
    mBESS_single_errors: -2,
    mBESS_tandem_errors: 4.6,
    mBESS_total_errors: 99,
  };
  normalizeBessScores(legacy);
  assert.deepEqual(legacy, {
    mBESS_double_errors: 10,
    mBESS_single_errors: 0,
    mBESS_tandem_errors: 5,
    mBESS_total_errors: 15,
  });
  assert.equal(clampBessError("3.6"), 4);
});

test("mBESS remains separate and a zero-error result is valid", () => {
  assert.deepEqual(
    scat6DomainTotals({
      orientation: 0,
      immediate_memory: 0,
      concentration: 0,
      delayed_recall: 0,
      mBESS_total_errors: 0,
    }),
    { cognitiveTotal: 0, mbessTotalErrors: 0 }
  );
});

test("legacy stored cognitive totals remain displayable", () => {
  assert.deepEqual(
    scat6DomainTotals({ cognitive_total: 42, mBESS_total_errors: 4 }),
    { cognitiveTotal: 42, mbessTotalErrors: 4 }
  );
});

test("partial assessments do not produce an invalid cognitive total", () => {
  assert.equal(
    calculateScat6CognitiveTotal({
      orientation: 5,
      immediate_memory: 30,
      concentration: 5,
    }),
    null
  );
});
