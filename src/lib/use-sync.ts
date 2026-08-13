'use client';

import { useCallback } from 'react';
import { db, exportDbToJson, importDbFromJson, seedDefaultAdmin } from './db';
import { downloadStoreFile, uploadStoreFile } from './drive-sync';
import { useAuthStore, useSyncStore } from './store';

/**
 * Orchestrates local-first sync: IndexedDB is always the source of truth for
 * reads/writes; this hook pushes/pulls a JSON snapshot to the Drive
 * appDataFolder in the background.
 */
export function useSync() {
  const { setStatus, markSynced } = useSyncStore();
  const accessToken = useAuthStore((s) => s.accessToken);

  const pullFromDrive = useCallback(
    async (email: string, name: string) => {
      if (!accessToken) return;
      setStatus('syncing');
      try {
        const remote = await downloadStoreFile(accessToken);
        if (remote) {
          await importDbFromJson(remote);
        } else {
          await seedDefaultAdmin(email, name);
          const snapshot = await exportDbToJson();
          await uploadStoreFile(accessToken, snapshot);
        }
        markSynced();
      } catch (err) {
        console.error(err);
        setStatus('error');
      }
    },
    [accessToken, setStatus, markSynced]
  );

  const pushToDrive = useCallback(async () => {
    if (!accessToken) {
      setStatus('offline');
      return;
    }
    setStatus('syncing');
    try {
      const snapshot = await exportDbToJson();
      await uploadStoreFile(accessToken, snapshot);
      markSynced();
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  }, [accessToken, setStatus, markSynced]);

  const exportBackup = useCallback(async () => {
    const snapshot = await exportDbToJson();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return { pullFromDrive, pushToDrive, exportBackup };
}

export { db };
