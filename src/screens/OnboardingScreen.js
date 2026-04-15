import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Animated, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useI18n } from '../utils/i18n';
import { saveAppSettings } from '../storage';
import { APP_SETTINGS_CHANGED } from '../events/appSettings';
import { DeviceEventEmitter } from 'react-native';

export default function OnboardingScreen({ onFinish }) {
  const { t, langCode, changeLanguage } = useI18n();
  const [step, setStep] = useState(1);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [securityType, setSecurityType] = useState(null); // 'none', 'biometric', 'pin'
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStep, setPinStep] = useState(1);
  const [hasBiometrics, setHasBiometrics] = useState(false);

  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const saved = await LocalAuthentication.isEnrolledAsync();
      setHasBiometrics(compatible && saved);
    })();
  }, []);

  const nextStep = () => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true })
    ]).start(() => setStep(s => s + 1));
  };

  const handleFinish = async (method, code = null) => {
    const config = { isOnboarded: true, authMethod: method };
    if (code) config.pinCode = code;
    await saveAppSettings(config);
    DeviceEventEmitter.emit(APP_SETTINGS_CHANGED);
    if (onFinish) onFinish();
  };

  const handleBiometricSetup = async () => {
    const auth = await LocalAuthentication.authenticateAsync({ promptMessage: t('useBiometric') });
    if (auth.success) {
      handleFinish('biometric');
    } else {
      Alert.alert('Error', 'Yüz / Parmak izi okunamadı. Başka yöntem seçebilirsiniz.');
    }
  };

  const handlePinNext = () => {
    if (pin.length !== 4) return;
    if (pinStep === 1) {
      setPinStep(2);
    } else {
      if (pin === confirmPin) {
        handleFinish('pin', pin);
      } else {
        Alert.alert('Hata', 'PIN kodları eşleşmedi. Tekrar deneyin.');
        setPin('');
        setConfirmPin('');
        setPinStep(1);
      }
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Feather name="globe" size={48} color="#FFD700" style={styles.icon} />
            <Text style={styles.title}>{t('welcome')}!</Text>
            <Text style={styles.subtitle}>{t('onboardSubtitle')}</Text>
            
            <View style={styles.langWrapper}>
              <Text style={styles.label}>{t('selectLanguage')}</Text>
              <View style={styles.row}>
                <TouchableOpacity 
                  style={[styles.chip, langCode === 'tr' && styles.chipActive]} 
                  onPress={() => changeLanguage('tr')}
                >
                  <Text style={[styles.chipText, langCode === 'tr' && styles.chipTextActive]}>Türkçe</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.chip, langCode === 'en' && styles.chipActive]} 
                  onPress={() => changeLanguage('en')}
                >
                  <Text style={[styles.chipText, langCode === 'en' && styles.chipTextActive]}>English</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.btnPrimary} onPress={nextStep}>
              <Text style={styles.btnPrimaryText}>{t('continue')}</Text>
              <Feather name="arrow-right" size={20} color="#000" />
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            <Feather name="shield" size={48} color="#4CAF50" style={styles.icon} />
            <Text style={styles.title}>{t('setupSecurity')}</Text>
            <Text style={styles.subtitle}>{t('securityDesc')}</Text>
            
            <View style={{ width: '100%', gap: 16, marginTop: 20 }}>
              {hasBiometrics && (
                <TouchableOpacity style={styles.methodBtn} onPress={handleBiometricSetup}>
                  <Feather name="smile" size={24} color="#fff" />
                  <Text style={styles.methodText}>{t('useBiometric')}</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity style={styles.methodBtn} onPress={() => { setSecurityType('pin'); nextStep(); }}>
                <Feather name="hash" size={24} color="#fff" />
                <Text style={styles.methodText}>{t('usePin')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.methodBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#555' }]} onPress={() => handleFinish('none')}>
                <Text style={styles.methodText}>{t('skipSecurity')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 3 && securityType === 'pin' && (
          <View style={styles.stepContainer}>
            <Feather name="lock" size={48} color="#FF9800" style={styles.icon} />
            <Text style={styles.title}>{t('createPin')}</Text>
            <Text style={styles.subtitle}>{pinStep === 1 ? t('pinHint') : 'Lütfen tekrar girin (Confirm)'}</Text>
            
            <TextInput
              style={styles.pinInput}
              keyboardType="numeric"
              maxLength={4}
              autoFocus
              value={pinStep === 1 ? pin : confirmPin}
              onChangeText={pinStep === 1 ? setPin : setConfirmPin}
              secureTextEntry
            />

            {(pinStep === 1 ? pin.length === 4 : confirmPin.length === 4) && (
              <TouchableOpacity style={styles.btnPrimary} onPress={handlePinNext}>
                <Text style={styles.btnPrimaryText}>{pinStep === 1 ? t('continue') : t('startApp')}</Text>
                <Feather name="check" size={20} color="#000" />
              </TouchableOpacity>
            )}
          </View>
        )}

      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, width: '100%' },
  stepContainer: { width: '100%', alignItems: 'center' },
  icon: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 15, color: '#A0A0A0', textAlign: 'center', marginBottom: 40, lineHeight: 22 },
  langWrapper: { width: '100%', marginBottom: 40 },
  label: { color: '#888', marginBottom: 10, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', gap: 12, width: '100%' },
  chip: { flex: 1, backgroundColor: '#1E1E1E', paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  chipActive: { borderColor: '#FFD700', backgroundColor: '#332b00' },
  chipText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  chipTextActive: { color: '#FFD700' },
  btnPrimary: { width: '100%', flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 20 },
  btnPrimaryText: { color: '#000', fontSize: 18, fontWeight: '700' },
  methodBtn: { width: '100%', flexDirection: 'row', backgroundColor: '#1E1E1E', padding: 20, borderRadius: 16, alignItems: 'center', gap: 16 },
  methodText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  pinInput: { width: '60%', backgroundColor: '#1E1E1E', color: '#fff', fontSize: 32, textAlign: 'center', padding: 16, borderRadius: 16, letterSpacing: 10, marginBottom: 20 }
});
