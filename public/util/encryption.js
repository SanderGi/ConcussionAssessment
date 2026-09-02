export const DATA_ENCRYPTION_VERSION = 2;
export const DRIVE_KEY_VERSION = 1;
export const DRIVE_DATA_VERSION = 1;
export const DRIVE_DATA_FORMAT = "scat6-encrypted-data";

async function getKeyId(aes256key, cryptoApi) {
  const rawKey = await cryptoApi.subtle.exportKey("raw", aes256key);
  const digest = new Uint8Array(
    await cryptoApi.subtle.digest("SHA-256", rawKey)
  );
  return Array.from(digest, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

export async function createKeyFile(cryptoApi = globalThis.crypto) {
  const algorithm = { name: "AES-GCM" };
  const aes256key = await cryptoApi.subtle.generateKey(
    { ...algorithm, length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const keyId = await getKeyId(aes256key, cryptoApi);
  return {
    file: {
      version: DRIVE_KEY_VERSION,
      keyId,
      algorithm: { name: algorithm.name },
      key: await cryptoApi.subtle.exportKey("jwk", aes256key),
    },
    key: { algorithm, aes256key, keyId, legacyIv: null },
  };
}

export async function importKeyFile(file, cryptoApi = globalThis.crypto) {
  if (!file?.algorithm?.name || !file?.key) {
    throw new Error("Invalid Drive encryption key file.");
  }
  if (
    file.version !== undefined &&
    file.version !== DRIVE_KEY_VERSION
  ) {
    throw new Error("Unsupported Drive encryption key file version.");
  }
  const algorithm = { name: file.algorithm.name };
  const aes256key = await cryptoApi.subtle.importKey(
    "jwk",
    file.key,
    algorithm,
    true,
    ["encrypt", "decrypt"]
  );
  const keyId = await getKeyId(aes256key, cryptoApi);
  if (file.keyId !== undefined && file.keyId !== keyId) {
    throw new Error("Drive encryption key ID does not match its key material.");
  }
  return {
    algorithm,
    aes256key,
    keyId,
    legacyIv: Array.isArray(file.algorithm.iv)
      ? Uint8Array.from(file.algorithm.iv)
      : null,
  };
}

export function normalizeKeyFile(file, { algorithm, keyId }) {
  if (!file?.key || !algorithm?.name || !keyId) {
    throw new Error("Cannot normalize an invalid Drive encryption key file.");
  }
  return {
    version: DRIVE_KEY_VERSION,
    keyId,
    algorithm: { name: algorithm.name },
    key: file.key,
  };
}

export function createDriveDataEnvelope(keyId, encryptedData) {
  return {
    format: DRIVE_DATA_FORMAT,
    version: DRIVE_DATA_VERSION,
    keyId,
    data: encryptedData,
  };
}

export function isDriveDataEnvelope(value) {
  return Boolean(
    value?.format === DRIVE_DATA_FORMAT &&
      value.version === DRIVE_DATA_VERSION &&
      typeof value.keyId === "string" &&
      Object.hasOwn(value, "data")
  );
}

export async function encryptJSON(
  value,
  { algorithm, aes256key },
  cryptoApi = globalThis.crypto
) {
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const encrypted = await cryptoApi.subtle.encrypt(
    { ...algorithm, iv },
    aes256key,
    new TextEncoder().encode(JSON.stringify(value))
  );
  return {
    version: DATA_ENCRYPTION_VERSION,
    algorithm: algorithm.name,
    iv: Array.from(iv),
    ciphertext: Array.from(new Uint8Array(encrypted)),
  };
}

export async function decryptJSON(
  data,
  { algorithm, aes256key, legacyIv },
  cryptoApi = globalThis.crypto
) {
  let iv;
  let ciphertext;
  if (Array.isArray(data)) {
    if (!legacyIv) {
      throw new Error("Legacy encrypted data is missing its initialization vector.");
    }
    iv = legacyIv;
    ciphertext = data;
  } else if (
    data?.version === DATA_ENCRYPTION_VERSION &&
    data.algorithm === algorithm.name &&
    Array.isArray(data.iv) &&
    Array.isArray(data.ciphertext)
  ) {
    iv = Uint8Array.from(data.iv);
    ciphertext = data.ciphertext;
  } else {
    throw new Error("Unsupported encrypted data format.");
  }

  const decrypted = await cryptoApi.subtle.decrypt(
    { ...algorithm, iv },
    aes256key,
    Uint8Array.from(ciphertext).buffer
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}
