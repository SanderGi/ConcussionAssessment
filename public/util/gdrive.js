// Functions for deleting, getting, and setting app data files in Google Drive.

let _fileIds = {};
async function getFileId(accessToken, filename) {
  if (_fileIds[filename]) return _fileIds[filename];

  const res = await fetch(
    "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  if (!res.ok) throw new Error(`Failed to find list of files.`);

  const files = await res.json();
  if (!files.files) return null;

  const file = files.files.find((file) => file.name === filename);
  _fileIds[filename] = file?.id;
  return file?.id;
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

export async function setAppDataFile(data, accessToken, filename) {
  const fileId = await getFileId(accessToken, filename);
  if (fileId) {
    updateAppDataFile(data, accessToken, filename);
  } else {
    createAppDataFile(data, accessToken, filename);
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
  if (!res.ok) throw new Error(`Failed to update ${filename}.`);

  const file = await res.json();
  _fileIds[filename] = file.id;
}

async function createAppDataFile(data, accessToken, filename) {
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
}
