# VisionJournal — sonraki milestone (C grubu)

Bu dosya, ürünün bir sonraki aşamaları için kısa bir yol haritasıdır. Şu anki sürüm yerel depolama, ayarlar, günlük düzenleme ve günlük/vizyon ayrı analizlerini içerir.

## Milestone C — önerilen başlıklar

1. **Yedekleme ve geri yükleme**  
   Dışa aktarılan JSON dosyasını uygulama içinden içe aktarma (doğrulama + birleştirme veya tam değiştirme modu). İsteğe bağlı bulut senkronu ayrı bir hukuki ve güvenlik incelemesi gerektirir.

2. **Duygu / etiket**  
   Her günlük girişine ruh hali veya etiket; analiz ekranında dağılım veya basit grafikler.

3. **Haftalık özet bildirimi**  
   Günlük hatırlatıcının yanına isteğe bağlı haftalık özet (özet metni üretimi için yerel kurallar veya ileride harici API).

4. **Widget veya kilit ekranı**  
   Native modül veya config plugin ile ek bakım; kullanıcı değeri yüksek olduğunda ele alınabilir.

## Bağımlılık sırası

- İçe aktarma, mevcut `exportAllUserData` şeması ile uyumlu bir `importUserData` API’si gerektirir.
- Duygu etiketleri için günlük veri modeline alan eklenmesi ve analiz tarafında gruplama gerekir.

---

## Backlog (plan sonrası — öncelik önerisi)

1. ~~**JSON içe aktarma**~~ — Ayarlar: `expo-document-picker` + `expo-file-system`; **Birleştir** (günlük/vizyon, id çakışınca yeni id) ve **Tam değiştir** (dosyada hangi alan varsa o alanların tamamı yedekten yüklenir).
2. **Günlükte duygu / etiket** — Kayıt modeli + Analiz ekranında dağılım.
3. **Haftalık özet bildirimi** — Ayarlarda aç/kapat ve ikinci zamanlayıcı (`expo-notifications`).
4. **Navigasyon teması** — Ortak renk/spacing (`theme`) ile tab ve ekran stillerini tek yerden yönetme.

*Günlük takvim/liste görünümü (Journal sekmesi, Liste | Takvim) tamamlandı; yeni kayıtlarda `createdAt` ISO alanı takvim günü için kullanılıyor.*
