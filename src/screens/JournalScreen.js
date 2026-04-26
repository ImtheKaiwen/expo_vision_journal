import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useIsFocused } from '@react-navigation/native';
import JournalCalendarView from '../components/JournalCalendarView';
import Heatmap from '../components/Heatmap';
import JournalWriteModal from '../components/JournalWriteModal';
import ShareStreakCard from '../components/ShareStreakCard';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { getJournalEntries, setJournalEntries, updateStreakOnJournalSave, getStreak, getAppSettings } from '../storage';
import {
  addCalendarMonths,
  countEntriesByDay,
  entryToYmd,
  ymdKey,
  getLocalDateString,
} from '../utils/journalDates';
import { useI18n } from '../utils/i18n';

const { width } = Dimensions.get('window');

export default function JournalScreen() {
  const { t } = useI18n();
  const [viewMode, setViewMode] = useState('list');
  const [entry, setEntry] = useState('');
  const [savedEntries, setSavedEntries] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [writeModalVisible, setWriteModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [streakInfo, setStreakInfo] = useState({ count: 0 });
  const [appSettings, setAppSettings] = useState(null);
  const viewShotRef = useRef(null);
  const inviteShotRef = useRef(null);
  const [editText, setEditText] = useState('');
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), monthIndex: n.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(null);
  const swipeableRefs = useRef(new Map());
  const mainScrollRef = useRef(null);
  const isFocused = useIsFocused();

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    if (isFocused) {
      loadEntries();
      loadStreak();
      getAppSettings().then(setAppSettings);
    }
  }, [isFocused]);

  // Exit selection mode when leaving
  useEffect(() => {
    if (!isFocused) {
      setSelectionMode(false);
      setSelectedIds(new Set());
    }
  }, [isFocused]);

  const loadEntries = async () => {
    const list = await getJournalEntries();
    setSavedEntries(list);
  };

  const loadStreak = async () => {
    const s = await getStreak();
    setStreakInfo(s);
  };

  const saveEntry = async () => {
    if (entry.trim() === '') return;
    const now = new Date();
    const newEntry = {
      id: Date.now().toString(),
      text: entry,
      date: getLocalDateString(),
      createdAt: now.toISOString(),
    };
    const updatedEntries = [newEntry, ...savedEntries];
    await setJournalEntries(updatedEntries);
    setSavedEntries(updatedEntries);
    await updateStreakOnJournalSave();
    setEntry('');
    Keyboard.dismiss();
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setEditText(item.text);
    setEditModalVisible(true);
  };

  const saveEdit = async () => {
    if (!editingId || editText.trim() === '') return;
    const updatedEntries = savedEntries.map((e) =>
      e.id === editingId ? { ...e, text: editText.trim() } : e
    );
    await setJournalEntries(updatedEntries);
    setSavedEntries(updatedEntries);
    setEditModalVisible(false);
    setEditingId(null);
    setEditText('');
    Keyboard.dismiss();
  };

  const deleteEntry = (id) => {
    Alert.alert('Sil', 'Bu günlüğü silmek istediğine emin misin?', [
      { text: 'İptal', style: 'cancel', onPress: () => swipeableRefs.current.get(id)?.close() },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const updatedEntries = savedEntries.filter((item) => item.id !== id);
          setSavedEntries(updatedEntries);
          await setJournalEntries(updatedEntries);
        },
      },
    ]);
  };

  const copyEntry = async (text, id) => {
    const now = new Date();
    const formattedDateTime = now.toLocaleString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const newText = `[${formattedDateTime}] ${text}`;
    await Clipboard.setStringAsync(newText);
    Alert.alert(t('copiedTitle'), t('journalCopied'));
    swipeableRefs.current.get(id)?.close();
  };

  // --- Selection mode ---
  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectionMode(false);
      setSelectedIds(new Set());
    } else {
      setSelectionMode(true);
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    const items = viewMode === 'calendar' && selectedDay
      ? entriesForSelectedDay
      : filteredEntries;
    setSelectedIds(new Set(items.map((e) => e.id)));
  };

  const copySelected = async () => {
    const items = savedEntries.filter((e) => selectedIds.has(e.id));
    if (items.length === 0) return Alert.alert(t('warning'), t('noEntrySelected'));
    const txt = items.map((e) => `📅 ${e.date}\n${e.text}`).join('\n\n');
    await Clipboard.setStringAsync(txt);
    Alert.alert(t('copiedTitle'), `${items.length} ${t('journalsCopied')}`);
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const deleteBatch = () => {
    const items = savedEntries.filter((e) => selectedIds.has(e.id));
    if (items.length === 0) return Alert.alert(t('warning'), t('noEntrySelected'));
    Alert.alert(t('delete'), `${items.length} ${t('deleteBatchConfirm')}`, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          const updatedEntries = savedEntries.filter((item) => !selectedIds.has(item.id));
          setSavedEntries(updatedEntries);
          await setJournalEntries(updatedEntries);
          setSelectionMode(false);
          setSelectedIds(new Set());
        },
      },
    ]);
  };

  const copyDayEntries = async () => {
    if (entriesForSelectedDay.length === 0) return;
    const txt = entriesForSelectedDay.map((e) => `📅 ${e.date}\n${e.text}`).join('\n\n');
    await Clipboard.setStringAsync(txt);
    Alert.alert(t('copiedTitle'), `${entriesForSelectedDay.length} ${t('journalsCopied')}`);
  };

  const stats = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0]; // 0: Sun, 1: Mon...
    savedEntries.forEach(e => {
      const dt = new Date(e.createdAt || 0);
      if (!Number.isNaN(dt.getTime())) {
        counts[dt.getDay()]++;
      }
    });

    let maxVal = -1;
    let maxIdx = -1;
    counts.forEach((v, i) => {
      if (v >= maxVal) {
        maxVal = v;
        maxIdx = i;
      }
    });

    const dayLabels = t('fullDays').split(',');
    return {
      total: savedEntries.length,
      topDay: maxVal > 0 ? dayLabels[maxIdx] : '-',
    };
  }, [savedEntries, t]);

  const renderRightActions = (progress, dragX, item) => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => deleteEntry(item.id)}
    >
      <Feather name="trash-2" size={24} color="#fff" />
      <Text style={styles.swipeLabel}>{t('delete')}</Text>
    </TouchableOpacity>
  );

  const renderLeftActions = (progress, dragX, item) => (
    <TouchableOpacity
      style={styles.copyAction}
      onPress={() => copyEntry(item.text, item.id)}
    >
      <Feather name="copy" size={24} color="#fff" />
      <Text style={styles.swipeLabel}>{t('copy')}</Text>
    </TouchableOpacity>
  );

  const filteredEntries = savedEntries.filter(
    (item) =>
      item.date.includes(filterText) || item.text.toLowerCase().includes(filterText.toLowerCase())
  );

  const countsByDay = useMemo(
    () => countEntriesByDay(savedEntries, cursor.year, cursor.monthIndex),
    [savedEntries, cursor.year, cursor.monthIndex]
  );

  const entriesForSelectedDay = useMemo(() => {
    if (!selectedDay) return [];
    const key = ymdKey(selectedDay);
    return savedEntries.filter((e) => {
      const ymd = entryToYmd(e);
      return ymd && ymdKey(ymd) === key;
    });
  }, [savedEntries, selectedDay]);

  const goPrevMonth = useCallback(() => {
    setCursor((c) => addCalendarMonths(c.year, c.monthIndex, -1));
    setSelectedDay(null);
  }, []);

  const goNextMonth = useCallback(() => {
    setCursor((c) => addCalendarMonths(c.year, c.monthIndex, 1));
    setSelectedDay(null);
  }, []);

  const setModeList = () => {
    setViewMode('list');
    setSelectedDay(null);
  };

  const setModeCalendar = () => {
    setViewMode('calendar');
    const n = new Date();
    setCursor({ year: n.getFullYear(), monthIndex: n.getMonth() });
    setSelectedDay(null);
  };

  const setModeHeatmap = () => {
    setViewMode('heatmap');
    setSelectedDay(null);
  };

  const handleShareStreak = async () => {
    try {
      const uri = await viewShotRef.current.capture();
      // Seri paylaşımı normal, sadece görsel (linksiz)
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Serini Paylaş!',
        UTI: 'public.png',
      });
    } catch (e) {
      Alert.alert('Hata', 'Paylaşım hazırlanırken bir sorun oluştu.');
    }
  };

  const handleInviteFriends = async () => {
    try {
      const uri = await inviteShotRef.current.capture();
      // Davet paylaşımı: Görsel + Mesaj (Link içeren)
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: t('inviteTitle'),
        UTI: 'public.png',
      });
      // Not: expo-sharing görselle birlikte metni her zaman desteklemeyebilir, 
      // bu yüzden sistem paylaşımı yerine metni panoya da kopyalayabiliriz veya 
      // Sharing.shareAsync sonrası bir Share.share metni çıkarabiliriz.
      // Ancak çoğu modern platform görselle birlikte gelen metni kabul eder.
    } catch (e) {
      Alert.alert('Hata', 'Davet hazırlanırken bir sorun oluştu.');
    }
  };

  const renderEntryCard = (item) => (
    <Swipeable
      key={item.id}
      ref={(ref) => swipeableRefs.current.set(item.id, ref)}
      renderRightActions={selectionMode ? undefined : (progress, dragX) => renderRightActions(progress, dragX, item)}
      rightThreshold={40}
      renderLeftActions={selectionMode ? undefined : (progress, dragX) => renderLeftActions(progress, dragX, item)}
      leftThreshold={40}
      enabled={!selectionMode}
    >
      <TouchableOpacity
        activeOpacity={selectionMode ? 0.7 : 1}
        onPress={selectionMode ? () => toggleSelect(item.id) : undefined}
      >
        <View style={[styles.card, selectionMode && selectedIds.has(item.id) && styles.cardSelected]}>
          <View style={styles.cardInner}>
            {selectionMode && (
              <View style={styles.checkboxArea}>
                <View
                  style={[
                    styles.checkbox,
                    selectedIds.has(item.id) && styles.checkboxChecked,
                  ]}
                >
                  {selectedIds.has(item.id) && (
                    <Feather name="check" size={14} color="#000" />
                  )}
                </View>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeader}>
                  <Feather name="calendar" size={14} color="#A0A0A0" />
                  <Text style={styles.dateLabel}>{item.date}</Text>
                </View>
                {!selectionMode && (
                  <TouchableOpacity style={styles.editChip} onPress={() => openEdit(item)}>
                    <Feather name="edit-2" size={14} color="#121212" />
                    <Text style={styles.editChipText}>{t('edit')}</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.cardContent}>{item.text}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: '#121212' }}
      keyboardVerticalOffset={0}
    >
      <View style={styles.pageContainer}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{t('tabJournal')}</Text>
          <TouchableOpacity
            style={[styles.selectBtn, selectionMode && styles.selectBtnActive]}
            onPress={toggleSelectionMode}
          >
            <Feather
              name={selectionMode ? 'x' : 'check-square'}
              size={18}
              color={selectionMode ? '#000' : '#A0A0A0'}
            />
            <Text style={[styles.selectBtnText, selectionMode && styles.selectBtnTextActive]}>
              {selectionMode ? t('cancel') : t('select')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeChip, viewMode === 'list' && styles.modeChipActive]}
            onPress={setModeList}
          >
            <Feather name="list" size={16} color={viewMode === 'list' ? '#000' : '#A0A0A0'} />
            <Text style={[styles.modeChipText, viewMode === 'list' && styles.modeChipTextActive]}>{t('listMode')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeChip, viewMode === 'calendar' && styles.modeChipActive]}
            onPress={setModeCalendar}
          >
            <Feather name="calendar" size={16} color={viewMode === 'calendar' ? '#000' : '#A0A0A0'} />
            <Text style={[styles.modeChipText, viewMode === 'calendar' && styles.modeChipTextActive]}>
              {t('calendarMode')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeChip, viewMode === 'heatmap' && styles.modeChipActive]}
            onPress={setModeHeatmap}
          >
            <Feather name="activity" size={16} color={viewMode === 'heatmap' ? '#000' : '#A0A0A0'} />
            <Text style={[styles.modeChipText, viewMode === 'heatmap' && styles.modeChipTextActive]}>
              Heatmap
            </Text>
          </TouchableOpacity>
        </View>

        {viewMode === 'list' ? (
          <View style={styles.filterBar}>
            <Feather name="search" size={16} color="#555" />
            <TextInput
              style={styles.filterInput}
              placeholder={t('searchJournal')}
              placeholderTextColor="#555"
              value={filterText}
              onChangeText={setFilterText}
            />
          </View>
        ) : null}

        <ScrollView
          ref={mainScrollRef}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Write Card Removed for FAB/Modal system */}

          {viewMode === 'heatmap' ? (
            <>
              <Heatmap entries={savedEntries} />
              <Text style={styles.calendarHint}>{t('heatmapHint')}</Text>

              <Text style={styles.statsTitle}>{t('statsTitle')}</Text>
              <View style={styles.statsRow}>
                <View style={[styles.statCard, { position: 'relative' }]}>
                  <Feather name="zap" size={20} color="#FFD700" />
                  <Text style={styles.statValue}>{streakInfo.count || 0}</Text>
                  <Text style={styles.statLabel}>{t('currStreak')}</Text>
                </View>
                <View style={styles.statCard}>
                  <Feather name="edit-3" size={20} color="#4CAF50" />
                  <Text style={styles.statValue}>{stats.total}</Text>
                  <Text style={styles.statLabel}>{t('totalEntries')}</Text>
                </View>
              </View>

              <View style={styles.statCardLarge}>
                <View style={styles.statCardLargeHeader}>
                  <Feather name="bar-chart-2" size={24} color="#2196F3" />
                  <Text style={styles.statLabelLarge}>{t('mostActiveDay')}</Text>
                </View>
                <Text style={styles.statValueLarge}>{stats.topDay}</Text>
                <Text style={[
                  styles.statHintLarge,
                  stats.topDay !== '-' && { color: '#4CAF50', fontWeight: '700' }
                ]}>
                  {stats.topDay === '-' ? t('notEnoughData') : t('mostActiveDayFull')}
                </Text>
              </View>
            </>
          ) : viewMode === 'calendar' ? (
            <>
              <View style={styles.calendarCard}>
                <JournalCalendarView
                  year={cursor.year}
                  monthIndex={cursor.monthIndex}
                  onPrevMonth={goPrevMonth}
                  onNextMonth={goNextMonth}
                  countsByDay={countsByDay}
                  selectedYmd={selectedDay}
                  onSelectDay={setSelectedDay}
                />
              </View>
              {!selectedDay ? (
                <Text style={styles.calendarHint}>{t('tapDayHint')}</Text>
              ) : entriesForSelectedDay.length === 0 ? (
                <Text style={styles.calendarHint}>{t('journalNoEntry')}</Text>
              ) : (
                <>
                  {!selectionMode && (
                    <TouchableOpacity style={styles.copyDayBtn} onPress={copyDayEntries}>
                      <Feather name="copy" size={16} color="#000" />
                      <Text style={styles.copyDayBtnText}>
                        {t('copyDay')} ({entriesForSelectedDay.length})
                      </Text>
                    </TouchableOpacity>
                  )}
                  {entriesForSelectedDay.map((item) => renderEntryCard(item))}
                </>
              )}
            </>
          ) : (
            filteredEntries.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Feather name="feather" size={48} color="#2A2A2A" style={{ marginBottom: 16 }} />
                <Text style={styles.emptyText}>{t('journalNoEntryList') || 'Henüz kayıt yok. Yazmaya başlamak için tüy ikonuna tıklayın.'}</Text>
              </View>
            ) : (
              filteredEntries.map((item) => renderEntryCard(item))
            )
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Floating Action Button for writing */}
        {!selectionMode && (
          <TouchableOpacity
            style={styles.fab}
            onPress={() => setWriteModalVisible(true)}
            activeOpacity={0.8}
          >
            <Feather name="feather" size={28} color="#000" />
          </TouchableOpacity>
        )}

        {/* Modal for writing */}
        <JournalWriteModal
          visible={writeModalVisible}
          onClose={() => setWriteModalVisible(false)}
          onSave={async (text) => {
            const now = new Date();
            const newEntry = {
              id: Date.now().toString(),
              text: text,
              date: getLocalDateString(),
              createdAt: now.toISOString(),
            };
            const updatedEntries = [newEntry, ...savedEntries];
            await setJournalEntries(updatedEntries);
            setSavedEntries(updatedEntries);
            await updateStreakOnJournalSave();
          }}
        />

        {/* Selection mode bottom bar */}
        {selectionMode && (
          <View style={styles.selectionBar}>
            <TouchableOpacity style={styles.selectionBarBtn} onPress={selectAllVisible}>
              <Feather name="check-square" size={18} color="#fff" />
              <Text style={styles.selectionBarBtnText}>{t('selectAll')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.selectionBarBtn} onPress={copySelected}>
              <Feather name="copy" size={18} color="#fff" />
              <Text style={styles.selectionBarBtnText}>{t('copySelected')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.selectionBarBtn, { backgroundColor: '#F44336' }]} onPress={deleteBatch}>
              <Feather name="trash-2" size={18} color="#fff" />
              <Text style={[styles.selectionBarBtnText, { color: '#fff' }]}>{t('delete')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Hidden ViewShot component for sharing */}
        <View style={{ position: 'absolute', left: -2000, top: -2000 }}>
          <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }}>
            <ShareStreakCard
              streak={streakInfo.count || 0}
              userName={appSettings?.userName}
              t={t}
              type="streak"
            />
          </ViewShot>
        </View>

        <View style={{ position: 'absolute', left: -2000, top: -2000 }}>
          <ViewShot ref={inviteShotRef} options={{ format: 'png', quality: 1.0 }}>
            <ShareStreakCard
              streak={0}
              userName={appSettings?.userName}
              t={t}
              type="invite"
            />
          </ViewShot>
        </View>
      </View>

      <Modal visible={editModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => {
              setEditModalVisible(false);
              Keyboard.dismiss();
            }}
          />
          <View style={styles.editSheet}>
            <Text style={styles.editTitle}>{t('editJournal')}</Text>
            <TextInput
              style={styles.editInput}
              multiline
              placeholder={t('journalPlaceholder')}
              placeholderTextColor="#777"
              value={editText}
              onChangeText={setEditText}
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.editBtn, { backgroundColor: '#333' }]}
                onPress={() => {
                  setEditModalVisible(false);
                  Keyboard.dismiss();
                }}
              >
                <Text style={styles.editBtnTextLight}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.editBtn, { backgroundColor: '#fff' }]} onPress={saveEdit}>
                <Text style={styles.editBtnTextDark}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pageContainer: { flex: 1, paddingHorizontal: 24, paddingTop: 60 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontSize: 32, fontWeight: '700', color: '#ffffff' },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#1E1E1E',
  },
  selectBtnActive: { backgroundColor: '#fff' },
  selectBtnText: { color: '#A0A0A0', fontWeight: '600', fontSize: 13 },
  selectBtnTextActive: { color: '#000' },
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#1E1E1E',
  },
  modeChipActive: { backgroundColor: '#ffffff' },
  modeChipText: { color: '#A0A0A0', fontWeight: '600', fontSize: 14 },
  modeChipTextActive: { color: '#000000' },
  filterBar: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 10,
    marginBottom: 20,
    alignItems: 'center',
    gap: 10,
  },
  filterInput: { color: '#ffffff', flex: 1, fontSize: 14 },
  calendarCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  calendarHint: {
    color: '#777',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  copyDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  copyDayBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  writeCard: { backgroundColor: '#1E1E1E', borderRadius: 20, padding: 20, marginBottom: 16 },
  writeCardTitle: { fontSize: 16, fontWeight: '600', color: '#ffffff', marginBottom: 10 },
  textAreaWrapper: { backgroundColor: '#121212', borderRadius: 12, padding: 12, minHeight: 120 },
  textArea: { color: '#ffffff', fontSize: 15, textAlignVertical: 'top' },
  writeActionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionButton: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  clearButton: { backgroundColor: '#F44336', paddingHorizontal: 16 },
  clearButtonText: { color: '#ffffff', fontWeight: '600' },
  actionButtonText: { color: '#000000', fontWeight: '600' },
  card: { backgroundColor: '#1E1E1E', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 2, borderColor: 'transparent' },
  cardSelected: { borderWidth: 2, borderColor: '#4CAF50' },
  cardInner: { flexDirection: 'row', alignItems: 'flex-start' },
  checkboxArea: { marginRight: 14, marginTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateLabel: { color: '#A0A0A0', fontSize: 12 },
  editChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  editChipText: { color: '#121212', fontSize: 12, fontWeight: '600' },
  cardContent: { fontSize: 15, color: '#D0D0D0', lineHeight: 22 },
  deleteAction: {
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    borderRadius: 20,
    marginBottom: 16,
    marginLeft: 15,
  },
  copyAction: {
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    borderRadius: 20,
    marginBottom: 16,
    marginRight: 15,
  },
  swipeLabel: { color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 8 },
  selectionBar: {
    position: 'absolute',
    bottom: 110,
    left: 24,
    right: 24,
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 10,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 0,
    borderWidth: Platform.OS === 'android' ? 1 : 0,
    borderColor: '#333',
  },
  selectionBarBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: '#2A2A2A',
  },
  selectionBarBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  selectionBarCopyBtn: { backgroundColor: '#fff' },
  selectionBarCopyText: { color: '#000', fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  editSheet: {
    backgroundColor: '#1E1E1E',
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  editTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  editInput: {
    backgroundColor: '#121212',
    color: '#fff',
    borderRadius: 12,
    padding: 16,
    minHeight: 140,
    textAlignVertical: 'top',
    fontSize: 15,
    marginBottom: 16,
  },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  editBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  editBtnTextLight: { color: '#fff', fontWeight: '600' },
  editBtnTextDark: { color: '#000', fontWeight: '600' },
  fab: {
    position: 'absolute',
    bottom: 110, // Tab barın üzerinde
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 99,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#555',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 40,
  },
  statsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  statLabel: {
    color: '#A0A0A0',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  statCardLarge: {
    backgroundColor: '#1E1E1E',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  statCardLargeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  statLabelLarge: {
    color: '#A0A0A0',
    fontSize: 16,
    fontWeight: '600',
  },
  statValueLarge: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginVertical: 4,
  },
  statHintLarge: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  statShareBtn: {
    position: 'absolute',
    top: 8,
    right: 12,
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  inviteFriendsBtn: {
    backgroundColor: '#1E1E1E',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#333',
    gap: 16,
  },
  inviteBtnIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#9C27B0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBtnTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  inviteBtnSubtitle: {
    color: '#A0A0A0',
    fontSize: 12,
    marginTop: 2,
  },
});
