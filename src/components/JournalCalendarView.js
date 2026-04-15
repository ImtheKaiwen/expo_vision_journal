import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import {
  buildCalendarWeeks,
  weekdayLabelsTr,
  formatMonthYearTr,
  ymdKey,
} from '../utils/journalDates';
import { useI18n } from '../utils/i18n';

export default function JournalCalendarView({
  year,
  monthIndex,
  onPrevMonth,
  onNextMonth,
  countsByDay,
  selectedYmd,
  onSelectDay,
}) {
  const { t, langCode } = useI18n();
  const weeks = buildCalendarWeeks(year, monthIndex);
  
  const allDays = t('shortDays').split(',');
  const labels = [1, 2, 3, 4, 5, 6, 0].map(i => allDays[i]);

  const isSelected = (day) => {
    if (!selectedYmd || !day) return false;
    return (
      selectedYmd.y === year &&
      selectedYmd.m === monthIndex + 1 &&
      selectedYmd.d === day
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.monthRow}>
        <TouchableOpacity style={styles.navBtn} onPress={onPrevMonth} hitSlop={12}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{new Date(year, monthIndex, 1).toLocaleDateString(langCode === 'en' ? 'en-US' : 'tr-TR', { month: 'long', year: 'numeric' })}</Text>
        <TouchableOpacity style={styles.navBtn} onPress={onNextMonth} hitSlop={12}>
          <Feather name="chevron-right" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.weekHeader}>
        {labels.map((label) => (
          <Text key={label} style={styles.weekHeaderCell}>
            {label}
          </Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((cell, ci) => {
            if (!cell) {
              return <View key={`e-${wi}-${ci}`} style={[styles.cell, styles.cellEmpty]} />;
            }
            const k = ymdKey({ y: year, m: monthIndex + 1, d: cell.day });
            const cnt = countsByDay.get(k) || 0;
            const sel = isSelected(cell.day);
            return (
              <TouchableOpacity
                key={k}
                style={[styles.cell, sel && styles.cellSelected]}
                onPress={() => onSelectDay({ y: year, m: monthIndex + 1, d: cell.day })}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayNum, sel && styles.dayNumSelected]}>{cell.day}</Text>
                {cnt > 0 ? (
                  <View style={styles.dotRow}>
                    <Text style={styles.cnt}>{cnt > 9 ? '9+' : cnt}</Text>
                  </View>
                ) : (
                  <View style={styles.dotPlaceholder} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: { padding: 8, borderRadius: 12, backgroundColor: '#2A2A2A' },
  monthTitle: { color: '#fff', fontSize: 17, fontWeight: '700', textTransform: 'capitalize' },
  weekHeader: { flexDirection: 'row', marginBottom: 8 },
  weekHeaderCell: {
    flex: 1,
    textAlign: 'center',
    color: '#777',
    fontSize: 11,
    fontWeight: '600',
  },
  weekRow: { flexDirection: 'row', marginBottom: 4, gap: 4 },
  cell: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    maxHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#1E1E1E',
  },
  cellEmpty: { backgroundColor: 'transparent' },
  cellSelected: { backgroundColor: '#333', borderWidth: 1, borderColor: '#fff' },
  dayNum: { color: '#fff', fontSize: 14, fontWeight: '600' },
  dayNumSelected: { color: '#fff' },
  dotRow: { marginTop: 2 },
  cnt: { color: '#4CAF50', fontSize: 10, fontWeight: '700' },
  dotPlaceholder: { height: 12 },
});
