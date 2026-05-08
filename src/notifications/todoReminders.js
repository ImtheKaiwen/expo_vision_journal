import * as Notifications from 'expo-notifications';
import { allowsNotifications } from './dailyReminder';

/**
 * Metin içinden saati ayıklar (09:00, 9.00 vb.)
 */
export const extractTimeFromText = (text) => {
  const timeRegex = /\b(\d{1,2})[:.](\d{2})\b/;
  const match = text.match(timeRegex);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      return { hours, minutes };
    }
  }
  return null;
};

/**
 * Görev için 30 dakika öncesine hatırlatıcı kurar
 */
export const scheduleTodoReminder = async (todo) => {
  // Önce AI'dan gelen hazır saati kullan, yoksa metinden ayıklamaya çalış (fallback)
  let time = null;
  if (todo.time) {
    const parts = todo.time.split(/[:.]/);
    time = { hours: parseInt(parts[0], 10), minutes: parseInt(parts[1], 10) };
  } else {
    time = extractTimeFromText(todo.text);
  }

  if (!time) return null;

  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!allowsNotifications(perm)) return null;

    const [year, month, day] = todo.date.split('-').map(Number);
    const triggerDate = new Date(year, month - 1, day, time.hours, time.minutes);
    
    // Normalde 30 dakika öncesine kur
    let reminderDate = new Date(triggerDate.getTime() - 30 * 60000);

    const now = new Date();
    
    // Eğer görev saati zaten geçtiyse kurma
    if (triggerDate <= now) return null;

    // Eğer 30 dakika öncesi geçmişte kaldıysa (yani görev 30 dk'dan yakınsa), 
    // hemen 1 dakika sonrasına hatırlatıcı kur.
    if (reminderDate <= now) {
      reminderDate = new Date(now.getTime() + 60000); // 1 dk sonra
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Görev Hatırlatıcı',
        body: `Vaktin yaklaşıyor: ${todo.text}`,
        data: { todoId: todo.id },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
      },
    });

    return identifier;
  } catch (error) {
    console.warn('[notifications] scheduleTodoReminder error:', error);
    return null;
  }
};

/**
 * Belirli bir bildirimi iptal eder
 */
export const cancelTodoReminder = async (notificationId) => {
  if (!notificationId) {
    console.log('[notifications] cancelTodoReminder: ID boş, işlem yapılmadı.');
    return;
  }
  try {
    console.log('[notifications] İptal ediliyor ID:', notificationId);
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log('[notifications] İptal başarılı.');
  } catch (error) {
    console.warn('[notifications] cancelTodoReminder error:', error);
  }
};
