export const DATA_ENCRYPTION_VERSION = 2;

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
