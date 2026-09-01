import assert from "node:assert/strict";
import test from "node:test";

import {
  GoogleFormUploadError,
  googleFormURL,
  withoutBessPhotos,
} from "../public/util/googleForm.js";

test("oversized Google Form submissions raise a typed URL error", () => {
  assert.throws(
    () => googleFormURL({ notes: "x".repeat(500) }, 200),
    (error) =>
      error instanceof GoogleFormUploadError && error.code === "URL_LIMIT"
  );
});

test("BESS photo fallback does not mutate the assessment", () => {
  const testData = {
    test_id: "test-1",
    mBESS_pose_error_photos: { mBESS_double_errors: [{ photo: "data" }] },
  };
  const reduced = withoutBessPhotos(testData);

  assert.equal("mBESS_pose_error_photos" in reduced, false);
  assert.equal("mBESS_pose_error_photos" in testData, true);
  assert.match(googleFormURL(reduced), /entry\.1164512684=/);
});
