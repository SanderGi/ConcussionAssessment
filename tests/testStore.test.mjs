import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeTestsByUpdatedAt,
  parseStoredTests,
} from "../public/util/testStore.js";

test("cross-tab merges preserve unrelated records", () => {
  const local = {
    first: { test_id: "first", test_updated_at: 20, value: "local" },
  };
  const otherTab = {
    second: { test_id: "second", test_updated_at: 30, value: "other" },
  };

  assert.deepEqual(mergeTestsByUpdatedAt(local, otherTab), {
    first: { test_id: "first", test_updated_at: 20, value: "local" },
    second: { test_id: "second", test_updated_at: 30, value: "other" },
  });
});

test("cross-tab merges keep the newest version of the same record", () => {
  const local = {
    same: { test_id: "same", test_updated_at: 20, value: "new" },
  };
  mergeTestsByUpdatedAt(local, {
    same: { test_id: "same", test_updated_at: 10, value: "stale" },
  });
  assert.equal(local.same.value, "new");

  mergeTestsByUpdatedAt(local, {
    same: { test_id: "same", test_updated_at: 30, value: "newest" },
  });
  assert.equal(local.same.value, "newest");
});

test("invalid legacy browser storage is treated as empty", () => {
  assert.deepEqual(parseStoredTests("not json"), {});
  assert.deepEqual(parseStoredTests("[]"), {});
});
