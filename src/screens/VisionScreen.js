import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Keyboard,
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Animated as RNAnimated,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { Swipeable } from 'react-native-gesture-handler';

import { getStreak, getVisionNotes, setVisionNotes } from '../storage';
import { useI18n } from '../utils/i18n';
import { getLocalDateString } from '../utils/journalDates';

const { width } = Dimensions.get('window');

export default function VisionScreen() {
  const { t } = useI18n();
  const [streakCount, setStreakCount] = useState(0);
  const [visions, setVisions] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTargetDays, setNewTargetDays] = useState('');
  const isFocused = useIsFocused();
  const swipeableRefs = useRef(new Map());

  // Score modal state
  const [scoreModalVisible, setScoreModalVisible] = useState(false);
  const [scoringVisionId, setScoringVisionId] = useState(null);

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  // Search state
  const [searchText, setSearchText] = useState('');

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Tabs state
  const [activeTab, setActiveTab] = useState('timed'); // 'timed' | 'timeless'

  useEffect(() => {
    if (isFocused) loadData();
  }, [isFocused]);

  // Exit selection mode when leaving
  useEffect(() => {
    if (!isFocused) {
      setSelectionMode(false);
      setSelectedIds(new Set());
    }
  }, [isFocused]);

  const loadData = async () => {
    const streak = await getStreak();
    setStreakCount(streak.count || 0);
    const list = await getVisionNotes();
    setVisions(list);
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      setIsModalVisible(true);
    }, 500);
  };

  const saveVision = async () => {
    if (newTitle.trim() === '' || newContent.trim() === '') {
      return Alert.alert('Hata', 'Başlık ve içerik boş olamaz.');
    }
    const days = parseInt(newTargetDays, 10);
    const targetDays = isNaN(days) ? 0 : days;
    const newVision = {
      id: Date.now().toString(),
      title: newTitle,
      content: newContent,
      targetDays,
      dailyLog: [],
    };
    const updatedVisions = [newVision, ...visions];
    setVisions(updatedVisions);
    await setVisionNotes(updatedVisions);
    setNewTitle('');
    setNewContent('');
    setNewTargetDays('');
    setIsModalVisible(false);
    Keyboard.dismiss();
  };

  const deleteVision = (id) => {
    Alert.alert('Sil', 'Bu vizyonu silmek istiyor musun?', [
      { text: 'İptal', style: 'cancel', onPress: () => swipeableRefs.current.get(id)?.close() },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const updated = visions.filter((v) => v.id !== id);
          setVisions(updated);
          await setVisionNotes(updated);
        },
      },
    ]);
  };

  // --- Copy single vision ---
  const copyVision = async (item) => {
    const txt = `★ ${item.title}\n${item.content}`;
    await Clipboard.setStringAsync(txt);
    Alert.alert(t('copiedTitle'), t('visionCopied'));
    swipeableRefs.current.get(item.id)?.close();
  };

  // --- Edit vision ---
  const openEditVision = (item) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditContent(item.content);
    setEditModalVisible(true);
    swipeableRefs.current.get(item.id)?.close();
  };

  const saveEditVision = async () => {
    if (!editingId || editTitle.trim() === '' || editContent.trim() === '') return;
    const updated = visions.map((v) =>
      v.id === editingId ? { ...v, title: editTitle.trim(), content: editContent.trim() } : v
    );
    setVisions(updated);
    await setVisionNotes(updated);
    setEditModalVisible(false);
    setEditingId(null);
    setEditTitle('');
    setEditContent('');
    Keyboard.dismiss();
  };

  // --- Selection mode ---
  const toggleSelectionMode = () => {
    Keyboard.dismiss();
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

  const selectAll = () => {
    setSelectedIds(new Set(filteredVisions.map((v) => v.id)));
  };

  const copySelected = async () => {
    const items = visions.filter((v) => selectedIds.has(v.id));
    if (items.length === 0) return Alert.alert(t('warning'), t('noVisionSelected'));
    const txt = items.map((v) => `★ ${v.title}\n${v.content}`).join('\n\n');
    await Clipboard.setStringAsync(txt);
    Alert.alert(t('copiedTitle'), `${items.length} ${t('visionsCopied')}`);
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  // --- Filter ---
  const filteredVisions = visions.filter((v) => {
    // Search match
    const searchMatch =
      v.title.toLowerCase().includes(searchText.toLowerCase()) ||
      v.content.toLowerCase().includes(searchText.toLowerCase());

    if (!searchMatch) return false;

    // Tab match
    const isTimed = v.targetDays > 0;
    if (activeTab === 'timed') return isTimed;
    return !isTimed;
  });

  // --- Progress helper ---
  const getProgress = (item) => {
    if (!item.targetDays || item.targetDays <= 0) return null;
    const log = item.dailyLog || [];
    const earned = log.reduce((sum, d) => sum + (d.score || 0), 0);
    return Math.min(earned / item.targetDays, 1);
  };

  const getTodayScoreValue = (item) => {
    const today = getLocalDateString();
    const log = item.dailyLog || [];
    const entry = log.find((d) => d.date === today);
    return entry ? entry.score : null;
  };

  const openScoreModal = (id) => {
    setScoringVisionId(id);
    setScoreModalVisible(true);
  };

  const logScore = async (score) => {
    if (!scoringVisionId) return;
    const today = getLocalDateString();
    const updated = visions.map((v) => {
      if (v.id !== scoringVisionId) return v;
      const log = v.dailyLog || [];
      const newLog = log.filter(d => d.date !== today);
      newLog.push({ date: today, score });
      return { ...v, dailyLog: newLog };
    });
    setVisions(updated);
    await setVisionNotes(updated);
    
    // Import visionCheckin module dynamically to avoid circular dependencies issues if any, or just call scheduleVisionCheckinNotification if we imported it
    // For now we just update state. Checkin notification will sync on next load or we can import it at top.
    
    setScoreModalVisible(false);
    setScoringVisionId(null);
  };

  // --- Swipe actions ---
  const renderRightActions = () => (
    <View style={styles.deleteAction}>
      <Feather name="trash-2" size={24} color="#fff" />
    </View>
  );

  const renderLeftActions = () => (
    <View style={styles.leftActionsRow}>
      <View style={styles.copyAction}>
        <Feather name="copy" size={20} color="#fff" />
        <Text style={styles.swipeLabel}>{t('copy')}</Text>
      </View>
      <View style={styles.editAction}>
        <Feather name="edit-2" size={20} color="#fff" />
        <Text style={styles.swipeLabel}>{t('edit')}</Text>
      </View>
    </View>
  );

  const onLeftSwipeOpen = (item) => {
    // Show action sheet
    Alert.alert(t('areYouSure') || 'İşlem Seç', '', [
      { text: t('copy'), onPress: () => copyVision(item) },
      { text: t('edit'), onPress: () => openEditVision(item) },
      { text: t('cancel'), style: 'cancel', onPress: () => swipeableRefs.current.get(item.id)?.close() },
    ]);
  };

  return (
    <View style={styles.pageContainer}>
        {/* Title */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{t('tabVision')}</Text>
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

      <View style={styles.streakBadge}>
        <Feather name="zap" size={16} color="#FFD700" />
        <Text style={styles.streakText}>{streakCount} {t('streakDays')}</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Feather name="search" size={16} color="#555" />
        <TextInput
              style={styles.searchBarInput}
              placeholder={t('searchVision')}
              placeholderTextColor="#555"
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <Feather name="x-circle" size={16} color="#555" />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'timed' && styles.tabBtnActive]}
          onPress={() => setActiveTab('timed')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'timed' && styles.tabBtnTextActive]}>
            {t('timedVisions')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'timeless' && styles.tabBtnActive]}
          onPress={() => setActiveTab('timeless')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'timeless' && styles.tabBtnTextActive]}>
            {t('timelessVisions')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
            title={t('scrollToAdd')}
            titleColor="#A0A0A0"
          />
        }
      >
        {filteredVisions.map((item) => {
          const progress = getProgress(item);
          return (
            <Swipeable
              key={item.id}
              ref={(ref) => swipeableRefs.current.set(item.id, ref)}
              renderRightActions={selectionMode ? undefined : renderRightActions}
              rightThreshold={width / 2.5}
              onSwipeableRightOpen={() => deleteVision(item.id)}
              renderLeftActions={selectionMode ? undefined : renderLeftActions}
              leftThreshold={width / 3}
              onSwipeableLeftOpen={() => onLeftSwipeOpen(item)}
              enabled={!selectionMode}
            >
              <TouchableOpacity
                activeOpacity={selectionMode ? 0.7 : 1}
                onPress={selectionMode ? () => toggleSelect(item.id) : undefined}
              >
                <View style={[styles.card, selectionMode && selectedIds.has(item.id) && styles.cardSelected]}>
                  {/* Progress background fill */}
                  {progress !== null && (
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.round(progress * 100)}%` },
                      ]}
                    />
                  )}
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
                      <View style={styles.cardHeader}>
                        <Feather name="star" size={20} color="#4CAF50" />
                        <Text style={styles.cardTitle}>{item.title}</Text>
                      </View>
                      <Text style={styles.cardContent}>{item.content}</Text>
                      
                      <View style={styles.progressInfoRow}>
                        {progress !== null ? (
                          <View style={styles.progressInfo}>
                            <Feather name="target" size={14} color="#FFD700" />
                            <Text style={styles.progressText}>
                              {Math.round(progress * 100)}% · {(item.dailyLog || []).length}/{item.targetDays} {t('days')}
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.progressInfo}>
                            <Feather name="clock" size={14} color="#A0A0A0" />
                            <Text style={styles.progressText}>{t('timelessVisions')}</Text>
                          </View>
                        )}

                        {!selectionMode && getTodayScoreValue(item) === null && (
                          <TouchableOpacity style={styles.scoreBtn} onPress={() => openScoreModal(item.id)}>
                            <Text style={styles.scoreBtnText}>{t('checkin')}</Text>
                            <Feather name="check" size={14} color="#000" />
                          </TouchableOpacity>
                        )}
                        {!selectionMode && getTodayScoreValue(item) !== null && (
                          <TouchableOpacity 
                            style={[
                              styles.scoreBtn, 
                              getTodayScoreValue(item) === 1 ? { backgroundColor: '#4CAF50' } :
                              getTodayScoreValue(item) === 0.5 ? { backgroundColor: '#FF9800' } :
                              { backgroundColor: '#F44336' }
                            ]}
                            onPress={() => openScoreModal(item.id)}
                          >
                            <Text style={[styles.scoreBtnText, { color: '#fff' }]}>
                              {getTodayScoreValue(item) === 1 ? t('doneBtn') : getTodayScoreValue(item) === 0.5 ? t('halfBtn') : t('failBtn')}
                            </Text>
                            <Feather name={getTodayScoreValue(item) === 1 ? "check-circle" : getTodayScoreValue(item) === 0.5 ? "minus-circle" : "x-circle"} size={14} color="#fff" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </Swipeable>
          );
        })}
        {filteredVisions.length === 0 && (
          <Text style={{ color: '#777', textAlign: 'center', marginTop: 20 }}>
            {searchText ? t('noResult') : t('scrollToAdd')}
          </Text>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Selection mode bottom bar */}
      {selectionMode && (
        <View style={styles.selectionBar}>
          <TouchableOpacity style={styles.selectionBarBtn} onPress={selectAll}>
            <Feather name="check-circle" size={18} color="#fff" />
            <Text style={styles.selectionBarBtnText}>{t('selectAll')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.selectionBarBtn, styles.selectionBarCopyBtn]}
            onPress={copySelected}
          >
            <Feather name="copy" size={18} color="#000" />
            <Text style={styles.selectionBarCopyText}>
              {t('copySelected')} ({selectedIds.size})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Add modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={styles.modalOverlay}
          keyboardVerticalOffset={0} 
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => {
              setIsModalVisible(false);
              Keyboard.dismiss();
            }}
          />
          <View style={styles.addCard}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>{t('createVision')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('titlePlaceholder')}
              placeholderTextColor="#777"
              value={newTitle}
              onChangeText={setNewTitle}
            />
            <TextInput
              style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]}
              multiline
              placeholder={t('contentPlaceholder')}
              placeholderTextColor="#777"
              value={newContent}
              onChangeText={setNewContent}
            />
            <TextInput
              style={styles.input}
              placeholder={t('targetDaysPlaceholder')}
              placeholderTextColor="#777"
              value={newTargetDays}
              onChangeText={setNewTargetDays}
              keyboardType="number-pad"
            />
            <View style={styles.addActions}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: '#333' }]}
                onPress={() => {
                  setIsModalVisible(false);
                  Keyboard.dismiss();
                }}
              >
                <Text style={styles.btnTextWhite}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={saveVision}>
                <Text style={styles.btnTextBlack}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={styles.modalOverlay}
          keyboardVerticalOffset={0}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => {
              setEditModalVisible(false);
              Keyboard.dismiss();
            }}
          />
          <View style={styles.addCard}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>{t('editVision')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('titleLabel')}
              placeholderTextColor="#777"
              value={editTitle}
              onChangeText={setEditTitle}
            />
            <TextInput
              style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]}
              multiline
              placeholder={t('contentLabel')}
              placeholderTextColor="#777"
              value={editContent}
              onChangeText={setEditContent}
            />
            <View style={styles.addActions}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: '#333' }]}
                onPress={() => {
                  setEditModalVisible(false);
                  Keyboard.dismiss();
                }}
              >
                <Text style={styles.btnTextWhite}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={saveEditVision}>
                <Text style={styles.btnTextBlack}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* Score modal */}
      <Modal visible={scoreModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlayCenter}>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreTitle}>{t('didYouDoIt')}</Text>
            <View style={styles.scoreOptions}>
              <TouchableOpacity style={[styles.scoreOptionBtn, { backgroundColor: '#F44336' }]} onPress={() => logScore(0)}>
                <Text style={styles.scoreOptionText}>{t('failBtn')} (0)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.scoreOptionBtn, { backgroundColor: '#FF9800' }]} onPress={() => logScore(0.5)}>
                <Text style={styles.scoreOptionText}>{t('halfBtn')} (0.5)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.scoreOptionBtn, { backgroundColor: '#4CAF50' }]} onPress={() => logScore(1)}>
                <Text style={styles.scoreOptionText}>{t('doneBtn')} (1)</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={{ marginTop: 20, alignSelf: 'center' }} onPress={() => setScoreModalVisible(false)}>
              <Text style={{ color: '#A0A0A0' }}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: { flex: 1, backgroundColor: '#121212', paddingHorizontal: 24, paddingTop: 60 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
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
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 8,
    marginBottom: 16,
  },
  streakText: { fontSize: 14, color: '#FFD700', fontWeight: '600' },
  searchBar: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabBtnActive: {
    backgroundColor: '#333',
  },
  tabBtnText: {
    color: '#A0A0A0',
    fontSize: 13,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: '#fff',
  },
  searchBarInput: { color: '#ffffff', flex: 1, fontSize: 14 },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 24,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  cardSelected: { borderWidth: 2, borderColor: '#4CAF50' },
  cardInner: { flexDirection: 'row', alignItems: 'flex-start', zIndex: 2, padding: 20 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff', flexShrink: 1 },
  cardContent: { fontSize: 15, color: '#D0D0D0', lineHeight: 22 },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: 'rgba(76, 175, 80, 0.12)',
    borderRadius: 24,
    zIndex: 1,
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: 'rgba(255,215,0,0.1)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  progressText: { color: '#FFD700', fontSize: 12, fontWeight: '600' },
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
  deleteAction: {
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    borderRadius: 24,
    marginBottom: 16,
    marginLeft: 15,
  },
  leftActionsRow: {
    flexDirection: 'row',
    marginBottom: 16,
    marginRight: 15,
    gap: 4,
  },
  copyAction: {
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    paddingVertical: 12,
  },
  editAction: {
    backgroundColor: '#FF9800',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    paddingVertical: 12,
  },
  swipeLabel: { color: '#fff', fontSize: 11, fontWeight: '600', marginTop: 4 },
  selectionBar: {
    position: 'absolute',
    bottom: 95,
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
    elevation: 10,
  },
  selectionBarBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#2A2A2A',
  },
  selectionBarBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  selectionBarCopyBtn: { backgroundColor: '#fff' },
  selectionBarCopyText: { color: '#000', fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  addCard: {
    backgroundColor: '#1E1E1E',
    padding: 24,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingBottom: 50,
  },
  input: { backgroundColor: '#121212', color: '#fff', padding: 16, borderRadius: 12, marginBottom: 16, fontSize: 15 },
  addActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  btn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, backgroundColor: '#fff' },
  btnTextWhite: { color: '#fff', fontWeight: '600' },
  btnTextBlack: { color: '#000', fontWeight: '600' },
  progressInfoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  scoreBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFD700', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12 },
  scoreBtnText: { color: '#000', fontSize: 13, fontWeight: '700' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  scoreCard: { backgroundColor: '#1E1E1E', padding: 24, borderRadius: 24 },
  scoreTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  scoreOptions: { gap: 12 },
  scoreOptionBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  scoreOptionText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
