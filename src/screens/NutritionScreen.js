import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import {
  getNutritionSettings,
  getMealLogs,
  deleteMealLog,
  getWaterLogs,
  updateWaterLog,
  getAppSettings,
  saveNutritionSettings,
} from '../storage';
import NutritionOnboarding from '../components/NutritionOnboarding';
import MealAddModal from '../components/MealAddModal';
import PremiumPaywall from '../components/PremiumPaywall';
import { getLocalDateString } from '../utils/journalDates';
import { checkPremiumStatus } from '../services/iapService';
import { useI18n } from '../utils/i18n';

const { width } = Dimensions.get('window');

export default function NutritionScreen() {
  const { t, langCode } = useI18n();
  const isFocused = useIsFocused();
  const today = getLocalDateString();

  const [settings, setSettings] = useState(null);
  const [meals, setMeals] = useState([]);
  const [waterAmount, setWaterAmount] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [activeTab, setActiveTab] = useState('bugun'); // 'bugun' | 'analiz' | 'gecmis'
  const [selectedDay, setSelectedDay] = useState(null);
  const [history, setHistory] = useState([]);
  const [nutritionStats, setNutritionStats] = useState({
    avgCal: 0,
    macroRatio: { p: 0, f: 0, c: 0 },
    weeklyCal: [],
    weeklyWater: [],
    topFoods: [],
  });

  const loadData = useCallback(async () => {
    try {
      const isActuallyPremium = await checkPremiumStatus();
      setIsPremium(isActuallyPremium);

      const s = await getNutritionSettings();
      setSettings(s);
      if (!s.isOnboarded) {
        setShowOnboarding(true);
      } else {
        setShowOnboarding(false);
      }

      const allMeals = await getMealLogs();
      const todayMeals = allMeals.filter((m) => m.date === today);
      setMeals(todayMeals);

      const waters = await getWaterLogs();
      setWaterAmount(waters[today] || 0);

      // Analytics Logic
      const dayLabels = t('shortDayNames').split(',');
      const last7 = [];
      const todayDate = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(todayDate);
        d.setDate(todayDate.getDate() - i);
        last7.push({ dateStr: getLocalDateString(d), dayIndex: d.getDay() });
      }

      const nWeekly = last7.map((dayObj) => {
        const dayMeals = allMeals.filter((m) => m.date === dayObj.dateStr);
        const total = dayMeals.reduce((sum, m) => sum + (m.calories || 0), 0);
        return { label: dayLabels[dayObj.dayIndex], count: total };
      });

      const wWeekly = last7.map((dayObj) => {
        const amount = waters[dayObj.dateStr] || 0;
        return { label: dayLabels[dayObj.dayIndex], count: amount };
      });

      const totals = allMeals.reduce(
        (acc, m) => ({
          p: acc.p + (m.protein || 0),
          f: acc.f + (m.fat || 0),
          c: acc.c + (m.carbs || 0),
        }),
        { p: 0, f: 0, c: 0 }
      );

      const pCal = totals.p * 4;
      const cCal = totals.c * 4;
      const fCal = totals.f * 9;
      const totalMacroCal = pCal + cCal + fCal || 1;

      const foodMap = {};
      allMeals.forEach((m) => {
        foodMap[m.name] = (foodMap[m.name] || 0) + 1;
      });
      const topFoods = Object.entries(foodMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setNutritionStats({
        avgCal: Math.round(
          allMeals.reduce((s, m) => s + (m.calories || 0), 0) /
            Math.max(new Set(allMeals.map((m) => m.date)).size, 1)
        ),
        macroRatio: {
          p: Math.round((pCal / totalMacroCal) * 100),
          f: Math.round((fCal / totalMacroCal) * 100),
          c: Math.round((cCal / totalMacroCal) * 100),
        },
        weeklyCal: nWeekly,
        weeklyWater: wWeekly,
        topFoods,
      });

      const grouped = allMeals.reduce((acc, m) => {
        if (!acc[m.date]) acc[m.date] = { date: m.date, cal: 0, count: 0, meals: [] };
        acc[m.date].cal += m.calories || 0;
        acc[m.date].count += 1;
        acc[m.date].meals.push(m);
        return acc;
      }, {});

      Object.keys(grouped).forEach((date) => {
        grouped[date].water = waters[date] || 0;
      });

      setHistory(Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date)));
    } catch (error) {
      console.error('loadData error:', error);
    }
  }, [today, t]);

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused, loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleWaterAdd = async (amount) => {
    await updateWaterLog(today, amount);
    await loadData();
  };

  const handleDeleteMeal = (mealId) => {
    Alert.alert(t('warning'), t('deleteMealConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteMealLog(mealId);
          await loadData();
        },
      },
    ]);
  };

  const onResetNutrition = () => {
    Alert.alert(t('resetNutritionTitle'), t('resetNutritionConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('resetBtn'),
        style: 'destructive',
        onPress: async () => {
          await saveNutritionSettings({ isOnboarded: false });
          Alert.alert(t('success'), t('resetNutritionSuccess'));
          loadData();
        },
      },
    ]);
  };

  if (!settings) return null;

  const consumed = meals.reduce(
    (acc, m) => ({
      cal: acc.cal + (m.calories || 0),
      protein: acc.protein + (m.protein || 0),
      fat: acc.fat + (m.fat || 0),
      carbs: acc.carbs + (m.carbs || 0),
    }),
    { cal: 0, protein: 0, fat: 0, carbs: 0 }
  );

  const remainingCal = settings.targets.calories - consumed.cal;
  const calPercent = Math.min(consumed.cal / settings.targets.calories, 1);

  return (
    <View style={styles.container}>
      <Modal visible={showOnboarding} animationType="fade">
        <NutritionOnboarding
          onFinish={(s) => {
            setSettings(s);
            setShowOnboarding(false);
          }}
        />
      </Modal>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>{t('nutritionTitle')}</Text>
          <TouchableOpacity onPress={onResetNutrition}>
            <Feather name="settings" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'bugun' && styles.tabBtnActive]}
            onPress={() => setActiveTab('bugun')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'bugun' && styles.tabBtnTextActive]}>
              {t('today')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'analiz' && styles.tabBtnActive]}
            onPress={() => setActiveTab('analiz')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'analiz' && styles.tabBtnTextActive]}>
              {t('analytics')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'gecmis' && styles.tabBtnActive]}
            onPress={() => setActiveTab('gecmis')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'gecmis' && styles.tabBtnTextActive]}>
              {t('history')}
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'bugun' && (
          <>
            <View style={styles.mainCard}>
              <View style={styles.calInfo}>
                <View>
                  <Text style={styles.calLabel}>
                    {remainingCal >= 0 ? t('calRemaining') : t('targetExceeded')}
                  </Text>
                  <Text style={[styles.calValue, remainingCal < 0 && { color: '#FF4B4B' }]}>
                    {remainingCal >= 0 ? remainingCal : `+${Math.abs(remainingCal)}`}
                  </Text>
                  <Text style={styles.calTotal}>
                    {t('target')}: {settings.targets.calories}
                  </Text>
                </View>
                <View style={styles.calCircle}>
                  <View
                    style={[
                      styles.calProgress,
                      { height: `${calPercent * 100}%` },
                      remainingCal < 0 && { backgroundColor: '#FF4B4B', opacity: 0.4 },
                    ]}
                  />
                  <Text style={styles.calPercentText}>
                    {Math.round((consumed.cal / settings.targets.calories) * 100)}%
                  </Text>
                </View>
              </View>

              <View style={styles.macroGrid}>
                <MacroBar
                  label={t('protein')}
                  current={consumed.protein}
                  target={settings.targets.protein}
                  color="#FF4B4B"
                />
                <MacroBar
                  label={t('carbs')}
                  current={consumed.carbs}
                  target={settings.targets.carbs}
                  color="#4B91FF"
                />
                <MacroBar
                  label={t('fat')}
                  current={consumed.fat}
                  target={settings.targets.fat}
                  color="#FFD94B"
                />
              </View>
            </View>

            <View style={styles.waterCard}>
              <View style={styles.waterHeader}>
                <View>
                  <Text style={styles.waterTitle}>{t('waterConsumption')}</Text>
                  <Text style={styles.waterSubtitle}>
                    {waterAmount} / {settings.waterGoal} ml
                    {waterAmount > settings.waterGoal && (
                      <Text style={{ color: '#4B91FF', fontWeight: 'bold' }}>
                        {' '}
                        (+{waterAmount - settings.waterGoal})
                      </Text>
                    )}
                  </Text>
                </View>
                <Feather
                  name="droplet"
                  size={24}
                  color={waterAmount >= settings.waterGoal ? '#00E5FF' : '#4B91FF'}
                />
              </View>
              <View style={styles.waterButtons}>
                {[200, 330, 500].map((amount) => (
                  <TouchableOpacity
                    key={amount}
                    style={styles.waterBtn}
                    onPress={() => handleWaterAdd(amount)}
                  >
                    <Text style={styles.waterBtnText}>+{amount}ml</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.waterBtnReset}
                  onPress={() => handleWaterAdd(-waterAmount)}
                >
                  <Feather name="refresh-cw" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('whatDidYouEat')}</Text>
            </View>

            {meals.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="coffee" size={40} color="#333" />
                <Text style={styles.emptyText}>{t('noMealsYet')}</Text>
              </View>
            ) : (
              meals.map((meal) => (
                <Swipeable
                  key={meal.id}
                  renderRightActions={() => (
                    <TouchableOpacity
                      style={styles.deleteAction}
                      onPress={() => handleDeleteMeal(meal.id)}
                    >
                      <Feather name="trash-2" size={20} color="#fff" />
                    </TouchableOpacity>
                  )}
                >
                  <View style={styles.mealItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mealName}>{meal.name}</Text>
                      <Text style={styles.mealMacros}>
                        {meal.calories} kcal • {t('pShort')}: {meal.protein}g • {t('fShort')}: {meal.fat}g • {t('cShort')}: {meal.carbs}g
                      </Text>
                    </View>
                    <Feather name="chevron-left" size={16} color="#444" />
                  </View>
                </Swipeable>
              ))
            )}
          </>
        )}

        {activeTab === 'analiz' && (
          <View style={styles.analysisContainer}>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { flex: 1 }]}>
                <Feather name="zap" size={22} color="#FFD700" />
                <View>
                  <Text style={styles.summaryValue}>{nutritionStats.avgCal}</Text>
                  <Text style={styles.summaryLabel}>{t('dailyAvg')}</Text>
                </View>
              </View>
              <View style={[styles.summaryCard, { flex: 1 }]}>
                <Feather name="pie-chart" size={22} color="#4CAF50" />
                <View>
                  <Text style={styles.summaryValue}>%{nutritionStats.macroRatio.p}</Text>
                  <Text style={styles.summaryLabel}>{t('energyFromMacro')}</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoBox}>
              <Feather name="info" size={16} color="#4CAF50" />
              <Text style={styles.infoBoxText}>{t('macroInfoBox')}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('weeklyCalTrend')}</Text>
              <View style={styles.chartContainer}>
                {nutritionStats.weeklyCal.map((stat, i) => {
                  const maxCal = Math.max(...nutritionStats.weeklyCal.map((s) => s.count), 1);
                  const heightPct = (stat.count / maxCal) * 100;
                  return (
                    <View key={i} style={styles.barColumn}>
                      <Text style={styles.barValue}>{stat.count > 0 ? stat.count : ''}</Text>
                      <View style={styles.barArea}>
                        <View
                          style={[
                            styles.barFill,
                            { height: `${heightPct}%`, backgroundColor: '#FF4B4B' },
                          ]}
                        />
                      </View>
                      <Text style={styles.barLabel}>{stat.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('weeklyWaterTrend')}</Text>
              <View style={styles.chartContainer}>
                {nutritionStats.weeklyWater.map((stat, i) => {
                  const maxWater = Math.max(...nutritionStats.weeklyWater.map((s) => s.count), 1);
                  const heightPct = (stat.count / maxWater) * 100;
                  return (
                    <View key={i} style={styles.barColumn}>
                      <Text style={[styles.barValue, { fontSize: 9 }]}>{stat.count}</Text>
                      <View style={styles.barArea}>
                        <View
                          style={[
                            styles.barFill,
                            { height: `${heightPct}%`, backgroundColor: '#4B91FF' },
                          ]}
                        />
                      </View>
                      <Text style={styles.barLabel}>{stat.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('macroDistribution')}</Text>
              <View style={{ gap: 12, marginTop: 16 }}>
                <MacroBar
                  label={t('protein')}
                  current={nutritionStats.macroRatio.p}
                  target={100}
                  color="#FF4B4B"
                  isPercent
                />
                <MacroBar
                  label={t('fullCarbs')}
                  current={nutritionStats.macroRatio.c}
                  target={100}
                  color="#4B91FF"
                  isPercent
                />
                <MacroBar
                  label={t('fat')}
                  current={nutritionStats.macroRatio.f}
                  target={100}
                  color="#FFD94B"
                  isPercent
                />
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('mostConsumed')}</Text>
              <View style={{ marginTop: 12 }}>
                {nutritionStats.topFoods.map((food, i) => (
                  <View key={i} style={styles.foodRow}>
                    <Text style={styles.foodName} numberOfLines={1} ellipsizeMode="tail">
                      {food.name}
                    </Text>
                    <Text style={styles.foodCount}>
                      {food.count} {t('timesLabel')}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {activeTab === 'gecmis' && (
          <View style={styles.historyContainer}>
            {history.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="calendar" size={40} color="#333" />
                <Text style={styles.emptyText}>{t('noHistoryYet')}</Text>
              </View>
            ) : (
              history.map((day, i) => (
                <TouchableOpacity key={i} style={styles.historyItem} onPress={() => setSelectedDay(day)}>
                  <View>
                    <Text style={styles.historyDate}>{day.date === today ? t('today') : day.date}</Text>
                    <Text style={styles.historySummary}>
                      {day.count} {t('mealsLabel')} • {day.water} ml {t('water')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      style={[
                        styles.historyCal,
                        day.cal > settings.targets.calories && { color: '#FF4B4B' },
                      ]}
                    >
                      {day.cal} kcal
                    </Text>
                    <Feather name="chevron-right" size={16} color="#666" />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {!isPremium && !showOnboarding && (
        <View style={styles.lockOverlay}>
          <Feather name="lock" size={48} color="#fff" style={{ marginBottom: 20 }} />
          <Text style={styles.lockTitle}>{t('premiumFeature')}</Text>
          <Text style={styles.lockSubtitle}>{t('premiumNutritionDesc')}</Text>
          <TouchableOpacity style={styles.lockBtn} onPress={() => setShowPaywall(true)}>
            <Text style={styles.lockBtnText}>{t('upgradeNow')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[styles.fab, !isPremium && { opacity: 0.5 }]}
        onPress={() => (isPremium ? setShowAddModal(true) : setShowPaywall(true))}
      >
        <Feather name="plus" size={24} color="#000" />
      </TouchableOpacity>

      <MealAddModal visible={showAddModal} onClose={() => setShowAddModal(false)} onSuccess={loadData} />

      <PremiumPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onPurchaseSuccess={() => {
          setIsPremium(true);
          setShowPaywall(false);
          loadData();
        }}
      />

      <Modal visible={!!selectedDay} animationType="slide" transparent>
        <View style={styles.detailOverlay}>
          <View style={styles.detailContent}>
            <View style={styles.detailHeader}>
              <View>
                <Text style={styles.detailTitle}>
                  {selectedDay?.date === today ? t('today') : selectedDay?.date}
                </Text>
                <Text style={styles.detailSubtitle}>{t('dailySummaryReport')}</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedDay(null)}>
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardLabel}>{t('totalCalories')}</Text>
                    <Text
                      style={[
                        styles.cardValue,
                        selectedDay?.cal > settings.targets.calories && { color: '#FF4B4B' },
                      ]}
                    >
                      {selectedDay?.cal}{' '}
                      <Text style={{ fontSize: 14, color: '#666' }}>
                        / {settings.targets.calories} kcal
                      </Text>
                    </Text>
                    {selectedDay?.cal > settings.targets.calories ? (
                      <Text style={{ color: '#FF4B4B', fontSize: 12, fontWeight: 'bold', marginTop: 4 }}>
                        {t('targetExceededBy').replace(
                          '{{amount}}',
                          selectedDay.cal - settings.targets.calories
                        )}
                      </Text>
                    ) : (
                      <Text style={{ color: '#4CAF50', fontSize: 12, fontWeight: 'bold', marginTop: 4 }}>
                        {t('belowTargetBy').replace(
                          '{{amount}}',
                          settings.targets.calories - selectedDay?.cal
                        )}
                      </Text>
                    )}
                  </View>
                  <Feather
                    name="target"
                    size={24}
                    color={selectedDay?.cal > settings.targets.calories ? '#FF4B4B' : '#FFD700'}
                  />
                </View>
              </View>

              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardLabel}>{t('waterConsumption')}</Text>
                    <Text style={styles.cardValue}>
                      {selectedDay?.water}{' '}
                      <Text style={{ fontSize: 14, color: '#666' }}>/ {settings.waterGoal} ml</Text>
                    </Text>
                    {selectedDay?.water >= settings.waterGoal ? (
                      <Text style={{ color: '#00E5FF', fontSize: 12, fontWeight: 'bold', marginTop: 4 }}>
                        {t('targetReached')}{' '}
                        {selectedDay.water > settings.waterGoal
                          ? t('extraWater').replace('{{amount}}', selectedDay.water - settings.waterGoal)
                          : ''}
                      </Text>
                    ) : (
                      <Text style={{ color: '#666', fontSize: 12, fontWeight: 'bold', marginTop: 4 }}>
                        {t('waterRemaining').replace('{{amount}}', settings.waterGoal - selectedDay?.water)}
                      </Text>
                    )}
                  </View>
                  <Feather
                    name="droplet"
                    size={24}
                    color={selectedDay?.water >= settings.waterGoal ? '#00E5FF' : '#4B91FF'}
                  />
                </View>
                <View style={styles.hProgressBg}>
                  <View
                    style={[
                      styles.hProgressFill,
                      {
                        width: `${Math.min((selectedDay?.water / settings.waterGoal) * 100, 100)}%`,
                        backgroundColor: '#4B91FF',
                      },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.detailCard}>
                <Text style={styles.cardTitle}>{t('dailyMacroBalance')}</Text>
                {(() => {
                  const p = selectedDay?.meals.reduce((s, m) => s + (m.protein || 0), 0) || 0;
                  const f = selectedDay?.meals.reduce((s, m) => s + (m.fat || 0), 0) || 0;
                  const c = selectedDay?.meals.reduce((s, m) => s + (m.carbs || 0), 0) || 0;
                  return (
                    <View style={{ gap: 12, marginTop: 10 }}>
                      <MacroBar
                        label={t('protein')}
                        current={p}
                        target={settings.targets.protein}
                        color="#FF4B4B"
                      />
                      <MacroBar
                        label={t('fullCarbs')}
                        current={c}
                        target={settings.targets.carbs}
                        color="#4B91FF"
                      />
                      <MacroBar
                        label={t('fat')}
                        current={f}
                        target={settings.targets.fat}
                        color="#FFD94B"
                      />
                    </View>
                  );
                })()}
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 32, marginBottom: 16 }]}>
                {t('mealDetails')}
              </Text>
              {selectedDay?.meals.map((m) => (
                <View key={m.id} style={styles.mealItemDetail}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mealNameDetail}>{m.name}</Text>
                    <Text style={styles.mealMacrosDetail}>
                      {m.calories} kcal • {t('pShort')}: {m.protein}g • {t('fShort')}: {m.fat}g • {t('cShort')}: {m.carbs}g
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MacroBar({ label, current, target, color, isPercent }) {
  const percent = Math.min(current / target, 1);
  return (
    <View style={styles.macroItem}>
      <View style={styles.macroTextRow}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>
          {isPercent ? `%${current}` : `${current}/${target}g`}
        </Text>
      </View>
      <View style={styles.macroBg}>
        <View style={[styles.macroProgress, { width: `${percent * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  scrollContent: { padding: 20, paddingTop: 60 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  mainCard: { backgroundColor: '#1E1E1E', borderRadius: 24, padding: 20, marginBottom: 20 },
  calInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  calLabel: { color: '#A0A0A0', fontSize: 14, marginBottom: 4 },
  calValue: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  calTotal: { color: '#666', fontSize: 14 },
  calCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#333',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calProgress: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#fff',
    opacity: 0.2,
  },
  calPercentText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  macroGrid: { gap: 12 },
  macroItem: {},
  macroTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  macroLabel: { color: '#A0A0A0', fontSize: 12 },
  macroValue: { color: '#fff', fontSize: 12, fontWeight: '600' },
  macroBg: { height: 6, backgroundColor: '#333', borderRadius: 3, overflow: 'hidden' },
  macroProgress: { height: '100%', borderRadius: 3 },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  tabBtnActive: { backgroundColor: '#333' },
  tabBtnText: { color: '#666', fontSize: 14, fontWeight: '600' },
  tabBtnTextActive: { color: '#fff' },
  analysisContainer: { gap: 20 },
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryValue: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  summaryLabel: { color: '#666', fontSize: 12 },
  infoBox: {
    backgroundColor: '#1A2E1A',
    padding: 12,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  infoBoxText: { color: '#A0A0A0', fontSize: 12, flex: 1, lineHeight: 18 },
  card: { backgroundColor: '#1E1E1E', borderRadius: 24, padding: 20 },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 16 },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
  },
  barColumn: { alignItems: 'center', flex: 1 },
  barArea: {
    width: 8,
    height: 80,
    backgroundColor: '#252525',
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    marginVertical: 8,
  },
  barFill: { width: '100%', borderRadius: 4 },
  barValue: { color: '#666', fontSize: 9 },
  barLabel: { color: '#666', fontSize: 10 },
  foodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#252525',
  },
  foodName: { color: '#fff', fontSize: 15, flex: 1, marginRight: 10 },
  foodCount: { color: '#4B91FF', fontWeight: 'bold' },
  historyContainer: { gap: 12 },
  historyItem: {
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyDate: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  historySummary: { color: '#666', fontSize: 13 },
  historyCal: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  detailContent: {
    backgroundColor: '#121212',
    height: '85%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  detailTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  detailSubtitle: { color: '#666', fontSize: 14, marginTop: 4 },
  closeBtn: {
    backgroundColor: '#252525',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailCard: { backgroundColor: '#1E1E1E', borderRadius: 24, padding: 20, marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { color: '#A0A0A0', fontSize: 13, marginBottom: 4 },
  cardValue: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  hProgressBg: { height: 6, backgroundColor: '#333', borderRadius: 3, marginTop: 12, overflow: 'hidden' },
  hProgressFill: { height: '100%', borderRadius: 3 },
  mealItemDetail: {
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealNameDetail: { color: '#fff', fontSize: 16, fontWeight: '600' },
  mealMacrosDetail: { color: '#666', fontSize: 12, marginTop: 2 },
  waterCard: { backgroundColor: '#1E1E1E', borderRadius: 24, padding: 20, marginBottom: 20 },
  waterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  waterTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  waterSubtitle: { color: '#A0A0A0', fontSize: 14 },
  waterButtons: { flexDirection: 'row', gap: 10 },
  waterBtn: {
    flex: 1,
    backgroundColor: '#252525',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  waterBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  waterBtnReset: {
    width: 40,
    backgroundColor: '#252525',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  sectionHeader: { marginBottom: 16 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#666', marginTop: 12 },
  mealItem: {
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealName: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  mealMacros: { color: '#A0A0A0', fontSize: 12 },
  deleteAction: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '85%',
    borderRadius: 16,
    marginBottom: 10,
    marginLeft: 10,
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18,18,18,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    zIndex: 10,
  },
  lockTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  lockSubtitle: { color: '#A0A0A0', fontSize: 16, textAlign: 'center', marginBottom: 24 },
  lockBtn: { backgroundColor: '#fff', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16 },
  lockBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
});
