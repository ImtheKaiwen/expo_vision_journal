import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView, Animated, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { calculateDailyTargets } from '../utils/nutritionCalculator';
import { saveNutritionSettings } from '../storage';
import { useI18n } from '../utils/i18n';

export default function NutritionOnboarding({ onFinish }) {
  const { t } = useI18n();

  const GENDERS = [
    { id: 'male', label: t('male'), icon: 'user' },
    { id: 'female', label: t('female'), icon: 'user' },
  ];

  const ACTIVITY_LEVELS = [
    { id: 'sedentary', label: t('sedentary'), desc: t('sedentaryDesc') },
    { id: 'light', label: t('lightActive'), desc: t('lightActiveDesc') },
    { id: 'moderate', label: t('moderateActive'), desc: t('moderateActiveDesc') },
    { id: 'active', label: t('veryActive'), desc: t('veryActiveDesc') },
  ];

  const GOALS = [
    { id: 'lose', label: t('loseWeight'), icon: 'trending-down' },
    { id: 'maintain', label: t('maintainWeight'), icon: 'minus' },
    { id: 'gain', label: t('gainWeight'), icon: 'trending-up' },
  ];
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    gender: 'male',
    age: '25',
    weight: '70',
    height: '175',
    activityLevel: 'moderate',
    goal: 'maintain',
  });

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
    else handleSave();
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSave = async () => {
    const numericData = {
      ...data,
      age: parseInt(data.age),
      weight: parseFloat(data.weight),
      height: parseInt(data.height),
    };

    const targets = calculateDailyTargets(numericData);
    const finalSettings = {
      ...numericData,
      targets,
      isOnboarded: true,
      waterGoal: targets.waterGoal,
    };

    await saveNutritionSettings(finalSettings);
    onFinish(finalSettings);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>{t('whatIsGender')}</Text>
            <View style={styles.optionGrid}>
              {GENDERS.map(g => (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.optionCard, data.gender === g.id && styles.optionCardActive]}
                  onPress={() => setData({ ...data, gender: g.id })}
                >
                  <Feather name={g.icon} size={32} color={data.gender === g.id ? '#000' : '#fff'} />
                  <Text style={[styles.optionLabel, data.gender === g.id && styles.optionLabelActive]}>{g.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>{t('bodyInfo')}</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('age')}</Text>
              <TextInput
                style={styles.input}
                value={data.age}
                onChangeText={t => setData({ ...data, age: t })}
                keyboardType="numeric"
                placeholderTextColor="#666"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('height')}</Text>
              <TextInput
                style={styles.input}
                value={data.height}
                onChangeText={t => setData({ ...data, height: t })}
                keyboardType="numeric"
                placeholderTextColor="#666"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('weight')}</Text>
              <TextInput
                style={styles.input}
                value={data.weight}
                onChangeText={t => setData({ ...data, weight: t })}
                keyboardType="numeric"
                placeholderTextColor="#666"
              />
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>{t('activityLevel')}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {ACTIVITY_LEVELS.map(a => (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.listCard, data.activityLevel === a.id && styles.listCardActive]}
                  onPress={() => setData({ ...data, activityLevel: a.id })}
                >
                  <View>
                    <Text style={[styles.listLabel, data.activityLevel === a.id && styles.listLabelActive]}>{a.label}</Text>
                    <Text style={styles.listDesc}>{a.desc}</Text>
                  </View>
                  {data.activityLevel === a.id && <Feather name="check-circle" size={20} color="#000" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        );
      case 4:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>{t('whatIsGoal')}</Text>
            <View style={[styles.optionGrid, { flexWrap: 'wrap', gap: 10 }]}>
              {GOALS.map(g => (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.optionCard, { flex: 1, minWidth: '30%', height: 110 }, data.goal === g.id && styles.optionCardActive]}
                  onPress={() => setData({ ...data, goal: g.id })}
                >
                  <Feather name={g.icon} size={28} color={data.goal === g.id ? '#000' : '#fff'} />
                  <Text 
                    numberOfLines={1} 
                    adjustsFontSizeToFit 
                    style={[styles.optionLabel, { fontSize: 13, paddingHorizontal: 4 }, data.goal === g.id && styles.optionLabelActive]}
                  >
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <View style={styles.progressHeader}>
          {[1, 2, 3, 4].map(s => (
            <View key={s} style={[styles.progressDot, s <= step && styles.progressDotActive]} />
          ))}
        </View>

        <View style={styles.content}>
          {renderStep()}
        </View>

        <View style={styles.footer}>
          {step > 1 && (
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backButtonText}>{t('back')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>{step === 4 ? t('startApp') : t('continue')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 24 },
  progressHeader: { flexDirection: 'row', gap: 8, marginBottom: 40, marginTop: 40 },
  progressDot: { flex: 1, height: 4, backgroundColor: '#333', borderRadius: 2 },
  progressDotActive: { backgroundColor: '#fff' },
  content: { flex: 1 },
  stepContainer: { flex: 1 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 32 },
  optionGrid: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  optionCard: { flex: 1, maxWidth: 160, aspectRatio: 0.9, backgroundColor: '#1E1E1E', borderRadius: 28, justifyContent: 'center', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: 'transparent' },
  optionCardActive: { backgroundColor: '#fff', borderColor: '#fff' },
  optionLabel: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  optionLabelActive: { color: '#000' },
  inputGroup: { marginBottom: 24 },
  inputLabel: { color: '#A0A0A0', fontSize: 14, marginBottom: 8 },
  input: { backgroundColor: '#1E1E1E', borderRadius: 16, padding: 16, color: '#fff', fontSize: 18 },
  listCard: { backgroundColor: '#1E1E1E', padding: 20, borderRadius: 20, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listCardActive: { backgroundColor: '#fff' },
  listLabel: { color: '#fff', fontSize: 18, fontWeight: '600' },
  listLabelActive: { color: '#000' },
  listDesc: { color: '#A0A0A0', fontSize: 13, marginTop: 4 },
  footer: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  backButton: { flex: 1, height: 56, justifyContent: 'center', alignItems: 'center' },
  backButtonText: { color: '#A0A0A0', fontSize: 16 },
  nextButton: { flex: 2, height: 56, backgroundColor: '#fff', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  nextButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
});
