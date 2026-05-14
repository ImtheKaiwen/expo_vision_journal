/**
 * Weight Update Logic Test
 * Bu test, hafta sonu kontrolü ve son güncelleme tarihi mantığını doğrular.
 */

const getLocalDateString = (date = new Date()) => {
  const pad = (num) => (num < 10 ? '0' : '') + num;
  return date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate());
};

function shouldShowWeightModal(settings, today, isPremium) {
  const dateObj = new Date(today);
  const dayOfWeek = dateObj.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Pazar veya Cumartesi
  
  return isPremium && isWeekend && settings.lastWeightUpdateDate !== today;
}

async function runTest() {
  console.log('--- Kilo Güncelleme Mantık Testi ---');

  const todayStr = getLocalDateString();
  const settings = { lastWeightUpdateDate: null };
  const isPremium = true;

  // 1. Hafta içi (Pazartesi simülasyonu)
  const monday = '2026-05-11'; // Pazartesi
  let show = shouldShowWeightModal(settings, monday, isPremium);
  console.log(`Pazartesi gösterilmeli mi? (Hayır): ${show}`);
  if (show !== false) throw new Error('Test 1 başarısız');

  // 2. Cumartesi (Hiç güncellenmemiş)
  const saturday = '2026-05-16'; // Cumartesi
  show = shouldShowWeightModal(settings, saturday, isPremium);
  console.log(`Cumartesi (ilk kez) gösterilmeli mi? (Evet): ${show}`);
  if (show !== true) throw new Error('Test 2 başarısız');

  // 3. Cumartesi (Güncellenmiş)
  const settingsUpdated = { lastWeightUpdateDate: '2026-05-16' };
  show = shouldShowWeightModal(settingsUpdated, saturday, isPremium);
  console.log(`Cumartesi (güncellenmiş) gösterilmeli mi? (Hayır): ${show}`);
  if (show !== false) throw new Error('Test 3 başarısız');

  // 4. Pazar (Henüz güncellenmemiş bu pazar)
  const sunday = '2026-05-17'; // Pazar
  show = shouldShowWeightModal(settingsUpdated, sunday, isPremium);
  console.log(`Pazar (Cumartesi güncellense de yeni gün) gösterilmeli mi? (Evet): ${show}`);
  if (show !== true) throw new Error('Test 4 başarısız');

  // 5. Premium olmayan kullanıcı
  show = shouldShowWeightModal(settings, saturday, false);
  console.log(`Cumartesi (Premium değil) gösterilmeli mi? (Hayır): ${show}`);
  if (show !== false) throw new Error('Test 5 başarısız');

  console.log('\n✅ TEST BAŞARILI: Kilo güncelleme tetikleme mantığı doğru.');
}

runTest().catch(e => {
  console.error('\n❌ TEST BAŞARISIZ:', e.message);
  process.exit(1);
});
