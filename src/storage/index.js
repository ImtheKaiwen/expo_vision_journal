import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalDateString } from '../utils/journalDates';

export const KEYS = {
  JOURNAL: '@journal_entries',
  VISION: '@vision_notes',
  STREAK: '@streak_info',
  APP_SETTINGS: '@app_settings',
};

export const DEFAULT_APP_SETTINGS = {
  biometricEnabled: true, // Legacy compatibility, authMethod is main
  authMethod: 'biometric', // 'biometric' | 'pin' | 'none'
  pinCode: null,
  isOnboarded: false,
  language: 'tr',
  notificationHour: 9,
  notificationMinute: 0,
  userName: '',
};

export async function getAppSettings() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.APP_SETTINGS);
    if (!raw) return { ...DEFAULT_APP_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_APP_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

export async function saveAppSettings(partial) {
  const current = await getAppSettings();
  const next = { ...current, ...partial };
  await AsyncStorage.setItem(KEYS.APP_SETTINGS, JSON.stringify(next));
  return next;
}

export async function getJournalEntries() {
  const json = await AsyncStorage.getItem(KEYS.JOURNAL);
  if (json == null) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function setJournalEntries(entries) {
  await AsyncStorage.setItem(KEYS.JOURNAL, JSON.stringify(entries));
}

export async function getVisionNotes() {
  const json = await AsyncStorage.getItem(KEYS.VISION);
  if (json == null) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function setVisionNotes(visions) {
  await AsyncStorage.setItem(KEYS.VISION, JSON.stringify(visions));
}

export async function getStreak() {
  const json = await AsyncStorage.getItem(KEYS.STREAK);
  if (!json) return { count: 0, lastDate: null };
  try {
    return JSON.parse(json);
  } catch {
    return { count: 0, lastDate: null };
  }
}

export async function setStreak(streak) {
  await AsyncStorage.setItem(KEYS.STREAK, JSON.stringify(streak));
}

/** Günlük kaydedildiğinde seriyi günceller (aynı gün tekrar sayılmaz). */
export async function updateStreakOnJournalSave() {
  const today = getLocalDateString();
  const streak = await getStreak();
  if (streak.lastDate === today) return streak;
  const yestDate = new Date();
  yestDate.setDate(yestDate.getDate() - 1);
  const yesterdayStr = getLocalDateString(yestDate);
  let count = 1;
  if (streak.lastDate === yesterdayStr) count = (streak.count || 0) + 1;
  const next = { count, lastDate: today };
  await setStreak(next);
  return next;
}

export async function exportAllUserData() {
  const [journal, visions, streak, settings] = await Promise.all([
    getJournalEntries(),
    getVisionNotes(),
    getStreak(),
    getAppSettings(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    settings,
    journalEntries: journal,
    visionNotes: visions,
    streak,
  };
}

export async function clearAllData() {
  await AsyncStorage.multiRemove([
    KEYS.JOURNAL,
    KEYS.VISION,
    KEYS.STREAK,
    KEYS.APP_SETTINGS,
  ]);
}
