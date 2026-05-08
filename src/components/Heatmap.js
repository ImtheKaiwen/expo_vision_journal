import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { entryToYmd, ymdKey } from '../utils/journalDates';
import { useI18n } from '../utils/i18n';

const { width } = Dimensions.get('window');
const SQUARE_SIZE = 12;
const SQUARE_GAP = 3;
const DAYS_TO_SHOW = 112; // 16 haftalık veri (7 * 16)

export default function Heatmap({ entries }) {
  const { t } = useI18n();
  const data = useMemo(() => {
    const counts = new Map();
    entries.forEach(e => {
      const ymd = entryToYmd(e);
      if (ymd) {
        const k = ymdKey(ymd);
        counts.set(k, (counts.get(k) || 0) + 1);
      }
    });

    const now = new Date();
    const result = [];
    
    // Son DAYS_TO_SHOW günü hesapla (bugünden geriye)
    for (let i = DAYS_TO_SHOW - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const k = ymdKey({ y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
      result.push({
        key: k,
        count: counts.get(k) || 0,
        dayOfWeek: d.getDay(), // 0: Paz, 1: Pzt...
      });
    }
    return result;
  }, [entries]);

  // Veriyi sütunlara (haftalara) böl
  const weeks = useMemo(() => {
    const w = [];
    for (let i = 0; i < data.length; i += 7) {
      w.push(data.slice(i, i + 7));
    }
    return w;
  }, [data]);

  const getColor = (count) => {
    if (count === 0) return '#2A2A2A'; // Boş hücreler artık daha belirgin
    if (count === 1) return '#0E4429';
    if (count === 2) return '#006D32';
    if (count === 3) return '#26A641';
    return '#39D353'; // En yoğun (Discord/GitHub yeşili)
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('heatmap')}</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={[
          styles.scrollContent, 
          weeks.length * (SQUARE_SIZE + SQUARE_GAP) < width - 60 && { justifyContent: 'center', width: '100%' }
        ]}
      >
        <View style={styles.grid}>
          {weeks.map((week, wi) => (
            <View key={wi} style={styles.column}>
              {week.map((day, di) => (
                <View 
                  key={day.key} 
                  style={[styles.square, { backgroundColor: getColor(day.count) }]} 
                />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.legend}>
        <Text style={styles.legendText}>{t('less')}</Text>
        <View style={[styles.miniSquare, { backgroundColor: '#2A2A2A' }]} />
        <View style={[styles.miniSquare, { backgroundColor: '#0E4429' }]} />
        <View style={[styles.miniSquare, { backgroundColor: '#006D32' }]} />
        <View style={[styles.miniSquare, { backgroundColor: '#26A641' }]} />
        <View style={[styles.miniSquare, { backgroundColor: '#39D353' }]} />
        <Text style={styles.legendText}>{t('more')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E1E1E',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center', // Başlığı da ortalamak için
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
    alignSelf: 'flex-start', // Başlık solda kalsın istenirse
  },
  scrollContent: {
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    gap: SQUARE_GAP,
    justifyContent: 'center',
  },
  column: {
    gap: SQUARE_GAP,
  },
  square: {
    width: SQUARE_SIZE,
    height: SQUARE_SIZE,
    borderRadius: 2,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 10,
  },
  legendText: {
    color: '#777',
    fontSize: 10,
  },
  miniSquare: {
    width: 8,
    height: 8,
    borderRadius: 1,
  },
});
