import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Animated } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Feather } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import VisionScreen from './src/screens/VisionScreen';
import JournalScreen from './src/screens/JournalScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';

// Bildirimlerin uygulama açıkken de görünmesi için zorunlu ayar:
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Tab = createBottomTabNavigator();

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const scheduleNotifications = async () => {
    const settings = await Notifications.getPermissionsAsync();
    let isGranted = settings.granted;
    
    if (!isGranted) {
      const request = await Notifications.requestPermissionsAsync();
      isGranted = request.granted;
    }

    if (isGranted) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Vizyon Vakti 🚀",
          body: "Bugün olmak istediğin kişiyi hatırla, notlarını oku.",
        },
        trigger: { hour: 9, minute: 0, repeats: true },
      });
    }
  };

  useEffect(() => {
    scheduleNotifications();
  }, []);

  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setIsBiometricSupported(compatible);
    })();
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 1000, useNativeDriver: true,
    }).start();
  }, [fadeAnim, isAuthenticated]);

  const handleAuthentication = async () => {
    const savedBiometrics = await LocalAuthentication.isEnrolledAsync();
    if (!savedBiometrics) return Alert.alert('Hata', 'Cihazda Face ID bulunamadı.');

    const biometricAuth = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Kişisel Alana Giriş',
    });

    if (biometricAuth.success) {
      fadeAnim.setValue(0);
      setIsAuthenticated(true);
    }
  };

  useEffect(() => {
    if (isBiometricSupported && !isAuthenticated) handleAuthentication();
  }, [isBiometricSupported]);

  if (!isAuthenticated) {
    return (
      <View style={styles.authContainer}>
        <Animated.View style={[styles.authCard, { opacity: fadeAnim }]}>
          <Feather name="lock" size={48} color="#ffffff" style={{ marginBottom: 20 }} />
          <Text style={styles.authTitle}>Kişisel Alan</Text>
          <Text style={styles.authSubtitle}>Giriş yapmak için Face ID kullanın</Text>
          <TouchableOpacity style={styles.authButton} onPress={handleAuthentication}>
            <Feather name="maximize" size={20} color="#000000" />
            <Text style={styles.authButtonText}>Doğrula</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim, backgroundColor: '#121212' }}>
        <NavigationContainer theme={{ colors: { background: '#121212' } }}>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: false,
              tabBarStyle: styles.tabBar,
              tabBarShowLabel: false,
              tabBarIcon: ({ color, size, focused }) => {
                let iconName;
                if (route.name === 'Vision') iconName = 'compass';
                else if (route.name === 'Journal') iconName = 'book-open';
                else if (route.name === 'Analytics') iconName = 'activity';
                return <Feather name={iconName} size={focused ? 28 : 24} color={color} />;
              },
              tabBarActiveTintColor: '#ffffff',
              tabBarInactiveTintColor: '#555555',
            })}
          >
            <Tab.Screen name="Vision" component={VisionScreen} />
            <Tab.Screen name="Journal" component={JournalScreen} />
            <Tab.Screen name="Analytics" component={AnalyticsScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  authContainer: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' },
  authCard: { backgroundColor: '#1E1E1E', padding: 32, borderRadius: 24, alignItems: 'center', width: '85%' },
  authTitle: { fontSize: 24, fontWeight: '600', color: '#ffffff', marginBottom: 8 },
  authSubtitle: { fontSize: 14, color: '#A0A0A0', marginBottom: 32 },
  authButton: { flexDirection: 'row', backgroundColor: '#ffffff', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 16, alignItems: 'center', gap: 10, width: '100%', justifyContent: 'center' },
  authButtonText: { color: '#000000', fontSize: 16, fontWeight: '600' },
  tabBar: { backgroundColor: '#1E1E1E', borderTopWidth: 0, elevation: 0, height: 85, paddingBottom: 25, paddingTop: 10, borderTopLeftRadius: 30, borderTopRightRadius: 30, position: 'absolute' }
});