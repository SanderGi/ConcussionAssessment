import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";

import {
  createDriveBundle,
  createKeyFile,
  decryptJSON,
  encryptJSON,
  importKeyFile,
  isDriveBundle,
} from "../public/util/encryption.js";

async function createKeyMaterial() {
  const algorithm = { name: "AES-GCM" };
  const aes256key = await webcrypto.subtle.generateKey(
    { ...algorithm, length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  return { algorithm, aes256key };
}

test("new encrypted records use a fresh IV and round-trip", async () => {
  const key = await createKeyMaterial();
  const value = { tests: { one: { test_updated_at: 123 } } };

  const first = await encryptJSON(value, key, webcrypto);
  const second = await encryptJSON(value, key, webcrypto);

  assert.equal(first.version, 2);
  assert.equal(first.iv.length, 12);
  assert.notDeepEqual(first.iv, second.iv);
  assert.deepEqual(await decryptJSON(first, key, webcrypto), value);
});

test("legacy ciphertext arrays remain decryptable", async () => {
  const key = await createKeyMaterial();
  const legacyIv = webcrypto.getRandomValues(new Uint8Array(96));
  const value = { legacy: true };
  const encrypted = await webcrypto.subtle.encrypt(
    { ...key.algorithm, iv: legacyIv },
    key.aes256key,
    new TextEncoder().encode(JSON.stringify(value))
  );

  assert.deepEqual(
    await decryptJSON(
      Array.from(new Uint8Array(encrypted)),
      { ...key, legacyIv },
      webcrypto
    ),
    value
  );
});

test("Drive bundles keep their key and ciphertext together", async () => {
  const { file, key } = await createKeyFile(webcrypto);
  const value = { tests: { recovered: { test_updated_at: 42 } } };
  const bundle = createDriveBundle(
    file,
    await encryptJSON(value, key, webcrypto)
  );

  assert.equal(isDriveBundle(bundle), true);
  assert.deepEqual(
    await decryptJSON(
      bundle.data,
      await importKeyFile(bundle.key, webcrypto),
      webcrypto
    ),
    value
  );
});
