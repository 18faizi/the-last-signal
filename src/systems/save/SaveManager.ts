/**
 * Persistent Save Manager for The Last Signal.
 *
 * Implements resilient storage using IndexedDB with automated fallback to
 * localStorage and in-memory storage.
 */
import type { SaveSnapshot, SaveMetadata } from './schema';
import { migrateSaveSnapshot } from './schema';

const DB_NAME = 'the-last-signal-saves';
const STORE_NAME = 'saves';
const DB_VERSION = 1;
const LOCAL_STORAGE_PREFIX = 'tls_save_';

export class SaveManager {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private readonly memoryStore = new Map<string, string>();
  private useLocalStorageOnly = false;

  constructor() {
    this.initDb();
  }

  private initDb(): void {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      this.useLocalStorageOnly = true;
      return;
    }

    this.dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'slotId' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          this.useLocalStorageOnly = true;
          resolve(null);
        };
      } catch {
        this.useLocalStorageOnly = true;
        resolve(null);
      }
    });
  }

  /**
   * Persists a save snapshot into storage.
   */
  async saveGame(slotId: string, snapshot: SaveSnapshot): Promise<boolean> {
    const record = { slotId, snapshot, metadata: snapshot.metadata };
    const serialized = JSON.stringify(record);

    // 1. Try IndexedDB
    if (!this.useLocalStorageOnly && this.dbPromise) {
      try {
        const db = await this.dbPromise;
        if (db) {
          const success = await new Promise<boolean>((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const putReq = store.put(record);
            putReq.onsuccess = () => resolve(true);
            putReq.onerror = () => resolve(false);
          });
          if (success) {
            // Mirror to fallback for redundancy
            this.writeFallback(slotId, serialized);
            return true;
          }
        }
      } catch {
        // Fall back to secondary storage
      }
    }

    // 2. Fallback Storage (localStorage / memory)
    return this.writeFallback(slotId, serialized);
  }

  /**
   * Retrieves and migrates a save snapshot from storage.
   */
  async loadGame(slotId: string): Promise<SaveSnapshot | null> {
    // 1. Try IndexedDB
    if (!this.useLocalStorageOnly && this.dbPromise) {
      try {
        const db = await this.dbPromise;
        if (db) {
          const record = await new Promise<{ snapshot?: unknown } | null>((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const getReq = store.get(slotId);
            getReq.onsuccess = () => {
              const res = getReq.result as { snapshot?: unknown } | undefined;
              resolve(res ?? null);
            };
            getReq.onerror = () => resolve(null);
          });

          if (record && record.snapshot) {
            return migrateSaveSnapshot(record.snapshot);
          }
        }
      } catch {
        // Fall back to secondary storage
      }
    }

    // 2. Fallback Storage
    const serialized = this.readFallback(slotId);
    if (!serialized) return null;

    try {
      const parsed = JSON.parse(serialized) as { snapshot?: unknown };
      if (!parsed || !parsed.snapshot) return null;
      return migrateSaveSnapshot(parsed.snapshot);
    } catch {
      return null;
    }
  }

  /**
   * Lists all available save metadata across storage tiers.
   */
  async listSaves(): Promise<SaveMetadata[]> {
    const results = new Map<string, SaveMetadata>();

    // 1. Read from IndexedDB
    if (!this.useLocalStorageOnly && this.dbPromise) {
      try {
        const db = await this.dbPromise;
        if (db) {
          const records = await new Promise<Array<{ slotId: string; metadata: SaveMetadata }>>(
            (resolve) => {
              const tx = db.transaction(STORE_NAME, 'readonly');
              const store = tx.objectStore(STORE_NAME);
              const getAllReq = store.getAll();
              getAllReq.onsuccess = () => resolve(getAllReq.result ?? []);
              getAllReq.onerror = () => resolve([]);
            },
          );

          for (const rec of records) {
            if (rec && rec.metadata) {
              results.set(rec.slotId, rec.metadata);
            }
          }
        }
      } catch {
        // Continue to fallback
      }
    }

    // 2. Read from localStorage fallback
    if (typeof localStorage !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(LOCAL_STORAGE_PREFIX)) {
            const slotId = key.slice(LOCAL_STORAGE_PREFIX.length);
            if (!results.has(slotId)) {
              const val = localStorage.getItem(key);
              if (val) {
                const parsed = JSON.parse(val) as { metadata?: SaveMetadata };
                if (parsed?.metadata) {
                  results.set(slotId, parsed.metadata);
                }
              }
            }
          }
        }
      } catch {
        // Ignore localStorage access failures
      }
    }

    // 3. Read from in-memory fallback
    for (const [key, val] of this.memoryStore.entries()) {
      const slotId = key.slice(LOCAL_STORAGE_PREFIX.length);
      if (!results.has(slotId)) {
        try {
          const parsed = JSON.parse(val) as { metadata?: SaveMetadata };
          if (parsed?.metadata) {
            results.set(slotId, parsed.metadata);
          }
        } catch {
          // Ignore
        }
      }
    }

    return Array.from(results.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Deletes a save slot from all storage tiers.
   */
  async deleteSave(slotId: string): Promise<void> {
    // 1. Delete from IndexedDB
    if (!this.useLocalStorageOnly && this.dbPromise) {
      try {
        const db = await this.dbPromise;
        if (db) {
          await new Promise<void>((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(slotId);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
          });
        }
      } catch {
        // Continue to fallback
      }
    }

    // 2. Delete from fallbacks
    const fallbackKey = `${LOCAL_STORAGE_PREFIX}${slotId}`;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(fallbackKey);
      } catch {
        // Ignore
      }
    }
    this.memoryStore.delete(fallbackKey);
  }

  /**
   * Checks whether a save slot exists.
   */
  async hasSave(slotId: string): Promise<boolean> {
    const list = await this.listSaves();
    return list.some((s) => s.slotId === slotId);
  }

  private writeFallback(slotId: string, data: string): boolean {
    const key = `${LOCAL_STORAGE_PREFIX}${slotId}`;
    let saved = false;

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, data);
        saved = true;
      } catch {
        // LocalStorage quota or access error -> fallback to memory
      }
    }

    this.memoryStore.set(key, data);
    return saved || true;
  }

  private readFallback(slotId: string): string | null {
    const key = `${LOCAL_STORAGE_PREFIX}${slotId}`;
    if (typeof localStorage !== 'undefined') {
      try {
        const item = localStorage.getItem(key);
        if (item !== null) return item;
      } catch {
        // Fallback to memory
      }
    }
    return this.memoryStore.get(key) ?? null;
  }
}
