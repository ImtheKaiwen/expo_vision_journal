import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Animated, TextInput, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useI18n } from '../utils/i18n';
import { saveAppSettings } from '../storage';
import { APP_SETTINGS_CHANGED } from '../events/appSettings';
import { DeviceEventEmitter } from 'react-native';

const { width } = Dimensions.get('window');

const TutorialAnimatedCard = ({ type, mode }) => {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(800),
        Animated.timing(slideAnim, {
          toValue: mode === 'left' ? -80 : (type === 'journal' ? 80 : 130),
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.delay(1200),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [mode, slideAnim, type]);

  return (
    <View style={tutorialStyles.cardWrapper}>
      <View style={[tutorialStyles.bgActions, mode === 'left' ? { justifyContent: 'flex-end', paddingRight: 10 } : { justifyContent: 'flex-start', paddingLeft: 10 }]}>
        {mode === 'left' ? (
          <View style={[tutorialStyles.actionBtn, { backgroundColor: '#F44336' }]}>
            <Feather name="trash-2" size={20} color="#fff" />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={[tutorialStyles.actionBtn, { backgroundColor: '#2196F3' }]}>
              <Feather name="copy" size={20} color="#fff" />
            </View>
            {type === 'vision' && (
              <View style={[tutorialStyles.actionBtn, { backgroundColor: '#FF9800' }]}>
                <Feather name="edit-2" size={20} color="#fff" />
              </View>
            )}
          </View>
        )}
      </View>
      <Animated.View style={[tutorialStyles.fgCard, { transform: [{ translateX: slideAnim }] }]}>
        <View style={tutorialStyles.cardIcon}>
          <Feather name={type === 'vision' ? "star" : "file-text"} size={18} color={type === 'vision' ? "#4CAF50" : "#2196F3"} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={tutorialStyles.lineLong} />
          <View style={tutorialStyles.lineShort} />
        </View>
      </Animated.View>
    </View>
  );
};

const TutorialPullDown = () => {
  const moveAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(moveAnim, { toValue: 60, duration: 1500, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.delay(900),
            Animated.timing(opacityAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
          ])
        ]),
        Animated.timing(moveAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(500),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [moveAnim, opacityAnim]);

  return (
    <View style={tutorialStyles.pullDownContainer}>
       <Animated.View style={{ transform: [{ translateY: moveAnim }], opacity: opacityAnim, zIndex: 2 }}>
         <Feather name="mouse-pointer" size={32} color="#fff" />
       </Animated.View>
       <View style={tutorialStyles.fakeHeader}>
         <Feather name="refresh-cw" size={20} color="#4CAF50" />
       </View>
       <View style={[tutorialStyles.cardWrapper, { marginTop: 10, opacity: 0.5 }]}>
          <View style={tutorialStyles.fgCard}>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={tutorialStyles.lineLong} />
              <View style={tutorialStyles.lineShort} />
            </View>
          </View>
       </View>
    </View>
  );
};

export default function OnboardingScreen({ onFinish }) {
  const { t, langCode, changeLanguage } = useI18n();
  const [step, setStep] = useState(1);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [securityType, setSecurityType] = useState(null); // 'none', 'biometric', 'pin'
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStep, setPinStep] = useState(1);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [userName, setUserName] = useState('');

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
    const config = { isOnboarded: true, authMethod: method, userName: userName.trim() };
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

  const renderDots = (currentStep) => {
    const total = 6; // PIN adımı hariç ana akış
    return (
      <View style={styles.progressDots}>
        {Array.from({ length: total }).map((_, i) => {
          const d = i + 1;
          return <View key={d} style={[styles.dot, currentStep === d && styles.dotActive]} />;
        })}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        
        {step === 1 && (
          <View style={styles.stepContainer}>
            {renderDots(1)}
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
            {renderDots(2)}
            <Feather name="user" size={48} color="#FF4081" style={styles.icon} />
            <Text style={styles.title}>{t('nameStepTitle')}</Text>
            <Text style={styles.subtitle}>{t('nameStepSubtitle')}</Text>
            
            <TextInput
              style={styles.nameInput}
              value={userName}
              onChangeText={setUserName}
              placeholder={t('userNamePlaceholder')}
              placeholderTextColor="#555"
              autoFocus
              maxLength={20}
            />

            <TouchableOpacity 
              style={[styles.btnPrimary, !userName.trim() && { opacity: 0.5 }]} 
              onPress={userName.trim() ? nextStep : () => Alert.alert(t('warning'), t('nameError'))}
              disabled={!userName.trim()}
            >
              <Text style={styles.btnPrimaryText}>{t('continue')}</Text>
              <Feather name="arrow-right" size={20} color="#000" />
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            {renderDots(3)}
            <Feather name="compass" size={60} color="#4CAF50" style={styles.icon} />
            <Text style={styles.title}>{t('tutorialVisionTitle')}</Text>
            <Text style={[styles.subtitle, { marginBottom: 20 }]}>{t('tutorialVisionDesc')}</Text>
            
            <View style={tutorialStyles.demoArea}>
              <TutorialAnimatedCard type="vision" mode="right" />
              <TutorialAnimatedCard type="vision" mode="left" />
            </View>

            <TouchableOpacity style={styles.btnPrimary} onPress={nextStep}>
              <Text style={styles.btnPrimaryText}>{t('continue')}</Text>
              <Feather name="arrow-right" size={20} color="#000" />
            </TouchableOpacity>
          </View>
        )}

        {step === 4 && (
          <View style={styles.stepContainer}>
            {renderDots(4)}
            <Feather name="plus-circle" size={60} color="#FFD700" style={styles.icon} />
            <Text style={styles.title}>{t('tutorialAddVisionTitle')}</Text>
            <Text style={[styles.subtitle, { marginBottom: 20 }]}>{t('tutorialAddVisionDesc')}</Text>
            
            <View style={tutorialStyles.demoArea}>
              <TutorialPullDown />
            </View>

            <TouchableOpacity style={styles.btnPrimary} onPress={nextStep}>
              <Text style={styles.btnPrimaryText}>{t('continue')}</Text>
              <Feather name="arrow-right" size={20} color="#000" />
            </TouchableOpacity>
          </View>
        )}

        {step === 5 && (
          <View style={styles.stepContainer}>
            {renderDots(5)}
            <Feather name="book-open" size={60} color="#2196F3" style={styles.icon} />
            <Text style={styles.title}>{t('tutorialJournalTitle')}</Text>
            <Text style={[styles.subtitle, { marginBottom: 20 }]}>{t('tutorialJournalDesc')}</Text>
            
            <View style={tutorialStyles.demoArea}>
              <TutorialAnimatedCard type="journal" mode="right" />
              <TutorialAnimatedCard type="journal" mode="left" />
            </View>

            <TouchableOpacity style={styles.btnPrimary} onPress={nextStep}>
              <Text style={styles.btnPrimaryText}>{t('continue')}</Text>
              <Feather name="arrow-right" size={20} color="#000" />
            </TouchableOpacity>
          </View>
        )}

        {step === 6 && (
          <View style={styles.stepContainer}>
            {renderDots(6)}
            <Feather name="shield" size={48} color="#FF9800" style={styles.icon} />
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

        {step === 7 && securityType === 'pin' && (
          <View style={styles.stepContainer}>
            <Feather name="lock" size={48} color="#FFD700" style={styles.icon} />
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

const tutorialStyles = StyleSheet.create({
  demoArea: { width: '100%', gap: 12, marginBottom: 20, alignItems: 'center' },
  cardWrapper: { width: width * 0.8, height: 70, backgroundColor: '#1E1E1E', borderRadius: 16, overflow: 'hidden', justifyContent: 'center' },
  bgActions: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', alignItems: 'center', backgroundColor: '#121212' },
  actionBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fgCard: { width: '100%', height: '100%', backgroundColor: '#222', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  cardIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  lineLong: { width: '70%', height: 8, backgroundColor: '#444', borderRadius: 4 },
  lineShort: { width: '40%', height: 8, backgroundColor: '#333', borderRadius: 4 },
  pullDownContainer: { width: width * 0.8, height: 160, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 20, backgroundColor: '#1E1E1E', borderRadius: 24, overflow: 'hidden' },
  fakeHeader: { width: '100%', height: 40, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#333' },
  pullLine: { width: 2, height: 40, backgroundColor: 'rgba(255,255,255,0.1)', position: 'absolute', top: 50 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, width: '100%' },
  stepContainer: { width: '100%', alignItems: 'center' },
  icon: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 14, color: '#A0A0A0', textAlign: 'center', marginBottom: 40, lineHeight: 22 },
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
  pinInput: { width: '60%', backgroundColor: '#1E1E1E', color: '#fff', fontSize: 32, textAlign: 'center', padding: 16, borderRadius: 16, letterSpacing: 10, marginBottom: 20 },
  nameInput: { width: '100%', backgroundColor: '#1E1E1E', color: '#fff', fontSize: 18, padding: 16, borderRadius: 16, marginBottom: 20, textAlign: 'center' },
  progressDots: { flexDirection: 'row', gap: 8, marginBottom: 24, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#333' },
  dotActive: { backgroundColor: '#fff', width: 24 },
});
