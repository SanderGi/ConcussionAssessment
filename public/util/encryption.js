export const DATA_ENCRYPTION_VERSION = 2;
export const DRIVE_BUNDLE_VERSION = 1;

export async function createKeyFile(cryptoApi = globalThis.crypto) {
  const algorithm = { name: "AES-GCM" };
  const aes256key = await cryptoApi.subtle.generateKey(
    { ...algorithm, length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  return {
    file: {
      algorithm: { name: algorithm.name },
      key: await cryptoApi.subtle.exportKey("jwk", aes256key),
    },
    key: { algorithm, aes256key, legacyIv: null },
  };
}

export async function importKeyFile(file, cryptoApi = globalThis.crypto) {
  if (!file?.algorithm?.name || !file?.key) {
    throw new Error("Invalid Drive encryption key file.");
  }
  const algorithm = { name: file.algorithm.name };
  const aes256key = await cryptoApi.subtle.importKey(
    "jwk",
    file.key,
    algorithm,
    true,
    ["encrypt", "decrypt"]
  );
  return {
    algorithm,
    aes256key,
    legacyIv: Array.isArray(file.algorithm.iv)
      ? Uint8Array.from(file.algorithm.iv)
      : null,
  };
}

export function createDriveBundle(keyFile, encryptedData) {
  return {
    version: DRIVE_BUNDLE_VERSION,
    key: keyFile,
    data: encryptedData,
  };
}

export function isDriveBundle(value) {
  return Boolean(
    value?.version === DRIVE_BUNDLE_VERSION &&
      value.key &&
      value.data
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
