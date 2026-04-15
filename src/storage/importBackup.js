import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  KEYS,
  getJournalEntries,
  getVisionNotes,
  setJournalEntries,
  setVisionNotes,
  setStreak,
} from './index';

const DEFAULT_APP_SETTINGS = {
  biometricEnabled: true,
  notificationHour: 9,
  notificationMinute: 0,
};

function normalizeJournalEntries(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const e of arr) {
    if (!e || typeof e !== 'object') continue;
    if (typeof e.id !== 'string' || typeof e.text !== 'string' || typeof e.date !== 'string') continue;
    const row = { id: e.id, text: e.text, date: e.date };
    if (typeof e.createdAt === 'string') row.createdAt = e.createdAt;
    out.push(row);
  }
  return out;
}

function normalizeVisionNotes(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const e of arr) {
    if (!e || typeof e !== 'object') continue;
    if (typeof e.id !== 'string' || typeof e.title !== 'string' || typeof e.content !== 'string') continue;
    out.push({ id: e.id, title: e.title, content: e.content });
  }
  return out;
}

function normalizeStreak(s) {
  if (!s || typeof s !== 'object') return { count: 0, lastDate: null };
  const count = Number(s.count);
  const lastDate = s.lastDate == null ? null : String(s.lastDate);
  return {
    count: Number.isFinite(count) && count >= 0 ? count : 0,
    lastDate: lastDate || null,
  };
}

export function parseBackupJson(text) {
  if (!text || typeof text !== 'string') {
    return { ok: false, error: 'Dosya içeriği boş.' };
  }
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, error: 'Geçersiz JSON.' };
  }
}

export function validateBackupPayload(data) {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Yedek bir nesne olmalı.' };
  }
  if (data.version != null && typeof data.version !== 'number') {
    return { ok: false, error: 'version alanı geçersiz.' };
  }
  if (data.journalEntries != null && !Array.isArray(data.journalEntries)) {
    return { ok: false, error: 'journalEntries bir dizi olmalı.' };
  }
  if (data.visionNotes != null && !Array.isArray(data.visionNotes)) {
    return { ok: false, error: 'visionNotes bir dizi olmalı.' };
  }
  if (data.streak != null && (typeof data.streak !== 'object' || Array.isArray(data.streak))) {
    return { ok: false, error: 'streak nesnesi geçersiz.' };
  }
  if (data.settings != null && (typeof data.settings !== 'object' || Array.isArray(data.settings))) {
    return { ok: false, error: 'settings nesnesi geçersiz.' };
  }
  const hasAny =
    'journalEntries' in data ||
    'visionNotes' in data ||
    'streak' in data ||
    'settings' in data;
  if (!hasAny) {
    return { ok: false, error: 'Dosyada günlük, vizyon, seri veya ayarlardan en az bir alan olmalı.' };
  }
  return { ok: true };
}

function uniqueImportId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * @param {'merge' | 'replace'} mode
 * replace: dosyada bulunan her alan cihazdakiyle değiştirilir (eksik alan dokunulmaz).
 * merge: yalnızca günlük ve vizyon birleştirilir; seri ve ayarlar değişmez. Aynı id çakışırsa yeni id.
 */
export async function applyBackupImport(data, mode) {
  if (mode === 'replace') {
    let journalCount = 0;
    let visionCount = 0;
    let replacedStreak = false;
    let replacedSettings = false;

    if ('journalEntries' in data) {
      const j = normalizeJournalEntries(data.journalEntries);
      await setJournalEntries(j);
      journalCount = j.length;
    }
    if ('visionNotes' in data) {
      const v = normalizeVisionNotes(data.visionNotes);
      await setVisionNotes(v);
      visionCount = v.length;
    }
    if ('streak' in data) {
      await setStreak(normalizeStreak(data.streak));
      replacedStreak = true;
    }
    if ('settings' in data && data.settings && typeof data.settings === 'object') {
      const merged = { ...DEFAULT_APP_SETTINGS, ...data.settings };
      await AsyncStorage.setItem(KEYS.APP_SETTINGS, JSON.stringify(merged));
      replacedSettings = true;
    }
    return { mode: 'replace', journalCount, visionCount, replacedStreak, replacedSettings };
  }

  let journalAdded = 0;
  let visionAdded = 0;

  if ('journalEntries' in data && Array.isArray(data.journalEntries)) {
    const journalIn = normalizeJournalEntries(data.journalEntries);
    const existingJ = await getJournalEntries();
    const idJ = new Set(existingJ.map((x) => x.id));
    const mergedJ = [];
    for (const e of journalIn) {
      let row = { ...e };
      if (idJ.has(row.id)) {
        row = { ...row, id: uniqueImportId('j') };
      }
      idJ.add(row.id);
      mergedJ.push(row);
    }
    await setJournalEntries([...mergedJ, ...existingJ]);
    journalAdded = mergedJ.length;
  }

  if ('visionNotes' in data && Array.isArray(data.visionNotes)) {
    const visionIn = normalizeVisionNotes(data.visionNotes);
    const existingV = await getVisionNotes();
    const idV = new Set(existingV.map((x) => x.id));
    const mergedV = [];
    for (const e of visionIn) {
      let row = { ...e };
      if (idV.has(row.id)) {
        row = { ...row, id: uniqueImportId('v') };
      }
      idV.add(row.id);
      mergedV.push(row);
    }
    await setVisionNotes([...mergedV, ...existingV]);
    visionAdded = mergedV.length;
  }

  return { mode: 'merge', journalAdded, visionAdded };
}
