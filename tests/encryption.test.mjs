import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";

import {
  createDriveDataEnvelope,
  createKeyFile,
  decryptJSON,
  encryptJSON,
  importKeyFile,
  isDriveDataEnvelope,
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

test("Drive data envelopes identify a separate immutable key", async () => {
  const { file, key } = await createKeyFile(webcrypto);
  const value = { tests: { recovered: { test_updated_at: 42 } } };
  const envelope = createDriveDataEnvelope(
    key.keyId,
    await encryptJSON(value, key, webcrypto)
  );

  assert.equal(file.version, 1);
  assert.equal(file.keyId, key.keyId);
  assert.equal(isDriveDataEnvelope(envelope), true);
  assert.equal(Object.hasOwn(envelope, "key"), false);
  assert.deepEqual(
    await decryptJSON(
      envelope.data,
      await importKeyFile(file, webcrypto),
      webcrypto
    ),
    value
  );
});

test("legacy separate key and data files remain compatible", async () => {
  const { file, key } = await createKeyFile(webcrypto);
  const legacyKeyFile = {
    algorithm: file.algorithm,
    key: file.key,
  };
  const imported = await importKeyFile(legacyKeyFile, webcrypto);
  const value = { tests: { legacy: { test_updated_at: 7 } } };
  const legacyDataFile = await encryptJSON(value, key, webcrypto);

  assert.equal(imported.keyId, key.keyId);
  assert.deepEqual(
    await decryptJSON(legacyDataFile, imported, webcrypto),
    value
  );
});

test("legacy key files with a shared IV remain compatible", async () => {
  const key = await createKeyMaterial();
  const legacyIv = webcrypto.getRandomValues(new Uint8Array(96));
  const legacyKeyFile = {
    algorithm: {
      name: key.algorithm.name,
      iv: Array.from(legacyIv),
    },
    key: await webcrypto.subtle.exportKey("jwk", key.aes256key),
  };
  const value = { tests: { oldest: { test_updated_at: 1 } } };
  const encrypted = await webcrypto.subtle.encrypt(
    { ...key.algorithm, iv: legacyIv },
    key.aes256key,
    new TextEncoder().encode(JSON.stringify(value))
  );

  assert.deepEqual(
    await decryptJSON(
      Array.from(new Uint8Array(encrypted)),
      await importKeyFile(legacyKeyFile, webcrypto),
      webcrypto
    ),
    value
  );
});

test("declared key IDs must match their key material", async () => {
  const { file } = await createKeyFile(webcrypto);

  await assert.rejects(
    importKeyFile({ ...file, keyId: "wrong-key" }, webcrypto),
    /key ID does not match/
  );
});
