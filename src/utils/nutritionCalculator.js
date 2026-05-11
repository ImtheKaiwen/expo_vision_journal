/**
 * Beslenme hedeflerini hesaplayan yardımcı fonksiyonlar.
 * Mifflin-St Jeor Denklemi kullanılmıştır.
 */

export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const GOAL_MODIFIERS = {
  lose: -500,
  maintain: 0,
  gain: 500,
};

/**
 * Kullanıcı verilerine göre günlük kalori ve makro hedeflerini hesaplar.
 */
export function calculateDailyTargets({ gender, weight, height, age, activityLevel, goal }) {
  // 1. BMR (Bazal Metabolizma Hızı) Hesaplama - Mifflin-St Jeor
  let bmr;
  if (gender === 'male') {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }

  // 2. TDEE (Toplam Günlük Enerji Harcaması)
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || 1.2;
  const tdee = bmr * multiplier;

  // 3. Hedefe Göre Kalori Ayarı
  let targetCalories;
  if (goal === 'lose') {
    // TDEE'den %20 açık vermek en sağlıklı ve sürdürülebilir yöntemdir
    const deficit = tdee * 0.20;
    targetCalories = tdee - deficit;
    
    // GÜVENLİK DUVARI: Hedef asla Bazal Metabolizma Hızının (BMR) altına düşmemeli
    if (targetCalories < bmr) {
      targetCalories = bmr;
    }
  } else if (goal === 'gain') {
    // Kilo almak için %15-20 fazlalık idealdir
    targetCalories = tdee + (tdee * 0.15);
  } else {
    targetCalories = tdee;
  }

  targetCalories = Math.round(targetCalories);

  // 4. Makro Dağılımı (Daha Dengeli: Protein %25, Yağ %25, Karb %50)
  // Protein (1g = 4 kcal) - Kas koruması için %25 ideal
  const proteinKcal = targetCalories * 0.25;
  const proteinGrams = Math.round(proteinKcal / 4);

  // Yağ (1g = 9 kcal) - Hormonal denge için %25
  const fatKcal = targetCalories * 0.25;
  const fatGrams = Math.round(fatKcal / 9);

  // Karbonhidrat (1g = 4 kcal) - Enerji için kalan %50
  const carbsKcal = targetCalories - (proteinKcal + fatKcal);
  const carbsGrams = Math.round(carbsKcal / 4);

  // Su Hedefi (Kilo başına 35ml kuralı)
  const waterGoal = Math.round(weight * 35);

  return {
    calories: targetCalories,
    protein: proteinGrams,
    fat: fatGrams,
    carbs: carbsGrams,
    waterGoal: waterGoal,
    bmr: Math.round(bmr) // BMR bilgisini de dönersek UI'da "Minimum Sınır" olarak gösterebiliriz
  };
}
