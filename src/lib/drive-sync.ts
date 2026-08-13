'use client';

/**
 * Google Drive appDataFolder sync layer.
 * Persists a single JSON snapshot (saas_store_db.json) inside the app's
 * private, hidden appDataFolder — never touches the user's visible Drive files.
 */

const FILE_NAME = 'saas_store_db.json';
const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3/files';
const FILES_BASE = 'https://www.googleapis.com/drive/v3/files';

async function findFileId(accessToken: string): Promise<string | null> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name='${FILE_NAME}'`,
    fields: 'files(id, name)',
  });
  const res = await fetch(`${FILES_BASE}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Erro ao consultar o Google Drive');
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

export async function downloadStoreFile(accessToken: string): Promise<any | null> {
  const fileId = await findFileId(accessToken);
  if (!fileId) return null;
  const res = await fetch(`${FILES_BASE}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Erro ao baixar dados do Google Drive');
  return res.json();
}

export async function uploadStoreFile(accessToken: string, jsonData: unknown): Promise<void> {
  const fileId = await findFileId(accessToken);
  const boundary = '-------saasvenda' + Date.now();
  const metadata = fileId
    ? { name: FILE_NAME }
    : { name: FILE_NAME, parents: ['appDataFolder'] };

  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(jsonData) +
    `\r\n--${boundary}--`;

  const url = fileId
    ? `${UPLOAD_BASE}/${fileId}?uploadType=multipart`
    : `${UPLOAD_BASE}?uploadType=multipart`;

  const res = await fetch(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro ao sincronizar com o Google Drive: ${text}`);
  }
}
