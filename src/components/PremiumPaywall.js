import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Dimensions,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useI18n } from '../utils/i18n';
import { saveAppSettings } from '../storage';
import { getOfferings, purchasePackage, restorePurchases } from '../services/iapService';

const { width, height } = Dimensions.get('window');

export default function PremiumPaywall({ visible, onClose, onPurchaseSuccess }) {
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    if (visible) {
      loadPackages();
    }
  }, [visible]);

  const loadPackages = async () => {
    setFetching(true);
    const available = await getOfferings();
    setPackages(available);
    if (available.length > 0) {
      // Varsayılan olarak yıllık veya en pahalı paketi seçelim
      const yearly = available.find(p => p.packageType === 'ANNUAL');
      setSelectedPackage(yearly || available[0]);
    }
    setFetching(false);
  };

  const handlePurchase = async () => {
    if (!selectedPackage) return;
    setLoading(true);
    const success = await purchasePackage(selectedPackage);
    if (success) {
      await saveAppSettings({ isPremium: true });
      onPurchaseSuccess();
    } else {
      Alert.alert(t('error'), t('purchaseError'));
    }
    setLoading(false);
  };

  const handleRestore = async () => {
    setLoading(true);
    const success = await restorePurchases();
    if (success) {
      await saveAppSettings({ isPremium: true });
      Alert.alert(t('success'), t('restoreSuccess'), [{ text: t('savedBtn'), onPress: onPurchaseSuccess }]);
    } else {
      Alert.alert(t('info'), t('noSubscriptionFound'));
    }
    setLoading(false);
  };

  const features = [
    { icon: 'cpu', title: t('aiPlanner'), desc: t('aiPlannerSubtitle'), color: '#4CAF50' },
    { icon: 'camera', title: t('paywallMealTitle'), desc: t('paywallMealDesc'), color: '#FF9800' },
    { icon: 'pie-chart', title: t('paywallAiTitle'), desc: t('paywallAiDesc'), color: '#2196F3' },
    { icon: 'trending-up', title: t('paywallVisionTitle'), desc: t('paywallVisionDesc'), color: '#9C27B0' }
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent={false} presentationStyle="fullScreen">
      <View style={styles.container}>
        <View style={styles.topGradient} />
        
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={handleRestore}>
              <Text style={styles.restoreText}>{t('restore')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={28} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>

          <View style={styles.header}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>VISION PRO</Text>
            </View>
            <Text style={styles.title}>{t('unleashPotential')}</Text>
          </View>

          <View style={styles.featuresGrid}>
            {features.map((f, i) => (
              <View key={i} style={styles.featureCard}>
                <View style={[styles.iconBox, { backgroundColor: f.color + '20' }]}>
                  <Feather name={f.icon} size={24} color={f.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.pricingSection}>
            {fetching ? (
              <ActivityIndicator color="#FFD700" size="large" style={{ marginVertical: 30 }} />
            ) : (
              packages.map((pack) => (
                <TouchableOpacity 
                  key={pack.identifier}
                  style={[styles.priceCard, selectedPackage?.identifier === pack.identifier && styles.priceCardSelected]} 
                  onPress={() => setSelectedPackage(pack)}
                >
                  <View>
                    <Text style={styles.priceLabel}>
                      {pack.packageType === 'ANNUAL' ? t('yearlyMembership') : 
                       pack.packageType === 'MONTHLY' ? t('monthlyMembership') : 
                       pack.packageType === 'SIX_MONTH' ? t('sixMonthMembership') : t('specialMembership')}
                    </Text>
                    <Text style={styles.priceValue}>{pack.product.priceString}</Text>
                  </View>
                  {pack.packageType === 'ANNUAL' && (
                    <View style={styles.savingsBadge}>
                      <Text style={styles.savingsText}>{t('bestValue')}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            )}

            <TouchableOpacity 
              style={[styles.mainBtn, (loading || fetching || !selectedPackage) && { opacity: 0.7 }]} 
              onPress={handlePurchase}
              disabled={loading || fetching || !selectedPackage}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Text style={styles.mainBtnText}>{t('startVisionPro')}</Text>
                  <Feather name="arrow-right" size={20} color="#000" />
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.footerNote}>
              {t('cancelAnytime')}
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  topGradient: {
    position: 'absolute',
    top: -height * 0.2,
    right: -width * 0.2,
    width: width * 1.5,
    height: height * 0.6,
    backgroundColor: '#6200EE',
    opacity: 0.15,
    borderRadius: width,
    transform: [{ scaleX: 1.5 }],
  },
  scrollContent: {
    paddingBottom: 40,
  },
  topBar: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  restoreText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    paddingHorizontal: 24,
    marginTop: 20,
    alignItems: 'center',
  },
  badge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 16,
  },
  badgeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 40,
  },
  featuresGrid: {
    paddingHorizontal: 24,
    marginTop: 30,
    gap: 16,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 20,
    padding: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  featureDesc: {
    color: '#777',
    fontSize: 12,
    lineHeight: 16,
  },
  pricingSection: {
    paddingHorizontal: 24,
    marginTop: 30,
  },
  priceCard: {
    backgroundColor: '#161616',
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 10,
  },
  priceCardSelected: {
    borderColor: '#FFD700',
    backgroundColor: '#1E1E1E',
  },
  priceLabel: {
    color: '#A0A0A0',
    fontSize: 13,
    fontWeight: '600',
  },
  priceValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  savingsBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  savingsText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  mainBtn: {
    backgroundColor: '#fff',
    height: 60,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  mainBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
  footerNote: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
  },
});
