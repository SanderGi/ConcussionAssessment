const encryption_type = "AES-GCM"; // we encrypt the data to be prepared to store it somewhere else in the future and only keep the key secure (locally and in GDrive for syncing)

let _fileId = null;
async function getFileId(user) {
  if (_fileId) return _fileId;

  const res = await fetch(
    "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder",
    {
      headers: {
        Authorization: `Bearer ${user.credential.accessToken}`,
      },
    }
  );
  if (!res.ok) throw new Error("Failed to get data.");
  const files = await res.json();
  if (!files.files) return null;
  const file = files.files.find((file) => file.name === "config.json");
  _fileId = file?.id;
  return _fileId;
}

export async function deleteAppDataFile(user) {
  const fileId = await getFileId(user);
  if (!fileId) throw new Error("No data to delete.");

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${user.credential.accessToken}`,
      },
    }
  );
  if (!res.ok) throw new Error("Failed to delete data.");
}

let _aes256Key = null;
let _algorithm = null;
export async function getAppDataFile(user) {
  const fileId = await getFileId(user);
  if (!fileId) return {};

  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${user.credential.accessToken}`,
        },
      }
    );
    if (!res.ok) throw new Error("Failed to get data.");
    const file = await res.json();
    _algorithm = file.algorithm;
    _aes256Key = await window.crypto.subtle.importKey(
      "jwk",
      file.key,
      _algorithm,
      true,
      ["encrypt", "decrypt"]
    );
    const decrypted = await window.crypto.subtle.decrypt(
      _algorithm,
      _aes256Key,
      file.data
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch (err) {
    console.error(err);
    return {};
  }
}

export async function putAppDataFile(data, user) {
  const fileId = await getFileId(user);
  if (fileId) {
    updateAppDataFile(data, user);
  } else {
    createAppDataFile(data, user);
  }
}

async function updateAppDataFile(data, user) {
  const fileId = await getFileId(user);
  if (!fileId) throw new Error("No file to update.");
  if (!_aes256Key || !_algorithm) {
    await getAppDataFile(user);
    if (!_aes256Key || !_algorithm) throw new Error("Failed to update data.");
  }

  const dataString = JSON.stringify(data);
  const encrypted = await window.crypto.subtle.encrypt(
    _algorithm,
    _aes256Key,
    new TextEncoder().encode(dataString)
  );

  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${user.credential.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        _algorithm,
        key: await window.crypto.subtle.exportKey("jwk", _aes256Key),
        data: encrypted,
      }),
    }
  );
  if (!res.ok) throw new Error("Failed to sync data.");
  const file = await res.json();
  _fileId = file.id;
}

async function createAppDataFile(data, user) {
  _aes256Key = await window.crypto.subtle.generateKey(
    {
      name: encryption_type,
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
  const dataString = JSON.stringify(data);
  const iv = window.crypto.getRandomValues(new Uint8Array(96));
  _algorithm = {
    name: encryption_type,
    iv,
  };
  const encrypted = await window.crypto.subtle.encrypt(
    _algorithm,
    _aes256Key,
    new TextEncoder().encode(dataString)
  );
  const metadataRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user.credential.accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "config.json",
        parents: ["appDataFolder"],
        mimeType: "application/json",
      }),
    }
  );
  if (!metadataRes.ok) throw new Error("Failed to sync data.");
  const uploadRes = await fetch(metadataRes.headers.get("Location"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      _algorithm,
      key: await window.crypto.subtle.exportKey("jwk", _aes256Key),
      data: encrypted,
    }),
  });
  if (!uploadRes.ok) throw new Error("Failed to sync data.");
  const file = await uploadRes.json();
  _fileId = file.id;
}
