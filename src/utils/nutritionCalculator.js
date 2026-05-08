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
  // 1. BMR (Bazal Metabolizma Hızı) Hesaplama
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
  const modifier = GOAL_MODIFIERS[goal] || 0;
  const targetCalories = Math.round(tdee + modifier);

  // 4. Makro Dağılımı (Protein: 2g/kg, Yağ: %25, Karb: Kalan)
  // Protein (1g = 4 kcal)
  const proteinGrams = Math.round(weight * 2);
  const proteinKcal = proteinGrams * 4;

  // Yağ (1g = 9 kcal) - Toplam kalorinin %25'i
  const fatKcal = targetCalories * 0.25;
  const fatGrams = Math.round(fatKcal / 9);

  // Karbonhidrat (1g = 4 kcal) - Kalan kalori
  const carbsKcal = targetCalories - (proteinKcal + fatKcal);
  const carbsGrams = Math.round(carbsKcal / 4);

  // Su Hedefi (Her 30kg için 1 litre kuralı + basitlik)
  const waterGoal = Math.round((weight * 35)); // ml cinsinden

  return {
    calories: targetCalories,
    protein: proteinGrams,
    fat: fatGrams,
    carbs: carbsGrams,
    waterGoal: waterGoal
  };
}
