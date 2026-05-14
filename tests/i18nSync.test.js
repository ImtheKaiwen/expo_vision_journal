const fs = require('fs');
const path = require('path');

/**
 * Bu test, i18n.js dosyasındaki tr ve en objelerini karşılaştırır.
 * Bir dilde olup diğerinde olmayan anahtarları raporlar.
 */

function runTest() {
  const filePath = path.join(__dirname, '../src/utils/i18n.js');
  const content = fs.readFileSync(filePath, 'utf8');

  // Basit bir regex ile objeleri ayıklamaya çalışalım (i18n.js yapısına özel)
  const trMatch = content.match(/const tr = \{([\s\S]*?)\};/);
  const enMatch = content.match(/const en = \{([\s\S]*?)\};/);

  if (!trMatch || !enMatch) {
    console.error('TR veya EN objesi bulunamadı!');
    return;
  }

  function extractKeys(str) {
    const keys = [];
    const lines = str.split('\n');
    lines.forEach(line => {
      const match = line.match(/^\s*([a-zA-Z0-9_]+):/);
      if (match) keys.push(match[1]);
    });
    return keys;
  }

  const trKeys = extractKeys(trMatch[1]);
  const enKeys = extractKeys(enMatch[1]);

  const missingInEn = trKeys.filter(k => !enKeys.includes(k));
  const missingInTr = enKeys.filter(k => !trKeys.includes(k));

  console.log('--- i18n Sync Testi ---');
  console.log(`TR Anahtar Sayısı: ${trKeys.length}`);
  console.log(`EN Anahtar Sayısı: ${enKeys.length}`);

  if (missingInEn.length > 0) {
    console.warn('\n[HATA] EN sözlüğünde eksik anahtarlar:');
    console.warn(missingInEn.join(', '));
  } else {
    console.log('\n[TAMAM] EN sözlüğünde eksik anahtar yok.');
  }

  if (missingInTr.length > 0) {
    console.warn('\n[HATA] TR sözlüğünde eksik anahtarlar:');
    console.warn(missingInTr.join(', '));
  } else {
    console.log('[TAMAM] TR sözlüğünde eksik anahtar yok.');
  }

  if (missingInEn.length === 0 && missingInTr.length === 0) {
    console.log('\n✅ TEST BAŞARILI: Sözlükler senkronize.');
  } else {
    console.error('\n❌ TEST BAŞARISIZ: Eksik anahtarlar var.');
  }
}

runTest();
