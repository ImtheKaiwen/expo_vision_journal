import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Animated, DeviceEventEmitter } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Feather } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import OnboardingScreen from './src/screens/OnboardingScreen';
import { I18nProvider } from './src/utils/i18n';
import PinAuth from './src/components/PinAuth';
import VisionScreen from './src/screens/VisionScreen';
import JournalScreen from './src/screens/JournalScreen';
import NutritionScreen from './src/screens/NutritionScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { getAppSettings } from './src/storage';
import {
  allowsNotifications,
  requestNotificationPermissionsFromUser,
  rescheduleDailyNotificationsIfGranted,
} from './src/notifications/dailyReminder';
import { scheduleVisionCheckinNotification } from './src/notifications/visionCheckin';
import { APP_SETTINGS_CHANGED } from './src/events/appSettings';
import { setupIAP } from './src/services/iapService';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Tab = createBottomTabNavigator();

export default function App() {
  const [bootReady, setBootReady] = useState(false);
  const [hardwareReady, setHardwareReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(true);
  const [authMethod, setAuthMethod] = useState('biometric'); // biometric, pin, none
  const [pinCode, setPinCode] = useState(null);
  const [showPinScreen, setShowPinScreen] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const notificationLaunchHandled = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const settings = await getAppSettings();
        setIsOnboarded(settings.isOnboarded !== false);
        
        let method = settings.authMethod;
        if (!method) method = settings.biometricEnabled === false ? 'none' : 'biometric';
        setAuthMethod(method);
        setPinCode(settings.pinCode);

        if (method === 'none') {
          setIsAuthenticated(true);
        }
        await rescheduleDailyNotificationsIfGranted();
        await scheduleVisionCheckinNotification();
        await setupIAP();
      } catch (e) {
        console.warn('[App] boot:', e?.message ?? e);
      } finally {
        setBootReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(APP_SETTINGS_CHANGED, async () => {
      const settings = await getAppSettings();
      setIsOnboarded(settings.isOnboarded !== false);
      let method = settings.authMethod;
      if (!method) method = settings.biometricEnabled === false ? 'none' : 'biometric';
      setAuthMethod(method);
      setPinCode(settings.pinCode);
      if (method === 'none') {
        setIsAuthenticated(true);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setIsBiometricSupported(compatible);
      setHardwareReady(true);
    })();
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, isAuthenticated]);

  const handleAuthentication = async () => {
    if (authMethod === 'pin') {
      setShowPinScreen(true);
      return;
    }

    if (authMethod === 'biometric') {
      const savedBiometrics = await LocalAuthentication.isEnrolledAsync();
      if (!savedBiometrics) {
        if (pinCode) {
          setShowPinScreen(true);
          return;
        }
        Alert.alert('Hata', 'Cihazda kayıtlı biyometri bulunamadı.');
        return;
      }

      const biometricAuth = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Kişisel Alana Giriş',
        fallbackLabel: pinCode ? 'PIN Kullan' : undefined,
      });

      if (biometricAuth.success) {
        fadeAnim.setValue(0);
        setIsAuthenticated(true);
      } else {
        if (pinCode) setShowPinScreen(true);
      }
    }
  };

  useEffect(() => {
    if (!bootReady || !hardwareReady || authMethod === 'none' || !isOnboarded) return;
    if (authMethod === 'biometric' && !isBiometricSupported && pinCode) {
      setShowPinScreen(true);
      return;
    }
    if (authMethod === 'biometric' && !isBiometricSupported && !pinCode) {
       setIsAuthenticated(true);
       return;
    }
    if (!isAuthenticated && !showPinScreen) handleAuthentication();
  }, [isBiometricSupported, bootReady, authMethod, hardwareReady, isOnboarded, isAuthenticated, showPinScreen]);

  /** Ana ekrana geçince: yalnızca hiç sorulmadıysa (undetermined) sistem izin penceresini göster. */
  useEffect(() => {
    if (!bootReady || !isOnboarded) return;
    if (authMethod !== 'none' && !isAuthenticated) return;
    const timer = setTimeout(async () => {
      if (notificationLaunchHandled.current) return;
      notificationLaunchHandled.current = true;
      try {
        const perm = await Notifications.getPermissionsAsync();
        if (allowsNotifications(perm)) {
          await rescheduleDailyNotificationsIfGranted();
          await scheduleVisionCheckinNotification();
          return;
        }
        if (perm.status === 'undetermined') {
          await requestNotificationPermissionsFromUser();
        }
        await rescheduleDailyNotificationsIfGranted();
        await scheduleVisionCheckinNotification();
      } catch (e) {
        console.warn('[App] bildirim giriş isteği:', e?.message ?? e);
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [bootReady, authMethod, isAuthenticated, isOnboarded]);

  if (!bootReady) {
    return (
      <View style={styles.bootSplash}>
        <Animated.Image 
          source={require('./assets/icon.png')} 
          style={[styles.splashIcon, { opacity: fadeAnim }]} 
          resizeMode="contain"
        />
        <Animated.Text style={[styles.splashText, { opacity: fadeAnim }]}>
          Gününüzü planlayın
        </Animated.Text>
      </View>
    );
  }

  const renderContent = () => {
    if (!isOnboarded) {
      return (
        <OnboardingScreen onFinish={() => setIsOnboarded(true)} />
      );
    }

    if (authMethod !== 'none' && !isAuthenticated) {
      return (
        <View style={styles.authContainer}>
          {showPinScreen ? (
            <PinAuth 
              correctPin={pinCode} 
              onSuccess={() => { setShowPinScreen(false); setIsAuthenticated(true); fadeAnim.setValue(0); }}
              onBiometricFallback={authMethod === 'biometric' ? () => { setShowPinScreen(false); handleAuthentication(); } : null}
            />
          ) : (
            <Animated.View style={[styles.authCard, { opacity: fadeAnim }]}>
              <Feather name="shield" size={48} color="#ffffff" style={{ marginBottom: 20 }} />
              <Text style={styles.authTitle}>Kişisel Alan</Text>
              <Text style={styles.authSubtitle}>Giriş için yetki gerekli</Text>
              <TouchableOpacity style={styles.authButton} onPress={handleAuthentication}>
                <Feather name="maximize" size={20} color="#000000" />
                <Text style={styles.authButtonText}>Doğrula</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      );
    }

    return (
      <NavigationContainer theme={{ colors: { background: '#121212' } }}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarStyle: styles.tabBar,
            tabBarShowLabel: false,
            tabBarIcon: ({ color, focused }) => {
              let iconName;
              if (route.name === 'Vision') iconName = 'compass';
              else if (route.name === 'Journal') iconName = 'book-open';
              else if (route.name === 'Diet') iconName = 'pie-chart';
              else if (route.name === 'Analytics') iconName = 'activity';
              else if (route.name === 'Settings') iconName = 'settings';
              return <Feather name={iconName} size={focused ? 28 : 24} color={color} />;
            },
            tabBarActiveTintColor: '#ffffff',
            tabBarInactiveTintColor: '#555555',
          })}
        >
          <Tab.Screen name="Vision" component={VisionScreen} />
          <Tab.Screen name="Journal" component={JournalScreen} />
          <Tab.Screen name="Diet" component={NutritionScreen} />
          <Tab.Screen name="Analytics" component={AnalyticsScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    );
  };

  return (
    <I18nProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim, backgroundColor: '#121212' }}>
          {renderContent()}
        </Animated.View>
      </GestureHandlerRootView>
    </I18nProvider>
  );
}

const styles = StyleSheet.create({
  bootSplash: { flex: 1, backgroundColor: '#121212' },
  authContainer: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' },
  authCard: { backgroundColor: '#1E1E1E', padding: 32, borderRadius: 24, alignItems: 'center', width: '85%' },
  authTitle: { fontSize: 24, fontWeight: '600', color: '#ffffff', marginBottom: 8 },
  authSubtitle: { fontSize: 14, color: '#A0A0A0', marginBottom: 32 },
  authButton: { flexDirection: 'row', backgroundColor: '#ffffff', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 16, alignItems: 'center', gap: 10, width: '100%', justifyContent: 'center' },
  authButtonText: { color: '#000000', fontSize: 16, fontWeight: '600' },
  tabBar: {
    backgroundColor: '#1E1E1E',
    borderTopWidth: 0,
    elevation: 0,
    height: 85,
    paddingBottom: 25,
    paddingTop: 10,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    position: 'absolute',
  },
  bootSplash: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' },
  splashIcon: { width: 120, height: 120, marginBottom: 24 },
  splashText: { color: '#fff', fontSize: 18, fontWeight: '600', letterSpacing: 1 },
});
