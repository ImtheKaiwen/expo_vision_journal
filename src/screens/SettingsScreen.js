import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Share,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { getAppSettings, saveAppSettings, exportAllUserData, clearAllData } from '../storage';
import { parseBackupJson, validateBackupPayload, applyBackupImport } from '../storage/importBackup';
import {
  allowsNotifications,
  requestNotificationPermissionsFromUser,
  syncScheduledNotificationsFromSettings,
  scheduleTestNotificationInSeconds,
} from '../notifications/dailyReminder';
import { emitAppSettingsChanged } from '../events/appSettings';
import { useI18n } from '../utils/i18n';

function permissionStatusLabel(perm) {
  if (!perm) return 'Yükleniyor…';
  if (allowsNotifications(perm)) return 'Durum: Bildirimlere izin verildi';
  if (perm.status === 'denied') return 'Durum: Reddedildi veya sistemde kapalı';
  return 'Durum: Henüz izin sorulmadı';
}

const isExpoGo = Constants.appOwnership === 'expo';

export default function SettingsScreen() {
  const { t, langCode, changeLanguage } = useI18n();
  const isFocused = useIsFocused();
  const [authMethod, setAuthMethod] = useState('none');
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [setupPinValue, setSetupPinValue] = useState('');
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [notifPerm, setNotifPerm] = useState(null);
  const [motivationalNotifsEnabled, setMotivationalNotifsEnabled] = useState(false);
  const [importMode, setImportMode] = useState('merge');

  const refreshNotificationPermission = useCallback(async () => {
    try {
      const p = await Notifications.getPermissionsAsync();
      setNotifPerm(p);
    } catch {
      setNotifPerm(null);
    }
  }, []);

  const load = useCallback(async () => {
    const s = await getAppSettings();
    let method = s.authMethod;
    if (!method) method = s.biometricEnabled === false ? 'none' : 'biometric';
    setAuthMethod(method);
    setHour(typeof s.notificationHour === 'number' ? s.notificationHour : 9);
    setMinute(typeof s.notificationMinute === 'number' ? s.notificationMinute : 0);
    setMotivationalNotifsEnabled(!!s.motivationalNotifsEnabled);
    await refreshNotificationPermission();
  }, [refreshNotificationPermission]);

  useEffect(() => {
    if (isFocused) load();
  }, [isFocused, load]);

  const persistAuthMethod = async (val) => {
    if (val === 'pin') {
      const s = await getAppSettings();
      if (!s.pinCode) {
        setShowPinSetup(true);
        return;
      }
    }
    setAuthMethod(val);
    await saveAppSettings({ authMethod: val, biometricEnabled: val === 'biometric' });
    emitAppSettingsChanged();
  };

  const handleSetNewPin = async () => {
    if (setupPinValue.length !== 4) return;
    setAuthMethod('pin');
    await saveAppSettings({ authMethod: 'pin', biometricEnabled: false, pinCode: setupPinValue });
    setShowPinSetup(false);
    setSetupPinValue('');
    emitAppSettingsChanged();
  };

  const saveTimeAuto = async (newHour, newMinute) => {
    await saveAppSettings({ notificationHour: newHour, notificationMinute: newMinute });
    await syncScheduledNotificationsFromSettings();
    emitAppSettingsChanged();
  };

  const bumpHour = (delta) => {
    setHour((h) => {
      let n = h + delta;
      if (n < 0) n = 23;
      if (n > 23) n = 0;
      saveTimeAuto(n, minute);
      return n;
    });
  };

  const bumpMinute = (delta) => {
    const steps = [0, 15, 30, 45];
    setMinute((m) => {
      const idx = steps.indexOf(m);
      const i = idx === -1 ? 0 : idx;
      let next = i + delta;
      if (next < 0) next = steps.length - 1;
      if (next >= steps.length) next = 0;
      saveTimeAuto(hour, steps[next]);
      return steps[next];
    });
  };

  const alertOpenSettings = () => {
    Alert.alert(
      'Bildirimler kapalı',
      'iOS veya Android ayarlarından VisionJournal (veya Expo Go) için bildirimleri açabilirsin.',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Ayarlara git', onPress: () => Linking.openSettings() },
      ]
    );
  };

  const toggleMotivationalQuotes = async (val) => {
    setMotivationalNotifsEnabled(val);
    await saveAppSettings({ motivationalNotifsEnabled: val });
    await syncScheduledNotificationsFromSettings();
    emitAppSettingsChanged();
  };

  const onRequestNotificationPermission = async () => {
    const result = await requestNotificationPermissionsFromUser();
    await refreshNotificationPermission();
    if (allowsNotifications(result)) {
      if (result.alreadyHadPermission) {
        Alert.alert(
          'Zaten izin var',
          isExpoGo
            ? 'Expo Go uygulaması için bildirim zaten açık olabilir; bu yüzden yeni bir sistem penceresi çıkmaz. Gerçek “VisionJournal sana bildirim göndersin mi?” akışını görmek için kendi derlemenle (EAS / APK) çalıştırman gerekir.'
            : 'Sistem bu uygulama için bildirimi zaten açmış görünüyor; tekrar sorulmayabilir. Hatırlatıcı saatini kaydedebilirsin.'
        );
        return;
      }
      Alert.alert('Tamam', 'Bildirim izni verildi. Şimdi hatırlatıcı saatini kaydedebilirsin.');
      return;
    }
    if (result.canAskAgain === false) {
      alertOpenSettings();
      return;
    }
    Alert.alert(
      'İzin verilmedi',
      isExpoGo
        ? 'Expo Go’da bildirimler kısıtlı olabilir. Tam deneyim için geliştirme derlemesi (development build) kullan.'
        : 'Tekrar dene veya telefon ayarlarından bildirimleri aç.'
    );
  };

  const saveReminderTime = async () => {
    await saveAppSettings({ notificationHour: hour, notificationMinute: minute });
    const res = await syncScheduledNotificationsFromSettings();
    await refreshNotificationPermission();
    emitAppSettingsChanged();
    if (!res.granted) {
      if (res.canAskAgain === false) {
        alertOpenSettings();
        return;
      }
      Alert.alert(
        'Bildirim izni',
        isExpoGo
          ? 'Expo Go’da sistem penceresi çıkmayabilir. Önce “Bildirim iznini iste”ye bas; olmazsa geliştirme derlemesi dene. Saat yine de kaydedildi.'
          : 'Önce “Bildirim iznini iste” düğmesine basıp izin ver; ardından tekrar kaydet. Saat yine de kaydedildi.'
      );
      return;
    }
    Alert.alert(
      'Kaydedildi',
      `Günlük hatırlatıcı her gün ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} için ayarlandı.`
    );
  };

  const onExport = async () => {
    try {
      const data = await exportAllUserData();
      const json = JSON.stringify(data, null, 2);
      await Share.share({
        message: json,
        title: 'VisionJournal yedek',
      });
    } catch (e) {
      Alert.alert('Hata', 'Dışa aktarma başarısız oldu.');
    }
  };

  const runImport = async (payload) => {
    try {
      const r = await applyBackupImport(payload, importMode);
      if (r.replacedSettings) emitAppSettingsChanged();
      await load();
      if (importMode === 'replace') {
        Alert.alert(
          'Tamam',
          `Yedek uygulandı. Günlük: ${r.journalCount ?? 0}, Vizyon: ${r.visionCount ?? 0}${r.replacedStreak ? ', Seri güncellendi.' : ''
          }${r.replacedSettings ? ' Ayarlar dosyadan yüklendi.' : ''}`
        );
      } else {
        Alert.alert(
          'Tamam',
          `Birleştirildi. Eklenen günlük: ${r.journalAdded ?? 0}, eklenen vizyon: ${r.visionAdded ?? 0}. Seri ve ayarlar aynı kaldı.`
        );
      }
    } catch (e) {
      Alert.alert('Hata', e?.message || 'İçe aktarma başarısız.');
    }
  };

  const onImportPickFile = async () => {
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain'],
        copyToCacheDirectory: true,
      });
      if (pick.canceled) return;
      const uri = pick.assets?.[0]?.uri;
      if (!uri) {
        Alert.alert('Hata', 'Dosya URI alınamadı.');
        return;
      }
      const text = await FileSystem.readAsStringAsync(uri);
      const parsed = parseBackupJson(text);
      if (!parsed.ok) {
        Alert.alert('Hata', parsed.error);
        return;
      }
      const valid = validateBackupPayload(parsed.data);
      if (!valid.ok) {
        Alert.alert('Hata', valid.error);
        return;
      }
      if (
        importMode === 'merge' &&
        !('journalEntries' in parsed.data) &&
        !('visionNotes' in parsed.data)
      ) {
        Alert.alert(
          'Uyarı',
          'Birleştir modu yalnızca günlük ve vizyon ekler. Bu dosyada journalEntries veya visionNotes alanı yok.'
        );
        return;
      }

      const title = importMode === 'replace' ? 'Tam değiştir' : 'Birleştir';
      const msg =
        importMode === 'replace'
          ? 'Dosyada bulunan her alan (günlük, vizyon, seri, ayarlar) cihazdakiyle değiştirilir; dosyada olmayan alanlara dokunulmaz. Devam?'
          : 'Dosyadaki günlük ve vizyonlar üste eklenecek. Aynı id çakışırsa yeni id verilir. Seri ve uygulama ayarların değişmez. Devam?';

      Alert.alert(title, msg, [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'İçe aktar',
          style: importMode === 'replace' ? 'destructive' : 'default',
          onPress: () => runImport(parsed.data),
        },
      ]);
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Dosya okunamadı.');
    }
  };

  const onResetApp = () => {
    Alert.alert(t('resetConfirmTitle'), t('resetConfirmSub'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('resetBtn'), style: 'destructive', onPress: async () => {
          await clearAllData();
          emitAppSettingsChanged();
        }
      }
    ]);
  };

  return (
    <View style={styles.pageContainer}>
      <Text style={styles.headerTitle}>{t('settings')}</Text>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="globe" size={20} color="#00BCD4" />
            <Text style={styles.cardTitle}>{t('appLanguage')}</Text>
          </View>
          <View style={styles.importModeRow}>
            <TouchableOpacity
              style={[styles.importModeChip, langCode === 'tr' && styles.importModeChipActive]}
              onPress={() => changeLanguage('tr')}
            >
              <Text style={[styles.importModeText, langCode === 'tr' && styles.importModeTextActive]}>
                Türkçe
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.importModeChip, langCode === 'en' && styles.importModeChipActive]}
              onPress={() => changeLanguage('en')}
            >
              <Text style={[styles.importModeText, langCode === 'en' && styles.importModeTextActive]}>
                English
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.rowLabel}>
              <Feather name="shield" size={20} color="#A0A0A0" />
              <Text style={styles.cardTitle}>{t('security')}</Text>
            </View>
          </View>
          <Text style={styles.hint}>{t('biometricHint')}</Text>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity
              style={[styles.importModeChip, authMethod === 'biometric' && styles.importModeChipActive, { flex: 1 }]}
              onPress={() => persistAuthMethod('biometric')}
            >
              <Text style={[styles.importModeText, authMethod === 'biometric' && styles.importModeTextActive, { textAlign: 'center' }]}>{t('useBiometric')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.importModeChip, authMethod === 'pin' && styles.importModeChipActive, { flex: 1 }]}
              onPress={() => persistAuthMethod('pin')}
            >
              <Text style={[styles.importModeText, authMethod === 'pin' && styles.importModeTextActive, { textAlign: 'center' }]}>{t('pinCodeLock')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.importModeChip, authMethod === 'none' && styles.importModeChipActive, { flex: 1 }]}
              onPress={() => persistAuthMethod('none')}
            >
              <Text style={[styles.importModeText, authMethod === 'none' && styles.importModeTextActive, { textAlign: 'center' }]}>{t('none')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="bell" size={20} color="#FFD700" />
            <Text style={styles.cardTitle}>{t('notification')}</Text>
          </View>
          {!allowsNotifications(notifPerm) && (
            <>
              <Text style={styles.hint}>Sistem izin penceresinin görünmesi için önce aşağıdaki düğmeye bas.</Text>
              <TouchableOpacity style={styles.accentBtn} onPress={onRequestNotificationPermission}>
                <Feather name="bell" size={18} color="#000" />
                <Text style={styles.accentBtnText}>{t('reqPerm')}</Text>
              </TouchableOpacity>
            </>
          )}
          <Text style={styles.hint}>{t('notificationHint')}</Text>
          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>{t('hours')}</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => bumpHour(-1)}>
                <Feather name="minus" size={20} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.timeValue}>{String(hour).padStart(2, '0')}</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => bumpHour(1)}>
                <Feather name="plus" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={[styles.timeRow, { marginTop: 12, borderTopWidth: 1, borderTopColor: '#2A2A2A', paddingTop: 16 }]}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.timeLabel}>{t('motivationalQuotes')}</Text>
              <Text style={[styles.hint, { marginTop: 2 }]}>{t('motivationalQuotesHint')}</Text>
            </View>
            <Switch
              value={motivationalNotifsEnabled}
              onValueChange={toggleMotivationalQuotes}
              trackColor={{ false: '#333', true: '#4CAF50' }}
              thumbColor={motivationalNotifsEnabled ? '#fff' : '#A0A0A0'}
            />
          </View>

          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>{t('minutes')}</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => bumpMinute(-1)}>
                <Feather name="minus" size={20} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.timeValue}>{String(minute).padStart(2, '0')}</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => bumpMinute(1)}>
                <Feather name="plus" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={[styles.primaryBtn, { marginTop: 24, marginBottom: 8 }]} onPress={saveReminderTime}>
            <Feather name="check" size={18} color="#000" />
            <Text style={styles.primaryBtnText}>{t('saveReminder')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="database" size={20} color="#4CAF50" />
            <Text style={styles.cardTitle}>{t('backup')}</Text>
          </View>
          <Text style={styles.hint}>{t('backupHint')}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={onExport}>
            <Feather name="upload" size={18} color="#000" />
            <Text style={styles.primaryBtnText}>{t('export')}</Text>
          </TouchableOpacity>

          <View style={styles.divider} />
          <Text style={styles.subheading}>{t('import')}</Text>
          <Text style={styles.hint}>{t('importHint')}</Text>
          <View style={styles.importModeRow}>
            <TouchableOpacity
              style={[styles.importModeChip, importMode === 'merge' && styles.importModeChipActive]}
              onPress={() => setImportMode('merge')}
            >
              <Text style={[styles.importModeText, importMode === 'merge' && styles.importModeTextActive]}>
                {t('mergeMode')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.importModeChip, importMode === 'replace' && styles.importModeChipActive]}
              onPress={() => setImportMode('replace')}
            >
              <Text style={[styles.importModeText, importMode === 'replace' && styles.importModeTextActive]}>
                {t('replaceMode')}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.importFileBtn} onPress={onImportPickFile}>
            <Feather name="download" size={18} color="#000" />
            <Text style={styles.importFileBtnText}>{t('pickJsonFile')}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { borderColor: '#F44336', borderWidth: 1, marginBottom: 100 }]}>
          <View style={styles.cardHeader}>
            <Feather name="alert-triangle" size={20} color="#F44336" />
            <Text style={[styles.cardTitle, { color: '#F44336' }]}>{t('resetApp')}</Text>
          </View>
          <Text style={styles.hint}>{t('resetAppHint')}</Text>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#F44336' }]} onPress={onResetApp}>
            <Feather name="trash-2" size={18} color="#fff" />
            <Text style={[styles.primaryBtnText, { color: '#fff' }]}>{t('resetBtn')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: { flex: 1, backgroundColor: '#121212', paddingHorizontal: 24, paddingTop: 60 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 140 },
  headerTitle: { fontSize: 32, fontWeight: '700', color: '#ffffff', marginBottom: 20 },
  card: { backgroundColor: '#1E1E1E', borderRadius: 20, padding: 20, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  hint: { fontSize: 13, color: '#A0A0A0', marginTop: 10, lineHeight: 18 },
  statusLine: { fontSize: 14, color: '#D0D0D0', marginTop: 4, fontWeight: '500' },
  expoHint: { fontSize: 12, color: '#FF9800', marginTop: 10, lineHeight: 17 },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  timeLabel: { color: '#D0D0D0', fontSize: 15 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: { backgroundColor: '#2A2A2A', padding: 10, borderRadius: 12 },
  timeValue: { color: '#fff', fontSize: 20, fontWeight: '700', minWidth: 44, textAlign: 'center' },
  accentBtn: {
    flexDirection: 'row',
    backgroundColor: '#FFD700',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  accentBtnText: { color: '#000000', fontWeight: '700', fontSize: 15 },
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  primaryBtnText: { color: '#000000', fontWeight: '600', fontSize: 15 },
  secondaryBtn: {
    flexDirection: 'row',
    backgroundColor: '#2A2A2A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  secondaryBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 15 },
  importModeRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  importModeChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#333',
    alignItems: 'center',
  },
  importModeChipActive: { backgroundColor: '#4CAF50' },
  importModeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  importModeTextActive: { color: '#000' },
  pinOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  pinBox: { backgroundColor: '#1E1E1E', padding: 24, borderRadius: 20, width: '80%', alignItems: 'center' },
  pinTitle: { color: '#fff', fontSize: 20, fontWeight: '600', marginBottom: 8 },
  pinSub: { color: '#A0A0A0', fontSize: 13, marginBottom: 20 },
  pinInput: { backgroundColor: '#121212', color: '#fff', fontSize: 32, padding: 16, borderRadius: 12, width: '100%', textAlign: 'center', letterSpacing: 8, marginBottom: 20 },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 20,
  },
  subheading: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  importFileBtn: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  importFileBtnText: { color: '#000000', fontWeight: '700', fontSize: 15 },
});
