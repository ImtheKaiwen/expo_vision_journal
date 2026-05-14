import { InteractionManager } from 'react-native';
import * as Notifications from 'expo-notifications';
import { IosAuthorizationStatus } from 'expo-notifications';
import { getAppSettings } from '../storage';
import { getLocalDateString } from '../utils/journalDates';

const MOTIVATIONAL_QUOTES = {
  tr: [
    "Dün yaptığın şey bugün olduğun kişiyi belirler.",
    "Gelecek, bugünden ona hazırlananlara aittir.",
    "Zorluklar, başarıya giden merdiven basamaklarıdır.",
    "Bugün hayallerine bir adım daha yaklaşmak için harika bir gün.",
    "Büyük işler, küçük ama istikrarlı adımlarla başarılır.",
    "Yolculuğun kendisi ödüldür.",
    "Kendine inanmak, başarının ilk kuralıdır."
  ],
  en: [
    "What you do today determines who you become tomorrow.",
    "The future belongs to those who prepare for it today.",
    "Challenges are the stepping stones to success.",
    "Today is a great day to move one step closer to your dreams.",
    "Great things are achieved by small but consistent steps.",
    "The journey is the reward.",
    "Believing in yourself is the first step to success."
  ]
};

/** iOS’ta `granted` bazen yetersiz; provisional / ephemeral de planlamaya izin verir. */
export function allowsNotifications(status) {
  if (!status) return false;
  if (status.granted) return true;
  const ios = status.ios?.status;
  if (ios === IosAuthorizationStatus.AUTHORIZED) return true;
  if (ios === IosAuthorizationStatus.PROVISIONAL) return true;
  if (ios === IosAuthorizationStatus.EPHEMERAL) return true;
  return false;
}

const PERMISSION_REQUEST = {
  ios: {
    allowAlert: true,
    allowBadge: true,
    allowSound: true,
  },
  android: {},
};

/**
 * Sistem izin penceresinin üstüne başka bir modal binmesin diye,
 * kullanıcı etkileşiminden hemen sonra kısa gecikmeyle istek atar.
 */
function deferToNextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

/**
 * Önce mevcut izni okur; yoksa kullanıcıya sistem diyaloğunu gösterir.
 * Android’de `android: {}` verilmezse istek bazen hiç tetiklenmez.
 */
export async function requestNotificationPermissionsFromUser() {
  await deferToNextFrame();
  await new Promise((resolve) => InteractionManager.runAfterInteractions(() => resolve()));

  let current = await Notifications.getPermissionsAsync();
  if (allowsNotifications(current)) {
    return { ...current, granted: true, alreadyHadPermission: true };
  }

  const requested = await Notifications.requestPermissionsAsync(PERMISSION_REQUEST);
  const granted = allowsNotifications(requested);
  return { ...requested, granted, alreadyHadPermission: false };
}

async function scheduleDailyFromSettings(settings) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  
  const lang = settings.language || 'tr';
  const quotesEnabled = settings.motivationalNotifsEnabled;
  const morningHour = settings.notificationHour ?? 9;
  const morningMinute = settings.notificationMinute ?? 0;

  // Morning Notification
  await scheduleSingleNotification(morningHour, morningMinute, lang, quotesEnabled);
  
  // Lunch Notification (13:00)
  await scheduleTypeNotification(13, 0, lang, 'lunch');

  // Water Notification (16:00)
  await scheduleTypeNotification(16, 0, lang, 'water');

  // Dinner Notification (20:00)
  await scheduleTypeNotification(20, 0, lang, 'dinner');

  // Weekly Weight Notification (Saturday 10:00 AM)
  const today = new Date();
  if (today.getDay() === 6) { // Saturday
    await scheduleTypeNotification(10, 0, lang, 'weight');
  }

  // Evening Notification (Fixed at 21:00)
  await scheduleSingleNotification(21, 0, lang, quotesEnabled);
}

async function scheduleTypeNotification(hour, minute, lang, type) {
  let title = '';
  let body = '';

  if (type === 'lunch') {
    title = t_alt('notifLunchTitle', lang);
    body = t_alt('notifLunchBody', lang);
  } else if (type === 'water') {
    title = t_alt('notifWaterTitle', lang);
    body = t_alt('notifWaterBody', lang);
  } else if (type === 'dinner') {
    title = t_alt('notifDinnerTitle', lang);
    body = t_alt('notifDinnerBody', lang);
  } else if (type === 'weight') {
    title = t_alt('notifWeightTitle', lang);
    body = t_alt('notifWeightBody', lang);
  }

  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour,
      minute,
      repeats: true,
    },
  });
}

/** Helper for translations in notifications (since we can't use useI18n hook here) */
function t_alt(key, lang) {
  const tr = {
    notifLunchTitle: 'Öğle Yemeği Vakti',
    notifLunchBody: 'Yemeğinin fotoğrafını çekmeyi veya analiz etmeyi unutma!',
    notifWaterTitle: 'Su Hatırlatıcı',
    notifWaterBody: 'Vücudunun suya ihtiyacı var. Bir bardak su içmeye ne dersin?',
    notifDinnerTitle: 'Akşam Yemeği Vakti',
    notifDinnerBody: 'Günün son öğününü kaydetmeyi ve analiz etmeyi unutma.',
    notifWeightTitle: 'Kilo Takibi Vakti',
    notifWeightBody: 'Haftalık kilonu güncelleyerek ilerlemeni takip etmeye ne dersin?',
  };
  const en = {
    notifLunchTitle: 'Lunch Time',
    notifLunchBody: 'Don\'t forget to take a photo or analyze your meal!',
    notifWaterTitle: 'Water Reminder',
    notifWaterBody: 'Your body needs water. How about a glass of water?',
    notifDinnerTitle: 'Dinner Time',
    notifDinnerBody: 'Don\'t forget to log and analyze your last meal of the day.',
    notifWeightTitle: 'Weight Tracking Time',
    notifWeightBody: 'How about tracking your progress by updating your weekly weight?',
  };
  const dict = lang === 'en' ? en : tr;
  return dict[key] || key;
}

async function scheduleSingleNotification(hour, minute, lang, quotesEnabled) {
  let title = lang === 'en' ? 'Vision Time' : 'Vizyon Vakti';
  let body = lang === 'en' ? 'Remember who you want to be today, read your notes.' : 'Bugün olmak istediğin kişiyi hatırla, notlarını oku.';
  
  if (quotesEnabled) {
    const quotes = MOTIVATIONAL_QUOTES[lang] || MOTIVATIONAL_QUOTES['tr'];
    body = quotes[Math.floor(Math.random() * quotes.length)];
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour,
      minute,
      repeats: true,
    },
  });
}

export async function rescheduleDailyNotificationsIfGranted() {
  try {
    const settings = await getAppSettings();
    const perm = await Notifications.getPermissionsAsync();
    if (!allowsNotifications(perm)) return { granted: false, scheduled: false };
    await scheduleDailyFromSettings(settings);
    return { granted: true, scheduled: true };
  } catch (e) {
    console.warn('[notifications] rescheduleDailyNotificationsIfGranted:', e?.message ?? e);
    return { granted: false, scheduled: false, error: e };
  }
}

export async function syncScheduledNotificationsFromSettings() {
  try {
    const settings = await getAppSettings();
    const result = await requestNotificationPermissionsFromUser();
    if (!allowsNotifications(result)) {
      return {
        granted: false,
        canAskAgain: result.canAskAgain !== false,
        status: result.status,
      };
    }
    await scheduleDailyFromSettings(settings);
    return { granted: true };
  } catch (e) {
    console.warn('[notifications] syncScheduledNotificationsFromSettings:', e?.message ?? e);
    return { granted: false, error: e };
  }
}

export async function scheduleTestNotificationInSeconds(seconds = 2) {
  try {
    const result = await requestNotificationPermissionsFromUser();
    if (!allowsNotifications(result)) {
      return { ok: false, reason: 'permission', canAskAgain: result.canAskAgain !== false };
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Test bildirimi',
        body: 'Bildirimler çalışıyor. Bu mesajı Ayarlar üzerinden test ettin.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
      },
    });
    return { ok: true };
  } catch (e) {
    console.warn('[notifications] scheduleTestNotificationInSeconds:', e?.message ?? e);
    return { ok: false, reason: 'error', error: e };
  }
}
