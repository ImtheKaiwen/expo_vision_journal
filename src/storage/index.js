import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalDateString } from '../utils/journalDates';

export const KEYS = {
  JOURNAL: '@journal_entries',
  VISION: '@vision_notes',
  STREAK: '@streak_info',
  APP_SETTINGS: '@app_settings',
  TODO: '@todo_entries',
  AUDIO: '@audio_entries',
  VIDEO: '@video_entries',
  NUTRITION_SETTINGS: '@nutrition_settings',
  MEAL_LOGS: '@meal_logs',
  WATER_LOGS: '@water_logs',
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

export async function getTodoEntries() {
  const json = await AsyncStorage.getItem(KEYS.TODO);
  if (json == null) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function setTodoEntries(todos) {
  await AsyncStorage.setItem(KEYS.TODO, JSON.stringify(todos));
}

export async function getAudioEntries() {
  const json = await AsyncStorage.getItem(KEYS.AUDIO);
  if (json == null) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function setAudioEntries(audios) {
  await AsyncStorage.setItem(KEYS.AUDIO, JSON.stringify(audios));
}

export async function getVideoEntries() {
  const json = await AsyncStorage.getItem(KEYS.VIDEO);
  if (json == null) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function setVideoEntries(videos) {
  await AsyncStorage.setItem(KEYS.VIDEO, JSON.stringify(videos));
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
    KEYS.TODO,
    KEYS.AUDIO,
    KEYS.VIDEO,
    KEYS.NUTRITION_SETTINGS,
    KEYS.MEAL_LOGS,
    KEYS.WATER_LOGS,
  ]);
}

/** BESLENME (NUTRITION) STORAGE **/

export const DEFAULT_NUTRITION_SETTINGS = {
  isOnboarded: false,
  gender: 'male', // male | female
  age: 25,
  weight: 70,
  height: 175,
  activityLevel: 'moderate', // sedentary | light | moderate | active | very_active
  goal: 'maintain', // lose | maintain | gain
  waterGoal: 2500, // ml
  targets: {
    calories: 2000,
    protein: 150,
    carbs: 250,
    fat: 70
  }
};

export async function getNutritionSettings() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.NUTRITION_SETTINGS);
    if (!raw) return { ...DEFAULT_NUTRITION_SETTINGS };
    return { ...DEFAULT_NUTRITION_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_NUTRITION_SETTINGS };
  }
}

export async function saveNutritionSettings(partial) {
  const current = await getNutritionSettings();
  const next = { ...current, ...partial };
  await AsyncStorage.setItem(KEYS.NUTRITION_SETTINGS, JSON.stringify(next));
  return next;
}

export async function getMealLogs() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.MEAL_LOGS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addMealLog(meal) {
  const logs = await getMealLogs();
  const newMeal = { ...meal, id: meal.id || Date.now().toString() };
  const next = [newMeal, ...logs];
  await AsyncStorage.setItem(KEYS.MEAL_LOGS, JSON.stringify(next));
  return next;
}

export async function deleteMealLog(id) {
  const logs = await getMealLogs();
  const next = logs.filter(m => m.id !== id);
  await AsyncStorage.setItem(KEYS.MEAL_LOGS, JSON.stringify(next));
  return next;
}

export async function getWaterLogs() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.WATER_LOGS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function updateWaterLog(date, amount) {
  const logs = await getWaterLogs();
  const current = logs[date] || 0;
  const next = { ...logs, [date]: Math.max(0, current + amount) };
  await AsyncStorage.setItem(KEYS.WATER_LOGS, JSON.stringify(next));
  return next;
}
