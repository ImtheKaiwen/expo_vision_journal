import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  KEYS,
  getJournalEntries,
  getVisionNotes,
  setJournalEntries,
  setVisionNotes,
  setStreak,
  DEFAULT_APP_SETTINGS,
} from './index';

function normalizeJournalEntries(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const e of arr) {
    if (!e || typeof e !== 'object') continue;
    // Gevşek kontrol: zorunlu alanlar var mı?
    if (e.id == null || e.text == null || e.date == null) continue;
    const row = { 
      id: String(e.id), 
      text: String(e.text), 
      date: String(e.date) 
    };
    if (e.createdAt != null) row.createdAt = String(e.createdAt);
    out.push(row);
  }
  return out;
}

function normalizeVisionNotes(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const e of arr) {
    if (!e || typeof e !== 'object') continue;
    if (e.id == null || e.title == null || e.content == null) continue;
    const row = { 
      id: String(e.id), 
      title: String(e.title), 
      content: String(e.content),
      targetDays: Number(e.targetDays) || 0,
      dailyLog: Array.isArray(e.dailyLog) ? e.dailyLog : [],
    };
    out.push(row);
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

  // MERGE MODE
  let journalAdded = 0;
  let journalSkipped = 0;
  let visionAdded = 0;
  let visionSkipped = 0;

  if ('journalEntries' in data && Array.isArray(data.journalEntries)) {
    const journalIn = normalizeJournalEntries(data.journalEntries);
    const existingJ = await getJournalEntries();
    
    // Create a fingerprint set for fast deduplication: "date|text"
    const fingerprints = new Set(existingJ.map(x => `${x.date}|${x.text.trim()}`));
    const existingIds = new Set(existingJ.map(x => x.id));
    
    const toAdd = [];
    for (const e of journalIn) {
      const fp = `${e.date}|${e.text.trim()}`;
      if (fingerprints.has(fp)) {
        journalSkipped++;
        continue;
      }
      
      let row = { ...e };
      if (existingIds.has(row.id)) {
        row.id = uniqueImportId('j');
      }
      
      existingIds.add(row.id);
      fingerprints.add(fp);
      toAdd.push(row);
    }
    
    // COMBINE & SORT: Date descending, then createdAt descending
    const finalJ = [...toAdd, ...existingJ].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    await setJournalEntries(finalJ);
    journalAdded = toAdd.length;
  }

  if ('visionNotes' in data && Array.isArray(data.visionNotes)) {
    const visionIn = normalizeVisionNotes(data.visionNotes);
    const existingV = await getVisionNotes();
    
    const fingerprints = new Set(existingV.map(x => `${x.title.trim()}|${x.content.trim()}`));
    const existingIds = new Set(existingV.map(x => x.id));
    
    const toAdd = [];
    for (const e of visionIn) {
      const fp = `${e.title.trim()}|${e.content.trim()}`;
      if (fingerprints.has(fp)) {
        visionSkipped++;
        continue;
      }
      
      let row = { ...e };
      if (existingIds.has(row.id)) {
        row.id = uniqueImportId('v');
      }
      
      existingIds.add(row.id);
      fingerprints.add(fp);
      toAdd.push(row);
    }
    
    await setVisionNotes([...toAdd, ...existingV]);
    visionAdded = toAdd.length;
  }

  return { mode: 'merge', journalAdded, journalSkipped, visionAdded, visionSkipped };
}
