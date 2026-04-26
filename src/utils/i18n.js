import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAppSettings, saveAppSettings } from '../storage';
import { DeviceEventEmitter } from 'react-native';
import { APP_SETTINGS_CHANGED } from '../events/appSettings';

// TRANSLATIONS
const tr = {
  // Onboarding
  welcome: 'Hoş Geldiniz',
  onboardSubtitle: 'VisionJournal ile hedeflerine ve günlüklerine daha yakınsın.',
  selectLanguage: 'Uygulama dilini seçin',
  continue: 'Devam Et',
  setupSecurity: 'Güvenliğini Ayarla',
  securityDesc: 'Özel yazılarının sana kalması için nasıl bir kilit istiyorsun?',
  useBiometric: 'Face ID',
  usePin: 'Sadece PIN Kodu Kullan',
  skipSecurity: 'Şifresiz Devam Et',
  createPin: 'PIN Kodu Oluştur',
  pinHint: '4 Haneli PIN girin',
  startApp: 'Uygulamaya Başla',
  tutorialVisionTitle: 'Vizyonlarını Belirle',
  tabProfile: 'Profil',
  tabGeneral: 'Genel Ayarlar',
  saveBtn: 'Kaydet',
  savedBtn: 'Tamam',
  nameStepTitle: 'Adınız Nedir?',
  nameStepSubtitle: 'Yolculuğunuzu kişiselleştirelim.',
  nameError: 'Lütfen devam etmek için bir isim girin.',
  streakText0: 'Yeni bir başlangıç! İlk günümü not aldım.',
  streakText10: 'İstikrarla ilerliyorum! 10 günü geride bıraktım.',
  streakText30: 'Alışkanlıklarım değişiyor! Tam 30 gündür serideyim.',
  shareCardSub: 'Düşlerini gerçeğe dönüştürüyor',
  inviteTitle: 'Arkadaşlarını Davet Et',
  inviteSubtitle: 'Birlikte daha güçlü adımlar atalım.',
  inviteCardText: 'Benimle birlikte vizyonlarını gerçekleştirmeye ne dersin?',
  inviteMessage: 'Vision Journal ile hedeflerime daha yakınım. Hadi sen de aramıza katıl! https://apps.apple.com/tr/app/vision-journal-hedef-takibi/id6762062493?l=tr',
  shareStreak: 'Serini Paylaş',
  mostActiveDayHint: 'Genellikle bu günler daha üretkensin!',
  notEnoughData: 'Yeterli veri yok',

  // Tabs
  tabVision: 'Vizyon',
  tabJournal: 'Günlük',
  tabAnalytics: 'Analiz',
  tabSettings: 'Ayarlar',

  // Vision
  searchVision: 'Vizyon ara...',
  noResult: 'Sonuç bulunamadı.',
  scrollToAdd: 'Eklemek için ekranı aşağı kaydır...',
  createVision: 'Yeni Vizyon Yarat',
  titleLabel: 'Başlık',
  contentLabel: 'İçerik (Ne yapacaksın?)',
  targetDaysLabel: 'Hedef Gün Sayısı (seçmeli)',
  save: 'Kaydet',
  delete: 'Sil',
  copy: 'Kopyala',
  edit: 'Düzenle',
  checkin: 'Check-in',
  done: 'Yapıldı',
  doneBtn: 'Yaptım',
  halfBtn: 'Yarım',
  failBtn: 'Yapamadım',
  selectAll: 'Tümünü seç',
  copySelected: 'Kopyala',
  streakDays: 'Gündür Seridesin',
  days: 'gün',
  didYouDoIt: 'Bugün hedefini yaptın mı?',
  select: 'Seç',
  editVision: 'Vizyonu Düzenle',
  titlePlaceholder: 'Başlık (Örn: Yeni Hedef)',
  contentPlaceholder: 'Kendine ne söylemek istersin?',
  targetDaysPlaceholder: 'Hedef Gün (İsteğe bağlı, örn: 21)',

  // Journal
  searchJournal: 'Tarih veya kelime ile ara...',
  whatHappened: 'Bugün Neler Oldu?',
  journalPlaceholder: 'Düşüncelerini buraya yaz...',
  clear: 'Temizle',
  areYouSure: 'Emin misin?',
  deleteConfirm: 'Yazdıklarını silmek istediğine emin misin?',
  cancel: 'İptal',
  journalNoEntry: 'Bu gün için kayıt yok.',
  copyDay: 'Bu günün kayıtlarını kopyala',
  tapDayHint: 'Bir güne dokunarak o güne ait kayıtları gör.',
  listMode: 'Liste',
  calendarMode: 'Takvim',
  editJournal: 'Günlüğü düzenle',
  shortDays: 'Paz,Pzt,Sal,Çar,Per,Cum,Cmt',

  // Analytics
  generalAnalytics: 'Genel Analizler',
  wordAnalytics: 'Kelime Analizleri',
  journalStat: 'Günlük',
  visionStat: 'Vizyon',
  last7Days: 'Son 7 Günlük Aktivite',
  visionCompletion: 'Genel Vizyon İlerlemesi',
  difficultVisions: 'Seni Zorlayan Vizyonlar',
  difficultSub: 'En çok yarım/eksik kalan hedefler',
  bestVisions: 'En İyi İlerlenen Vizyonlar',
  bestSub: 'Hedefine en sadık kaldıkların',
  times: 'kez',
  timesDone: 'x Tam',
  timesHalf: 'x Yarım',
  timesFail: 'x Yapamadım',
  completionRateHint: 'Tamamlanma (Takip edilen hedefler)',
  noDifficultVisions: 'Harika gidiyorsun! Yarım kalan vizyonun yok.',
  analyticsWordsStats: 'Günlük — Kelimeler',
  analyticsBigramsStats: 'Günlük — İkili Kelimeler',
  analyticsVWordsStats: 'Vizyon — Kelimeler',
  analyticsVBigramsStats: 'Vizyon — İkili Kelimeler',
  noDataJournal: 'Henüz yeterli veri yok. Günlük yazdıkça burada analizlerin belirecek.',
  noDataVision: 'Vizyon ekledikçe burada kelimeler görünecek.',
  noDataCommon: 'Henüz yeterli veri yok.',
  wordAfterWordHint: 'Hangi kelimeden sonra hangisi geliyor?',
  mixHint: 'Başlık ve içerik birlikte analiz edilir.',

  // Settings
  settings: 'Ayarlar',
  security: 'Güvenlik',
  appLanguage: 'Uygulama Dili',
  biometricLock: 'Biyometrik kilit',
  biometricHint: 'Kapalıysa uygulama açılışında doğrulama istenmez.',
  pinCodeLock: 'PIN Kodu (Şifre)',
  changePin: 'PIN Değiştir',
  notification: 'Günlük hatırlatıcı',
  hours: 'Saat',
  minutes: 'Dakika',
  testNotif: 'Test bildirimi (2 sn)',
  reqPerm: 'Bildirim iznini iste',
  backup: 'Yedekleme',
  export: 'Dışa aktar',
  import: 'İçe aktar',
  mergeMode: 'Birleştir',
  replaceMode: 'Tam Değiştir',
  none: 'Yok',
  notificationHint: 'Her gün aynı saatte bir bildirim planlanır.',
  backupHint: 'Günlük, vizyon, seri ve ayarlar JSON olarak dışa veya içe aktarılır.',
  importHint: 'Dışa aktarma ile aynı şema. Birleştir: günlük/vizyon üste eklenir. Tam değiştir: dosyada bulunan alanlar cihazda o alanlarla değiştirilir.',
  pickJsonFile: 'JSON dosyası seç',
  saveReminder: 'Saati Kaydet',
  resetApp: 'Uygulamayı Sıfırla',
  resetAppHint: 'Tüm vizyon, günlük ve ayarlar silinir. Bu işlem geri alınamaz.',
  resetConfirmTitle: 'Emin misin?',
  resetConfirmSub: 'Tüm verilerin kalıcı olarak silinecek. Devam etmek istiyor musun?',
  resetBtn: 'Evet, Sıfırla',
  warning: 'Uyarı',
  copiedTitle: 'Kopyalandı',
  visionCopied: 'Vizyon panoya alındı.',
  visionsCopied: 'vizyon panoya alındı.',
  journalCopied: 'Metin panoya alındı.',
  journalsCopied: 'günlük panoya alındı.',
  noVisionSelected: 'Hiç vizyon seçilmedi.',
  noEntrySelected: 'Hiç kayıt seçilmedi.',
  timedVisions: 'Süreli',
  timelessVisions: 'Süresiz',
  motivationalQuotes: 'Motive Edici Sözler',
  motivationalQuotesHint: 'Hatırlatıcılarda rastgele motivasyon sözleri gösterilsin.',
  planYourDay: 'Gününüzü planlayın',
  tutorialVisionDesc: 'Hayallerini ve hedeflerini buraya not et. Süreli veya süresiz vizyonlar oluşturarak gelişimini takip et.',
  tutorialJournalTitle: 'Günlük Tut',
  tutorialJournalDesc: 'Her gün neler hissettiğini, neler yaşadığını yaz. Takvim görünümü ile geçmişe yolculuk yap.',
  tutorialAddVisionTitle: 'Yeni Vizyon Ekle',
  tutorialAddVisionDesc: 'Listenin en üstündeyken ekranı aşağı kaydırarak yeni hedeflerini kolayca eklemeye başla.',
  journalNoEntryList: 'Buralar henüz sessiz... Gününü not almak için tüy ikonuna dokunmaya ne dersin?',
  heatmapHint: 'Son 4 aylık yolculuğunun aktivite özeti',
  statsTitle: 'İstatistikler',
  totalEntries: 'Toplam Kayıt',
  mostActiveDay: 'En Aktif Gün',
  mostActiveDayFull: 'En aktif olduğun gün',
  currStreak: 'Mevcut Seri',
  fullDays: 'Pazar,Pazartesi,Salı,Çarşamba,Perşembe,Cuma,Cumartesi',
  profileTitle: 'Profil',
  userNameLabel: 'İsminiz (Paylaşım kartı için)',
  userNamePlaceholder: 'Adınızı girin...',
  defaultTraveler: 'Gezgin',
};

const en = {
  // Onboarding
  welcome: 'Welcome',
  onboardSubtitle: 'Stay closer to your goals and journals with VisionJournal.',
  selectLanguage: 'Select App Language',
  continue: 'Continue',
  setupSecurity: 'Setup Security',
  securityDesc: 'How do you want to protect your private journals?',
  useBiometric: 'Face ID',
  usePin: 'Use PIN Code Only',
  skipSecurity: 'Continue without password',
  createPin: 'Create PIN Code',
  pinHint: 'Enter 4-digit PIN',
  startApp: 'Start App',
  tutorialVisionTitle: 'Define Your Visions',
  tabProfile: 'Profile',
  tabGeneral: 'General Settings',
  saveBtn: 'Save',
  savedBtn: 'Saved',
  nameStepTitle: 'What is Your Name?',
  nameStepSubtitle: 'Let\'s personalize your journey.',
  nameError: 'Please enter a name to continue.',
  streakText0: 'A fresh start! Just noted my first day.',
  streakText10: 'Moving steadily! Just passed 10 days.',
  streakText30: 'Habits are changing! 30 days in a row.',
  shareCardSub: 'Turning dreams into reality',
  inviteTitle: 'Invite Friends',
  inviteSubtitle: 'Take stronger steps together.',
  inviteCardText: 'How about realizing your visions with me?',
  inviteMessage: 'I\'m closer to my goals with Vision Journal. Come join us! https://apps.apple.com/tr/app/vision-journal-hedef-takibi/id6762062493?l=tr',
  shareStreak: 'Share Streak',
  mostActiveDayHint: 'You are usually more productive on these days!',
  notEnoughData: 'Not enough data',

  // Tabs
  tabVision: 'Vision',
  tabJournal: 'Journal',
  tabAnalytics: 'Analytics',
  tabSettings: 'Settings',

  // Vision
  searchVision: 'Search vision...',
  noResult: 'No results found.',
  scrollToAdd: 'Scroll down to add a new vision...',
  createVision: 'Create New Vision',
  titleLabel: 'Title',
  contentLabel: 'Content/Action required',
  targetDaysLabel: 'Target Days (optional)',
  save: 'Save',
  delete: 'Delete',
  copy: 'Copy',
  edit: 'Edit',
  checkin: 'Check-in',
  done: 'Done',
  doneBtn: 'Done',
  halfBtn: 'Half',
  failBtn: 'Failed',
  selectAll: 'Select all',
  copySelected: 'Copy',
  streakDays: 'Day Streak',
  days: 'days',
  didYouDoIt: 'Did you meet your target today?',
  editVision: 'Edit Vision',
  titlePlaceholder: 'Title (e.g. New Goal)',
  contentPlaceholder: 'What do you want to tell yourself?',
  targetDaysPlaceholder: 'Target Days (e.g. 21)',

  // Journal
  searchJournal: 'Search date or word...',
  whatHappened: "What happened today?",
  journalPlaceholder: 'Write your thoughts here...',
  clear: 'Clear',
  areYouSure: 'Are you sure?',
  deleteConfirm: 'Are you sure you want to delete what you wrote?',
  cancel: 'Cancel',
  journalNoEntry: 'No entries for this day.',
  copyDay: 'Copy entries for this day',
  tapDayHint: 'Tap a day to see its entries.',
  listMode: 'List',
  calendarMode: 'Calendar',
  editJournal: 'Edit Journal',
  shortDays: 'Sun,Mon,Tue,Wed,Thu,Fri,Sat',

  // Analytics
  generalAnalytics: 'General',
  wordAnalytics: 'Words',
  journalStat: 'Journals',
  visionStat: 'Visions',
  last7Days: 'Last 7 Days',
  visionCompletion: 'Overall Vision Progress',
  difficultVisions: 'Struggling Visions',
  difficultSub: 'Goals you missed most',
  bestVisions: 'Top Visions',
  bestSub: 'Goals you stuck to most',
  times: 'times',
  timesDone: 'x Done',
  timesHalf: 'x Half',
  timesFail: 'x Failed',
  completionRateHint: 'Completion (Tracked targets)',
  noDifficultVisions: 'Great job! You have no struggling visions.',
  analyticsWordsStats: 'Journal — Words',
  analyticsBigramsStats: 'Journal — Bigrams',
  analyticsVWordsStats: 'Vision — Words',
  analyticsVBigramsStats: 'Vision — Bigrams',
  noDataJournal: 'Not enough data yet. Write journals to see analytics here.',
  noDataVision: 'Add visions to see word analytics here.',
  noDataCommon: 'Not enough data yet.',
  wordAfterWordHint: 'Which word follows which?',
  mixHint: 'Title and content are analyzed together.',

  // Settings
  settings: 'Settings',
  security: 'Security',
  appLanguage: 'App Language',
  biometricLock: 'Biometric lock',
  biometricHint: 'If off, no auth is asked at startup.',
  pinCodeLock: 'PIN Code',
  changePin: 'Change PIN',
  notification: 'Daily reminder',
  hours: 'Hour',
  minutes: 'Minute',
  testNotif: 'Test notification (2s)',
  reqPerm: 'Request permission',
  backup: 'Backup',
  export: 'Export',
  import: 'Import',
  mergeMode: 'Merge',
  replaceMode: 'Replace',
  none: 'None',
  notificationHint: 'A notification is scheduled for the same time every day.',
  backupHint: 'Journal, vision, streak, and settings are exported/imported as JSON.',
  importHint: 'Same schema as export. Merge: adds journal/vision on top. Replace: overwrites device fields with file fields.',
  pickJsonFile: 'Pick JSON file',
  saveReminder: 'Save Time',
  resetApp: 'Reset App',
  resetAppHint: 'All visions, journals, and settings will be wiped. This action cannot be undone.',
  resetConfirmTitle: 'Are you sure?',
  resetConfirmSub: 'All your data will be permanently deleted. Do you want to proceed?',
  resetBtn: 'Yes, Reset',
  warning: 'Warning',
  copiedTitle: 'Copied',
  visionCopied: 'Vision copied to clipboard.',
  visionsCopied: 'visions copied to clipboard.',
  journalCopied: 'Entry copied to clipboard.',
  journalsCopied: 'entries copied to clipboard.',
  noVisionSelected: 'No vision selected.',
  noEntrySelected: 'No entry selected.',
  timedVisions: 'Timed',
  timelessVisions: 'Timeless',
  motivationalQuotes: 'Motivational Quotes',
  motivationalQuotesHint: 'Show random motivational quotes in reminders.',
  planYourDay: 'Plan your day',
  tutorialVisionDesc: 'Note your dreams and goals here. Track your progress by creating timed or timeless visions.',
  tutorialJournalTitle: 'Keep a Journal',
  tutorialJournalDesc: 'Write down how you feel and what you experience every day. Travel back in time with the calendar view.',
  tutorialAddVisionTitle: 'Add New Vision',
  tutorialAddVisionDesc: 'Start easily adding new goals by pulling down at the top of the list.',
  journalNoEntryList: 'It looks a bit quiet here... How about tapping the feather icon to note down your day?',
  heatmapHint: 'Activity summary of your 4-month journey',
  statsTitle: 'Statistics',
  totalEntries: 'Total Entries',
  mostActiveDay: 'Most Active Day',
  mostActiveDayFull: 'Your most active day',
  currStreak: 'Current Streak',
  fullDays: 'Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday',
  profileTitle: 'Profile',
  userNameLabel: 'Your Name (For share card)',
  userNamePlaceholder: 'Enter your name...',
  defaultTraveler: 'Voyager',
};

const dictionaries = { tr, en };

const I18nContext = createContext();

export function I18nProvider({ children }) {
  const [langCode, setLangCode] = useState('tr');

  useEffect(() => {
    let mounted = true;
    getAppSettings().then((s) => {
      if (mounted && s.language) {
        setLangCode(s.language);
      }
    });
    return () => (mounted = false);
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(APP_SETTINGS_CHANGED, async () => {
      const s = await getAppSettings();
      if (s.language) setLangCode(s.language);
    });
    return () => sub.remove();
  }, []);

  const t = (key) => {
    const dict = dictionaries[langCode] || dictionaries['tr'];
    return dict[key] || key;
  };

  const changeLanguage = async (code) => {
    setLangCode(code);
    await saveAppSettings({ language: code });
    DeviceEventEmitter.emit(APP_SETTINGS_CHANGED);
  };

  return (
    <I18nContext.Provider value={{ t, langCode, changeLanguage }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
