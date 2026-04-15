import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, DeviceEventEmitter, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { saveAppSettings } from '../storage';
import { APP_SETTINGS_CHANGED } from '../events/appSettings';

export default function PinAuth({ correctPin, onSuccess, onBiometricFallback }) {
  const [pin, setPin] = useState('');
  const [resetState, setResetState] = useState('none'); // 'none', 'new', 'confirm'
  const [newPin, setNewPin] = useState('');

  const submit = () => {
    if (resetState === 'none') {
      if (pin === correctPin) {
        onSuccess();
      } else {
        Alert.alert('Hata', 'Hatalı PIN!');
        setPin('');
      }
    }
  };

  const handleForgotPin = async () => {
    try {
      const auth = await LocalAuthentication.authenticateAsync({
        promptMessage: 'PIN kodunuzu sıfırlamak için kimliğinizi doğrulayın',
      });
      if (auth.success) {
        setResetState('new');
        setPin('');
      }
    } catch(e) {
      Alert.alert('Hata', 'Doğrulama sağlanamadı.');
    }
  };

  const submitReset = async (val) => {
    if (resetState === 'new' && val.length === 4) {
       setTimeout(() => {
         setNewPin(val);
         setPin('');
         setResetState('confirm');
       }, 100);
    } else if (resetState === 'confirm' && val.length === 4) {
       setTimeout(async () => {
         if (val === newPin) {
           await saveAppSettings({ pinCode: val });
           DeviceEventEmitter.emit(APP_SETTINGS_CHANGED);
           onSuccess(); // Login them with the new pin
         } else {
           Alert.alert('Hata', 'PIN kodları eşleşmedi. Tekrar deneyin.');
           setPin('');
           setNewPin('');
           setResetState('new');
         }
       }, 100);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', alignItems: 'center' }}>
        <View style={styles.container}>
          <Feather name={resetState !== 'none' ? 'key' : 'lock'} size={48} color={resetState !== 'none' ? '#4CAF50' : '#FF9800'} style={{ marginBottom: 20 }} />
      <Text style={styles.title}>{resetState !== 'none' ? 'Yeni PIN Belirle' : 'Kişisel Alan'}</Text>
      <Text style={styles.subtitle}>
        {resetState === 'none' 
          ? 'Devam etmek için PIN kodunu gir' 
          : resetState === 'new' 
            ? 'Lütfen 4 haneli yeni şifrenizi girin' 
            : 'Lütfen yeni şifrenizi tekrar girin'}
      </Text>
      
      <TextInput
        style={styles.pinInput}
        keyboardType="numeric"
        maxLength={4}
        autoFocus
        value={pin}
        onChangeText={(val) => {
          setPin(val);
          if (val.length === 4) {
             if (resetState === 'none') {
                setTimeout(() => {
                  if (val === correctPin) onSuccess();
                  else { Alert.alert('Hata', 'Hatalı PIN!'); setPin(''); }
                }, 100);
             } else {
                submitReset(val);
             }
          }
        }}
        secureTextEntry
      />

      {resetState === 'none' && (
        <TouchableOpacity style={styles.btnPrimary} onPress={submit}>
          <Text style={styles.btnPrimaryText}>Giriş Yap</Text>
          <Feather name="arrow-right" size={20} color="#000" />
        </TouchableOpacity>
      )}

      {resetState === 'none' && onBiometricFallback && (
        <TouchableOpacity style={styles.biometricBtn} onPress={onBiometricFallback}>
          <Feather name="smile" size={18} color="#A0A0A0" />
          <Text style={styles.biometricBtnText}>Biyometrik Dene</Text>
        </TouchableOpacity>
      )}

      {resetState === 'none' && (
        <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPin}>
           <Feather name="help-circle" size={14} color="#A0A0A0" />
           <Text style={styles.forgotBtnText}>Şifremi unuttum</Text>
        </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#1E1E1E', padding: 32, borderRadius: 24, alignItems: 'center', width: '85%' },
  title: { fontSize: 24, fontWeight: '600', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#A0A0A0', marginBottom: 24, textAlign: 'center' },
  pinInput: { width: '80%', backgroundColor: '#121212', color: '#fff', fontSize: 32, textAlign: 'center', padding: 16, borderRadius: 16, letterSpacing: 10, marginBottom: 20 },
  btnPrimary: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 16, alignItems: 'center', gap: 10, width: '100%', justifyContent: 'center' },
  btnPrimaryText: { color: '#000', fontSize: 16, fontWeight: '600' },
  biometricBtn: { flexDirection: 'row', marginTop: 20, alignItems: 'center', gap: 6 },
  biometricBtnText: { color: '#A0A0A0', fontSize: 14, fontWeight: '500' },
  forgotBtn: { flexDirection: 'row', marginTop: 20, alignItems: 'center', gap: 6, backgroundColor: '#2A2A2A', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  forgotBtnText: { color: '#A0A0A0', fontSize: 13, fontWeight: '500' }
});
