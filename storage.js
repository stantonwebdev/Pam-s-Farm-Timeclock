// IndexedDB storage layer for Pam's Farm Time Clock

const DB_NAME = 'pamsfarm';
const DB_VERSION = 1;
let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('entries')) {
        const store = db.createObjectStore('entries', { keyPath: 'id', autoIncrement: true });
        store.createIndex('clockIn', 'clockIn');
        store.createIndex('weekStart', 'weekStart');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(storeName, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const store = t.objectStore(storeName);
    const req = fn(store);
    if (req && req.onsuccess !== undefined) {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } else {
      t.oncomplete = () => resolve(req ? req.result : undefined);
      t.onerror = () => reject(t.error);
    }
  }));
}

export function getSetting(key) {
  return tx('settings', 'readonly', s => s.get(key)).then(r => r ? r.value : null);
}

export function setSetting(key, value) {
  return tx('settings', 'readwrite', s => s.put({ key, value }));
}

export function clockIn(weekStart) {
  const entry = { clockIn: Date.now(), clockOut: null, notes: '', weekStart };
  return tx('entries', 'readwrite', s => s.add(entry));
}

export function clockOut(id, notes) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction('entries', 'readwrite');
    const store = t.objectStore('entries');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const entry = getReq.result;
      entry.clockOut = Date.now();
      entry.notes = notes || '';
      const putReq = store.put(entry);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  }));
}

export function getOpenEntry() {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction('entries', 'readonly');
    const store = t.objectStore('entries');
    const index = store.index('clockIn');
    const req = index.openCursor(null, 'prev');
    req.onsuccess = e => {
      const cursor = e.target.result;
      if (!cursor) { resolve(null); return; }
      if (cursor.value.clockOut === null) { resolve(cursor.value); }
      else { cursor.continue(); }
    };
    req.onerror = () => reject(req.error);
  }));
}

export function getEntriesForWeek(weekStartMs, weekEndMs) {
  const start = weekStartMs instanceof Date ? weekStartMs.getTime() : weekStartMs;
  const end = weekEndMs
    ? (weekEndMs instanceof Date ? weekEndMs.getTime() : weekEndMs)
    : start + 7 * 24 * 60 * 60 * 1000;
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction('entries', 'readonly');
    const store = t.objectStore('entries');
    const index = store.index('clockIn');
    const range = IDBKeyRange.bound(start, end, false, true);
    const req = index.getAll(range);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

export function addEntry(clockIn, clockOut, notes, weekStart) {
  const entry = {
    clockIn: clockIn instanceof Date ? clockIn.getTime() : clockIn,
    clockOut: clockOut ? (clockOut instanceof Date ? clockOut.getTime() : clockOut) : null,
    notes: notes || '',
    weekStart: weekStart instanceof Date ? weekStart.getTime() : weekStart,
  };
  return tx('entries', 'readwrite', s => s.add(entry));
}

export function updateEntry(id, clockIn, clockOut, notes) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction('entries', 'readwrite');
    const store = t.objectStore('entries');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const entry = { ...getReq.result, clockIn, clockOut, notes: notes || '' };
      const putReq = store.put(entry);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  }));
}

export function deleteEntry(id) {
  return tx('entries', 'readwrite', s => s.delete(id));
}
