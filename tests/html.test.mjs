import assert from "node:assert/strict";
import test from "node:test";

import { escapeHTML, safeImageURL } from "../public/util/html.js";

test("escapeHTML neutralizes markup and attribute delimiters", () => {
  assert.equal(
    escapeHTML(`<img src=x onerror='alert("x")'>&`),
    "&lt;img src=x onerror=&#39;alert(&quot;x&quot;)&#39;&gt;&amp;"
  );
});

test("safeImageURL permits expected image sources", () => {
  assert.equal(
    safeImageURL("/avatar.png", "https://scat6.example"),
    "https://scat6.example/avatar.png"
  );
  assert.equal(
    safeImageURL("data:image/jpeg;base64,AA=="),
    "data:image/jpeg;base64,AA=="
  );
});

test("safeImageURL rejects active URL schemes and SVG data", () => {
  assert.equal(safeImageURL("javascript:alert(1)"), "");
  assert.equal(
    safeImageURL("data:image/svg+xml,<svg onload=alert(1)></svg>"),
    ""
  );
});
