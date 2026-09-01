import assert from "node:assert/strict";
import test from "node:test";

import {
  localDateRange,
  localTimestampFilename,
  safeFilenameSegment,
} from "../public/util/exportRange.js";

test("the selected end date includes the full local calendar day", () => {
  const [start, endExclusive] = localDateRange("2026-09-01", "2026-09-01");
  const noon = new Date(2026, 8, 1, 12).getTime();
  const nextMidnight = new Date(2026, 8, 2).getTime();

  assert.ok(noon >= start && noon < endExclusive);
  assert.equal(endExclusive, nextMidnight);
});

test("export filenames include local time and reject path separators", () => {
  const timestamp = new Date(2026, 8, 1, 13, 14, 15).getTime();
  assert.equal(localTimestampFilename(timestamp), "2026-09-01_13-14-15");
  assert.equal(safeFilenameSegment("../Alex / Team"), "_Alex_Team");
});
