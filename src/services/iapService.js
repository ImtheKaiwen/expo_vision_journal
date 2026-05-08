import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// RevenueCat API anahtarların
const API_KEYS = {
  apple: "appl_XGxUsnonwLhVkzBEyCMFggLjlla", // Gerçek Apple Anahtarı
  test: "test_ofTTPPqHevBnGjOnDPbjOHmaKUJ",   // Expo Go için Test Anahtarı
  google: "test_ofTTPPqHevBnGjOnDPbjOHmaKUJ"
};

// Expo Go'da olup olmadığımızı kontrol edelim
const isExpoGo = Constants.appOwnership === 'expo' || Constants.expoVersion;
const ACTIVE_KEY = isExpoGo ? API_KEYS.test : API_KEYS.apple;

// Senin panelde belirlediğin Entitlement ID
const ENTITLEMENT_ID = "Vision Journal - Hedef Takibi Pro";

export const setupIAP = async () => {
  try {
    // Logları açalım ki hatayı görebilelim
    Purchases.setLogLevel(Purchases.LOG_LEVEL.VERBOSE);

    if (Platform.OS === 'ios') {
      await Purchases.configure({ apiKey: ACTIVE_KEY });
    } else if (Platform.OS === 'android') {
      await Purchases.configure({ apiKey: API_KEYS.google });
    }
    
    console.log('--- RevenueCat Başarıyla Yapılandırıldı ---');
  } catch (e) {
    console.error('IAP Setup Error:', e);
  }
};

export const getOfferings = async () => {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current !== null) {
      return offerings.current.availablePackages;
    }
    return [];
  } catch (e) {
    console.error('Offerings Error:', e);
    return [];
  }
};

export const purchasePackage = async (pack) => {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pack);
    return typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== "undefined";
  } catch (e) {
    if (!e.userCancelled) {
      console.error('Purchase Error:', e);
    }
    return false;
  }
};

export const restorePurchases = async () => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== "undefined";
  } catch (e) {
    console.error('Restore Error:', e);
    return false;
  }
};

export const checkPremiumStatus = async () => {
  try {
    // getCustomerInfo genelde günceldir ama bazen cache kalabilir. 
    // Çok sık çağırmak performansı etkilemez, SDK bunu yönetir.
    const customerInfo = await Purchases.getCustomerInfo();
    const isActive = typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== "undefined";
    return isActive;
  } catch (e) {
    return false;
  }
};
