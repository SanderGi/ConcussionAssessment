// Functions for deleting, getting, and setting app data files in Google Drive.

let _fileIds = {};

function escapeDriveQueryValue(value) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function listAppDataFiles(accessToken, filename) {
  const params = new URLSearchParams({
    spaces: "appDataFolder",
    pageSize: "1000",
    fields: "files(id,name,createdTime,modifiedTime)",
    q: `name = '${escapeDriveQueryValue(filename)}' and trashed = false`,
  });

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  if (!res.ok) throw new Error(`Failed to find list of files.`);

  const files = await res.json();
  const matches = (files.files ?? []).filter((file) => file.name === filename);
  matches.sort((a, b) =>
    String(b.modifiedTime ?? b.createdTime ?? "").localeCompare(
      String(a.modifiedTime ?? a.createdTime ?? "")
    )
  );
  if (matches[0]?.id) _fileIds[filename] = matches[0].id;
  else delete _fileIds[filename];
  return matches;
}

async function getFileId(accessToken, filename) {
  if (_fileIds[filename]) return _fileIds[filename];
  return (await listAppDataFiles(accessToken, filename))[0]?.id ?? null;
}

export function selectAppDataFile(filename, fileId) {
  if (fileId) _fileIds[filename] = fileId;
  else delete _fileIds[filename];
}

export async function deleteAppDataFile(accessToken, filename) {
  const fileId = await getFileId(accessToken, filename);
  if (!fileId) throw new Error("No data to delete.");

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  if (!res.ok) throw new Error(`Failed to delete ${filename}.`);

  delete _fileIds[filename];
}

export async function deleteAllAppDataFiles(accessToken, filename) {
  const files = await listAppDataFiles(accessToken, filename);
  for (const file of files) {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!res.ok && res.status !== 404) {
      throw new Error(`Failed to delete ${filename}.`);
    }
  }
  delete _fileIds[filename];
}

export async function getAppDataFile(accessToken, filename) {
  const fileId = await getFileId(accessToken, filename);
  if (!fileId) return null;

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  if (!res.ok) throw new Error(`Failed to fetch ${filename}.`);

  const file = await res.json();
  return file;
}

export async function getAppDataFileCandidates(accessToken, filename) {
  const files = await listAppDataFiles(accessToken, filename);
  const candidates = [];
  for (const file of files) {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!res.ok) continue;
    try {
      candidates.push({ ...file, data: await res.json() });
    } catch {
      // A malformed duplicate must not hide another recoverable copy.
    }
  }
  return candidates;
}

export async function setAppDataFile(data, accessToken, filename) {
  const fileId = await getFileId(accessToken, filename);
  if (fileId) {
    await updateAppDataFile(data, accessToken, filename);
  } else {
    await createAppDataFile(data, accessToken, filename);
  }
}

async function updateAppDataFile(data, accessToken, filename) {
  const fileId = await getFileId(accessToken, filename);
  if (!fileId) throw new Error("No file to update.");

  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) {
    if (res.status === 404) delete _fileIds[filename];
    throw new Error(`Failed to update ${filename}.`);
  }

  const file = await res.json();
  _fileIds[filename] = file.id;
}

export async function createAppDataFile(data, accessToken, filename) {
  const metadataRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: filename,
        parents: ["appDataFolder"],
        mimeType: "application/json",
      }),
    }
  );
  if (!metadataRes.ok) throw new Error(`Failed to create ${filename}.`);

  const uploadRes = await fetch(metadataRes.headers.get("Location"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!uploadRes.ok) throw new Error(`Failed to set content of ${filename}.`);

  const file = await uploadRes.json();
  _fileIds[filename] = file.id;
  return file;
}
