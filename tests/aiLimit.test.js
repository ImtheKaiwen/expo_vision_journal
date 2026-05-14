/**
 * AI Limit Logic Test
 * Bu test, storage.js'deki AI kullanım takibi mantığını simüle eder.
 */

// Mock Storage
const storage = {};
const mockAsyncStorage = {
  getItem: (key) => Promise.resolve(storage[key] || null),
  setItem: (key, val) => {
    storage[key] = val;
    return Promise.resolve();
  }
};

// Mock getLocalDateString
const getLocalDateString = (date = new Date()) => {
  const tzo = -date.getTimezoneOffset();
  const dif = tzo >= 0 ? '+' : '-';
  const pad = (num) => (num < 10 ? '0' : '') + num;
  return date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate());
};

const KEYS = { AI_USAGE: '@ai_usage' };

async function getAIUsage() {
  const date = getLocalDateString();
  try {
    const raw = await mockAsyncStorage.getItem(KEYS.AI_USAGE);
    if (!raw) return 0;
    const data = JSON.parse(raw);
    return data[date] || 0;
  } catch {
    return 0;
  }
}

async function incrementAIUsage() {
  const date = getLocalDateString();
  try {
    const raw = await mockAsyncStorage.getItem(KEYS.AI_USAGE);
    const data = raw ? JSON.parse(raw) : {};
    const current = data[date] || 0;
    const next = { ...data, [date]: current + 1 };
    
    // Cleanup logic
    const dates = Object.keys(next).sort();
    if (dates.length > 7) delete next[dates[0]];

    await mockAsyncStorage.setItem(KEYS.AI_USAGE, JSON.stringify(next));
    return current + 1;
  } catch {
    return 0;
  }
}

async function runTest() {
  console.log('--- AI Limit Logic Testi ---');
  
  // 1. Başlangıçta 0 olmalı
  let usage = await getAIUsage();
  console.log(`Başlangıç kullanımı: ${usage}`);
  if (usage !== 0) throw new Error('Test 1 başarısız');

  // 2. Artırınca 1 olmalı
  await incrementAIUsage();
  usage = await getAIUsage();
  console.log(`Artış sonrası kullanım: ${usage}`);
  if (usage !== 1) throw new Error('Test 2 başarısız');

  // 3. 50'ye kadar artırınca limit kontrolü
  console.log('50 kullanıma kadar simüle ediliyor...');
  for(let i = 0; i < 49; i++) await incrementAIUsage();
  
  usage = await getAIUsage();
  console.log(`50 artış sonrası toplam: ${usage}`);
  if (usage !== 50) throw new Error('Test 3 başarısız');

  // 4. Farklı tarih simülasyonu
  console.log('Farklı gün simüle ediliyor...');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = getLocalDateString(tomorrow);
  
  // Storage'a manuel yarın için veri ekleyelim
  const raw = await mockAsyncStorage.getItem(KEYS.AI_USAGE);
  const data = JSON.parse(raw);
  data[tomorrowStr] = 5;
  await mockAsyncStorage.setItem(KEYS.AI_USAGE, JSON.stringify(data));
  
  // Bizim getAIUsage bugünü döndürdüğü için 50 olmalı hala
  usage = await getAIUsage();
  console.log(`Bugünkü kullanım (yarın 5 olsa da): ${usage}`);
  if (usage !== 50) throw new Error('Test 4 başarısız');

  console.log('\n✅ TEST BAŞARILI: AI kullanım takibi doğru çalışıyor.');
}

runTest().catch(e => {
  console.error('\n❌ TEST BAŞARISIZ:', e.message);
  process.exit(1);
});
