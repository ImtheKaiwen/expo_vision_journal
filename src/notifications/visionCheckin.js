import * as Notifications from 'expo-notifications';
import { getVisionNotes, setVisionNotes } from '../storage';
import { allowsNotifications } from './dailyReminder';

const VISION_CHECKIN_ID_PREFIX = 'vision-checkin-';

/**
 * Aktif hedefi olan vizyonlar için gece bildirimi planlar.
 * Her gün saat 21:00'de "Bugün hedeflerini yaptın mı?" bildirim gönderir.
 */
export async function scheduleVisionCheckinNotification() {
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!allowsNotifications(perm)) return;

    // Eski vizyon checkin bildirimlerini iptal et
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.identifier?.startsWith(VISION_CHECKIN_ID_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }

    const visions = await getVisionNotes();
    const activeVisions = visions.filter(
      (v) => v.targetDays && v.targetDays > 0 && (v.dailyLog || []).length < v.targetDays
    );

    if (activeVisions.length === 0) return;

    const bodyList = activeVisions
      .slice(0, 3)
      .map((v) => `• ${v.title}`)
      .join('\n');
    const extra = activeVisions.length > 3 ? `\n… ve ${activeVisions.length - 3} diğer hedef` : '';

    await Notifications.scheduleNotificationAsync({
      identifier: `${VISION_CHECKIN_ID_PREFIX}daily`,
      content: {
        title: 'Bugün hedeflerini yaptın mı?',
        body: `${bodyList}${extra}\nAçıp puanını gir!`,
        data: { type: 'vision_checkin' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: 21,
        minute: 0,
        repeats: true,
      },
    });
  } catch (e) {
    console.warn('[visionCheckin] scheduleVisionCheckinNotification:', e?.message ?? e);
  }
}

/**
 * Vizyona günlük puan ekler.
 * @param {string} visionId
 * @param {number} score - 0 | 0.5 | 1
 * @returns {{ visions: Array, updatedVision: object | null }}
 */
export async function logVisionDailyScore(visionId, score) {
  const visions = await getVisionNotes();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let updatedVision = null;

  const updated = visions.map((v) => {
    if (v.id !== visionId) return v;
    const log = v.dailyLog || [];
    // Aynı gün tekrar giriş yapılmasını engelle
    const exists = log.find((d) => d.date === today);
    if (exists) {
      // Güncelle
      const newLog = log.map((d) => (d.date === today ? { ...d, score } : d));
      updatedVision = { ...v, dailyLog: newLog };
      return updatedVision;
    }
    const newLog = [...log, { date: today, score }];
    updatedVision = { ...v, dailyLog: newLog };
    return updatedVision;
  });

  await setVisionNotes(updated);
  // Hedefe ulaşıldıysa checkin bildirimini güncelle
  await scheduleVisionCheckinNotification();
  return { visions: updated, updatedVision };
}

/**
 * Bugün için zaten puan verilmiş mi kontrol eder.
 */
export function getTodayScore(vision) {
  if (!vision?.dailyLog) return null;
  const today = new Date().toISOString().slice(0, 10);
  const entry = vision.dailyLog.find((d) => d.date === today);
  return entry ? entry.score : null;
}
