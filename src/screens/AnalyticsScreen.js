import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';

import { getJournalEntries, getVisionNotes } from '../storage';
import { analyzeWordStats } from '../utils/textAnalysis';
import { useI18n } from '../utils/i18n';
import { getLocalDateString } from '../utils/journalDates';

export default function AnalyticsScreen() {
  const { t, langCode } = useI18n();
  const [journalWords, setJournalWords] = useState([]);
  const [journalBigrams, setJournalBigrams] = useState([]);
  const [visionWords, setVisionWords] = useState([]);
  const [visionBigrams, setVisionBigrams] = useState([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [totalVisions, setTotalVisions] = useState(0);
  const [weeklyStats, setWeeklyStats] = useState([]);
  const [visionCompletionRate, setVisionCompletionRate] = useState(0);
  const [activeTab, setActiveTab] = useState('general');
  const [difficultVisions, setDifficultVisions] = useState([]);
  const [successfulVisions, setSuccessfulVisions] = useState([]);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      analyzeData();
    }
  }, [isFocused]);

  const analyzeData = async () => {
    try {
      const entries = await getJournalEntries();
      setTotalEntries(entries.length);
      const journalText = entries.map((e) => e.text).join(' ');
      const j = analyzeWordStats(journalText);
      setJournalWords(j.topWords);
      setJournalBigrams(j.topBigrams);

      const visions = await getVisionNotes();
      setTotalVisions(visions.length);

      // Vision completion calc
      let totalTarget = 0;
      let totalEarned = 0;
      let activeTracked = 0;
      const visionTextArray = [];
      
      for (const v of visions) {
        visionTextArray.push(`${v.title} ${v.content}`);
        if (v.targetDays && v.targetDays > 0) {
          activeTracked++;
          totalTarget += v.targetDays;
          const earned = (v.dailyLog || []).reduce((sum, d) => sum + (d.score || 0), 0);
          totalEarned += Math.min(earned, v.targetDays);
        }
      }
      
      if (totalTarget > 0) {
        setVisionCompletionRate(Math.min((totalEarned / totalTarget) * 100, 100));
      } else if (activeTracked === 0) {
        setVisionCompletionRate(null); // Yok
      }

      // Advanced Vision Analysis
      const visionStats = visions
        .filter(v => v.targetDays && v.targetDays > 0 && (v.dailyLog || []).length > 0)
        .map(v => {
          const log = v.dailyLog || [];
          const ones = log.filter(d => d.score === 1).length;
          const halves = log.filter(d => d.score === 0.5).length;
          const zeros = log.filter(d => d.score === 0).length;
          const minusScore = zeros * 1 + halves * 0.5; // Custom penalty score
          return { ...v, ones, halves, zeros, minusScore };
        });

      // Difficult visions: highest minusScore
      const diffSorted = [...visionStats].sort((a, b) => b.minusScore - a.minusScore).filter(v => v.minusScore > 0);
      setDifficultVisions(diffSorted.slice(0, 3));

      // Successful visions: highest ones 
      const succSorted = [...visionStats].sort((a, b) => b.ones - a.ones).filter(v => v.ones > 0);
      setSuccessfulVisions(succSorted.slice(0, 3));

      const visionText = visionTextArray.join(' ');
      const v = analyzeWordStats(visionText);
      setVisionWords(v.topWords);
      setVisionBigrams(v.topBigrams);

      // Weekly habit (last 7 days logic)
      const last7 = [];
      const dayLabels = t('shortDayNames').split(',');
      const counts = [0,0,0,0,0,0,0]; // Pazartesi(1)-Pazar(0) sırası yerine bugünden geriye 7 gün
      
      const todayDate = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(todayDate);
        d.setDate(todayDate.getDate() - i);
        last7.push({ dateStr: getLocalDateString(d), dayIndex: d.getDay() });
      }

      last7.forEach((dayObj, index) => {
        const matchingEntries = entries.filter(e => e.date === dayObj.dateStr);
        counts[index] = matchingEntries.length;
      });

      setWeeklyStats(last7.map((d, i) => ({ label: dayLabels[d.dayIndex], count: counts[i] })));

    } catch (e) {
      console.error('Analysis error:', e);
    }
  };

  const renderList = (items, keyField, emptyHint) => {
    if (!items.length) {
      return <Text style={styles.cardContent}>{emptyHint}</Text>;
    }
    return items.map((item, index) => (
      <View key={index} style={styles.listItem}>
        <Text style={styles.listText}>{item[keyField]}</Text>
        <Text style={styles.listCount}>{item.count} {t('times')}</Text>
      </View>
    ));
  };

  return (
    <View style={styles.pageContainer}>
      <Text style={styles.headerTitle}>{t('tabAnalytics')}</Text>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'general' && styles.tabBtnActive]}
          onPress={() => setActiveTab('general')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'general' && styles.tabBtnTextActive]}>
            {t('generalAnalytics')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'word' && styles.tabBtnActive]}
          onPress={() => setActiveTab('word')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'word' && styles.tabBtnTextActive]}>
            {t('wordAnalytics')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {activeTab === 'general' && (
          <>
            <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { flex: 1 }]}>
            <Feather name="edit-3" size={22} color="#4CAF50" />
            <View>
              <Text style={styles.summaryValue}>{totalEntries}</Text>
              <Text style={styles.summaryLabel}>{t('journalStat')}</Text>
            </View>
          </View>
          <View style={[styles.summaryCard, { flex: 1 }]}>
            <Feather name="star" size={22} color="#FFD700" />
            <View>
              <Text style={styles.summaryValue}>{totalVisions}</Text>
              <Text style={styles.summaryLabel}>{t('visionStat')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="bar-chart-2" size={20} color="#2196F3" />
            <Text style={styles.cardTitle}>{t('last7Days')}</Text>
          </View>
          <View style={styles.chartContainer}>
            {weeklyStats.map((stat, i) => {
              const maxCount = Math.max(...weeklyStats.map(s => s.count), 1);
              const heightPct = (stat.count / maxCount) * 100;
              return (
                <View key={i} style={styles.barColumn}>
                  <Text style={styles.barValue}>{stat.count > 0 ? stat.count : ''}</Text>
                  <View style={styles.barArea}>
                    <View style={[styles.barFill, { height: `${heightPct}%` }]} />
                  </View>
                  <Text style={styles.barLabel}>{stat.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {visionCompletionRate !== null && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Feather name="target" size={20} color="#FF9800" />
              <Text style={styles.cardTitle}>{t('visionCompletion')}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${visionCompletionRate}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {langCode === 'tr' ? `%${Math.round(visionCompletionRate)}` : `${Math.round(visionCompletionRate)}%`} {t('completionRateHint')}
            </Text>
          </View>
        )}

        {activeTab === 'general' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Feather name="alert-circle" size={20} color="#F44336" />
              <Text style={styles.cardTitle}>{t('difficultVisions')}</Text>
            </View>
            <Text style={styles.cardSubtitle}>{t('difficultSub')}</Text>
            {difficultVisions.length > 0 ? (
              difficultVisions.map((v, i) => (
                <View key={v.id} style={styles.listItem}>
                  <Text style={styles.listText} numberOfLines={1}>{i + 1}. {v.title}</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    {v.zeros > 0 && <Text style={[styles.listCount, { color: '#F44336' }]}>{v.zeros} {t('timesFail')}</Text>}
                    {v.halves > 0 && <Text style={[styles.listCount, { color: '#FF9800' }]}>{v.halves} {t('timesHalf')}</Text>}
                  </View>
                </View>
              ))
            ) : (
              <Text style={{ color: '#A0A0A0', fontStyle: 'italic', marginTop: 8 }}>{t('noDifficultVisions')}</Text>
            )}
          </View>
        )}

        {activeTab === 'general' && successfulVisions.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Feather name="award" size={20} color="#4CAF50" />
              <Text style={styles.cardTitle}>{t('bestVisions')}</Text>
            </View>
            <Text style={styles.cardSubtitle}>{t('bestSub')}</Text>
            {successfulVisions.map((v, i) => (
              <View key={v.id} style={styles.listItem}>
                <Text style={styles.listText} numberOfLines={1}>{i + 1}. {v.title}</Text>
                <Text style={[styles.listCount, { color: '#4CAF50' }]}>{v.ones} {t('timesDone')}</Text>
              </View>
            ))}
          </View>
        )}
          </>
        )}

        {activeTab === 'word' && (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Feather name="book-open" size={20} color="#9C27B0" />
                <Text style={styles.cardTitle}>{t('analyticsWordsStats')}</Text>
              </View>
              {renderList(
                journalWords,
                'word',
                t('noDataJournal')
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Feather name="git-commit" size={20} color="#FF9800" />
                <Text style={styles.cardTitle}>{t('analyticsBigramsStats')}</Text>
              </View>
              <Text style={styles.cardSubtitle}>{t('wordAfterWordHint')}</Text>
              {renderList(journalBigrams, 'bigram', t('noDataCommon'))}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Feather name="compass" size={20} color="#2196F3" />
                <Text style={styles.cardTitle}>{t('analyticsVWordsStats')}</Text>
              </View>
              <Text style={styles.cardSubtitle}>{t('mixHint')}</Text>
              {renderList(visionWords, 'word', t('noDataVision'))}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Feather name="layers" size={20} color="#00BCD4" />
                <Text style={styles.cardTitle}>{t('analyticsVBigramsStats')}</Text>
              </View>
              {renderList(visionBigrams, 'bigram', t('noDataCommon'))}
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: { flex: 1, backgroundColor: '#121212', paddingHorizontal: 24, paddingTop: 60 },
  headerTitle: { fontSize: 32, fontWeight: '700', color: '#ffffff', marginBottom: 20 },
  tabRow: { flexDirection: 'row', backgroundColor: '#1E1E1E', borderRadius: 16, padding: 4, marginBottom: 20 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  tabBtnActive: { backgroundColor: '#333' },
  tabBtnText: { color: '#A0A0A0', fontSize: 13, fontWeight: '600' },
  tabBtnTextActive: { color: '#fff' },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryValue: { fontSize: 22, fontWeight: '700', color: '#ffffff' },
  summaryLabel: { fontSize: 13, color: '#A0A0A0' },
  card: { backgroundColor: '#1E1E1E', borderRadius: 20, padding: 20, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff' },
  cardSubtitle: { fontSize: 13, color: '#A0A0A0', marginBottom: 12 },
  cardContent: { fontSize: 15, color: '#D0D0D0', lineHeight: 22 },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  listText: { color: '#ffffff', fontSize: 16, fontWeight: '500', textTransform: 'capitalize', flex: 1, marginRight: 8 },
  listCount: { color: '#4CAF50', fontSize: 14, fontWeight: '600' },
  chartContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 160, paddingTop: 20 },
  barColumn: { alignItems: 'center', width: 36, height: '100%', justifyContent: 'flex-end' },
  barArea: { width: 12, flex: 1, backgroundColor: '#2A2A2A', borderRadius: 6, marginVertical: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: '#2196F3', borderRadius: 6 },
  barLabel: { color: '#A0A0A0', fontSize: 12, fontWeight: '600' },
  barValue: { color: '#fff', fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 16, backgroundColor: '#2A2A2A', borderRadius: 8, overflow: 'hidden', marginBottom: 12, marginTop: 8 },
  progressFill: { height: '100%', backgroundColor: '#FF9800', borderRadius: 8 },
  progressText: { color: '#D0D0D0', fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
