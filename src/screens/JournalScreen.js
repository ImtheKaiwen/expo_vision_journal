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
  AppState,
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
import TodoItem from '../components/TodoItem';
import TodoWriteModal from '../components/TodoWriteModal';
import AudioRecorderModal from '../components/AudioRecorderModal';
import AudioItem from '../components/AudioItem';
import VideoRecorderModal from '../components/VideoRecorderModal';
import VideoItem from '../components/VideoItem';
import PremiumPaywall from '../components/PremiumPaywall';
import AIPlannerModal from '../components/AIPlannerModal';
import { 
  getJournalEntries, 
  setJournalEntries, 
  updateStreakOnJournalSave, 
  getStreak, 
  getAppSettings,
  getTodoEntries,
  setTodoEntries,
  getAudioEntries,
  setAudioEntries,
  getVideoEntries,
  setVideoEntries
} from '../storage';
import {
  scheduleTodoReminder,
  cancelTodoReminder,
} from '../notifications/todoReminders';
import { requestNotificationPermissionsFromUser } from '../notifications/dailyReminder';
import {
  addCalendarMonths,
  countEntriesByDay,
  entryToYmd,
  ymdKey,
  getLocalDateString,
} from '../utils/journalDates';
import { useI18n } from '../utils/i18n';
import { checkPremiumStatus } from '../services/iapService';

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
  const [activeMainTab, setActiveMainTab] = useState('reflect'); // 'plan' | 'reflect'
  const [todos, setTodos] = useState([]);
  const [todoModalVisible, setTodoModalVisible] = useState(false);
  const [todoFilter, setTodoFilter] = useState('active'); // 'active' | 'completed'
  const hasCheckedRollover = useRef(false);
  const [reflectMediaType, setReflectMediaType] = useState('text'); // 'text' | 'audio' | 'video'
  const [audioEntries, setAudioEntriesState] = useState([]);
  const [audioModalVisible, setAudioModalVisible] = useState(false);
  const [videoEntries, setVideoEntriesState] = useState([]);
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [aiPlannerVisible, setAiPlannerVisible] = useState(false);
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [scheduledNotifications, setScheduledNotifications] = useState([]);

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active' && isFocused) {
        checkPremiumStatus().then(status => {
          setIsPremium(status);
        });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    if (isFocused) {
      loadEntries();
      loadStreak();
      loadTodos();
      loadAudio();
      loadVideo();
      getAppSettings().then(async (settings) => {
        const isActuallyPremium = await checkPremiumStatus();
        console.log('--- GÜNCEL PREMIUM DURUMU (RevenueCat):', isActuallyPremium);
        setAppSettings(settings);
        setIsPremium(isActuallyPremium);
        
        if (settings.isPremium !== isActuallyPremium) {
          await saveAppSettings({ ...settings, isPremium: isActuallyPremium });
        }
      });
      requestNotificationPermissionsFromUser();
    }

    return () => {
      subscription.remove();
    };
  }, [isFocused]);

  const loadAudio = async () => {
    const list = await getAudioEntries();
    setAudioEntriesState(list);
  };

  const loadVideo = async () => {
    const list = await getVideoEntries();
    setVideoEntriesState(list);
  };

  const loadTodos = async () => {
    const list = await getTodoEntries();
    setTodos(list);
    if (!hasCheckedRollover.current) {
      hasCheckedRollover.current = true;
      checkRollover(list);
    }
  };

  const checkRollover = async (currentTodos) => {
    const today = getLocalDateString();
    const missed = currentTodos.filter(t => !t.completed && t.date < today);
    if (missed.length > 0) {
      Alert.alert(
        t('rolloverTitle'),
        t('rolloverMsg').replace('{{count}}', missed.length),
        [
          { text: t('rolloverSkip'), style: 'cancel' },
          { 
            text: t('rolloverBtn'), 
            onPress: async () => {
              const updated = currentTodos.map(t => 
                (!t.completed && t.date < today) ? { ...t, date: today } : t
              );
              setTodos(updated);
              await setTodoEntries(updated);
            }
          }
        ]
      );
    }
  };

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

  const addTodo = async (taskObjects) => {
    const today = getLocalDateString();
    const newItems = await Promise.all(taskObjects.map(async (taskObj, index) => {
      const todo = {
        id: (Date.now() + index).toString(),
        text: taskObj.text,
        time: taskObj.time, // AI'dan gelen hazır saat
        completed: false,
        date: today,
      };
      
      // Bildirim planla
      const notificationId = await scheduleTodoReminder(todo);
      if (notificationId) {
        todo.notificationId = notificationId;
      }
      
      return todo;
    }));
    
    const updated = [...newItems, ...todos];
    setTodos(updated);
    await setTodoEntries(updated);
  };

  const addAudio = async (audioData) => {
    const updated = [audioData, ...audioEntries];
    setAudioEntriesState(updated);
    await setAudioEntries(updated);
    await updateStreakOnJournalSave(); // Audio journals also count for streak
    Alert.alert(t('success'), t('audioSaved'));
  };

  const deleteAudio = (id) => {
    Alert.alert(t('delete'), t('areYouSure'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          const updated = audioEntries.filter(a => a.id !== id);
          setAudioEntriesState(updated);
          await setAudioEntries(updated);
        }
      }
    ]);
  };

  const toggleAudioLock = async (id) => {
    const updated = audioEntries.map(a => a.id === id ? { ...a, locked: !a.locked } : a);
    setAudioEntriesState(updated);
    await setAudioEntries(updated);
  };

  const addVideo = async (videoData) => {
    const updated = [videoData, ...videoEntries];
    setVideoEntriesState(updated);
    await setVideoEntries(updated);
    await updateStreakOnJournalSave(); // Video journals also count for streak
    Alert.alert(t('success'), t('videoSaved'));
  };

  const loadScheduledNotifications = async () => {
    const Notifications = require('expo-notifications');
    const list = await Notifications.getAllScheduledNotificationsAsync();
    setScheduledNotifications(list);
  };

  const openNotificationsModal = () => {
    loadScheduledNotifications();
    setNotificationsModalVisible(true);
  };

  const deleteVideo = (id) => {
    Alert.alert(t('delete'), t('areYouSure'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          const updated = videoEntries.filter(v => v.id !== id);
          setVideoEntriesState(updated);
          await setVideoEntries(updated);
        }
      }
    ]);
  };

  const toggleVideoLock = async (id) => {
    const updated = videoEntries.map(v => v.id === id ? { ...v, locked: !v.locked } : v);
    setVideoEntriesState(updated);
    await setVideoEntries(updated);
  };

  const toggleTodo = async (id) => {
    setTodos(prev => {
      const updated = prev.map(t => {
        if (t.id === id) {
          const isMarkingComplete = !t.completed;
          if (isMarkingComplete && t.notificationId) {
            cancelTodoReminder(t.notificationId);
          }
          return { ...t, completed: isMarkingComplete };
        }
        return t;
      });
      setTodoEntries(updated);
      return updated;
    });
  };
 
  const deleteTodo = async (id) => {
    console.log('--- Görev Silme Başladı ---', id);
    const todoToDelete = todos.find(t => t.id === id);
    
    if (todoToDelete?.notificationId) {
      console.log('Bildirim İptal Ediliyor:', todoToDelete.notificationId);
      await cancelTodoReminder(todoToDelete.notificationId);
      // Listeyi tazele
      setTimeout(loadScheduledNotifications, 500);
    } else {
      console.log('Bu görevin bir bildirim ID\'si bulunamadı!');
    }
    
    setTodos(prev => {
      const updated = prev.filter(t => t.id !== id);
      setTodoEntries(updated);
      return updated;
    });
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
    Alert.alert(t('delete'), t('deleteConfirmJournal') || 'Bu günlüğü silmek istediğine emin misin?', [
      { text: t('cancel'), style: 'cancel', onPress: () => swipeableRefs.current.get(id)?.close() },
      {
        text: t('delete'),
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
    const formattedDateTime = now.toLocaleString(langCode === 'en' ? 'en-US' : 'tr-TR', {
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
    let items = [];
    if (viewMode === 'calendar' && selectedDay) {
      items = entriesForSelectedDay;
    } else {
      if (reflectMediaType === 'audio') items = audioEntries;
      else if (reflectMediaType === 'video') items = videoEntries;
      else items = filteredEntries;
    }
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
    let currentList = savedEntries;
    if (reflectMediaType === 'audio') currentList = audioEntries;
    else if (reflectMediaType === 'video') currentList = videoEntries;

    const items = currentList.filter((e) => selectedIds.has(e.id));
    if (items.length === 0) return Alert.alert(t('warning'), t('noEntrySelected'));
    Alert.alert(t('delete'), `${items.length} ${t('deleteBatchConfirm')}`, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          const updated = currentList.filter((item) => !selectedIds.has(item.id));
          if (reflectMediaType === 'audio') {
            setAudioEntriesState(updated);
            await setAudioEntries(updated);
          } else if (reflectMediaType === 'video') {
            setVideoEntriesState(updated);
            await setVideoEntries(updated);
          } else {
            setSavedEntries(updated);
            await setJournalEntries(updated);
          }
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
    let source = savedEntries;
    if (reflectMediaType === 'audio') source = audioEntries;
    if (reflectMediaType === 'video') source = videoEntries;

    const counts = [0, 0, 0, 0, 0, 0, 0]; // 0: Sun, 1: Mon...
    source.forEach(e => {
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

    const dayLabels = t('fullDayNames').split(',');
    return {
      total: source.length,
      topDay: maxVal > 0 ? dayLabels[maxIdx] : '-',
    };
  }, [savedEntries, audioEntries, videoEntries, reflectMediaType, t]);

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

  const countsByDay = useMemo(() => {
    let source = savedEntries;
    if (reflectMediaType === 'audio') source = audioEntries;
    if (reflectMediaType === 'video') source = videoEntries;
    
    return countEntriesByDay(source, cursor.year, cursor.monthIndex);
  }, [savedEntries, audioEntries, videoEntries, reflectMediaType, cursor.year, cursor.monthIndex]);

  const entriesForSelectedDay = useMemo(() => {
    if (!selectedDay) return [];
    const key = ymdKey(selectedDay);
    
    let source = savedEntries;
    if (reflectMediaType === 'audio') source = audioEntries;
    if (reflectMediaType === 'video') source = videoEntries;

    return source.filter((e) => {
      const ymd = entryToYmd(e);
      return ymd && ymdKey(ymd) === key;
    });
  }, [savedEntries, audioEntries, videoEntries, reflectMediaType, selectedDay]);

  const todosForSelectedDay = useMemo(() => {
    if (!selectedDay) return [];
    const key = ymdKey(selectedDay);
    return todos.filter((t) => t.date === key);
  }, [todos, selectedDay]);

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
        dialogTitle: t('shareTitle'),
        UTI: 'public.png',
      });
    } catch (e) {
      Alert.alert(t('error'), t('shareError') || 'Paylaşım hazırlanırken bir sorun oluştu.');
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
    } catch (e) {
      Alert.alert(t('error'), t('inviteError') || 'Davet hazırlanırken bir sorun oluştu.');
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
          <View style={styles.headerRight}>
            {activeMainTab === 'plan' && (
              <TouchableOpacity onPress={openNotificationsModal} style={styles.headerBellBtn}>
                <Feather name="bell" size={22} color="#4CAF50" />
              </TouchableOpacity>
            )}
            {activeMainTab === 'reflect' && viewMode !== 'heatmap' && (
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
            )}
          </View>
        </View>

        {/* Main Tabs */}
        <View style={styles.mainTabRow}>
          <TouchableOpacity 
            style={[styles.mainTabBtn, activeMainTab === 'plan' && styles.mainTabBtnActive]}
            onPress={() => setActiveMainTab('plan')}
          >
            <Text style={[styles.mainTabBtnText, activeMainTab === 'plan' && styles.mainTabBtnTextActive]}>
              {t('tabPlan')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.mainTabBtn, activeMainTab === 'reflect' && styles.mainTabBtnActive]}
            onPress={() => setActiveMainTab('reflect')}
          >
            <Text style={[styles.mainTabBtnText, activeMainTab === 'reflect' && styles.mainTabBtnTextActive]}>
              {t('tabReflect')}
            </Text>
          </TouchableOpacity>
        </View>

        {activeMainTab === 'reflect' ? (
          <>
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
                  {t('heatmap')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Media Type Tabs (Sub-Tabs) */}
            <View style={styles.mediaTypeRow}>
              <TouchableOpacity 
                style={[styles.mediaTypeBtn, reflectMediaType === 'text' && styles.mediaTypeBtnActive]}
                onPress={() => setReflectMediaType('text')}
              >
                <Feather name="type" size={14} color={reflectMediaType === 'text' ? '#fff' : '#777'} />
                <Text style={[styles.mediaTypeBtnText, reflectMediaType === 'text' && styles.mediaTypeBtnTextActive]}>
                  {t('typeText')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.mediaTypeBtn, reflectMediaType === 'audio' && styles.mediaTypeBtnActive]}
                onPress={() => setReflectMediaType('audio')}
              >
                <Feather name="mic" size={14} color={reflectMediaType === 'audio' ? '#fff' : '#777'} />
                <Text style={[styles.mediaTypeBtnText, reflectMediaType === 'audio' && styles.mediaTypeBtnTextActive]}>
                  {t('typeAudio')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.mediaTypeBtn, reflectMediaType === 'video' && styles.mediaTypeBtnActive]}
                onPress={() => setReflectMediaType('video')}
              >
                <Feather name="video" size={14} color={reflectMediaType === 'video' ? '#fff' : '#777'} />
                <Text style={[styles.mediaTypeBtnText, reflectMediaType === 'video' && styles.mediaTypeBtnTextActive]}>
                  {t('typeVideo')}
                </Text>
              </TouchableOpacity>
            </View>

            {viewMode === 'list' && reflectMediaType === 'text' ? (
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
          </>
        ) : null}

        <ScrollView
          ref={mainScrollRef}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Write Card Removed for FAB/Modal system */}

          {activeMainTab === 'plan' ? (
            <View style={styles.planSection}>
              <TouchableOpacity 
                style={[styles.aiCard, isPremium && styles.aiCardPremium]} 
                activeOpacity={0.8}
                onPress={() => isPremium ? setAiPlannerVisible(true) : setPaywallVisible(true)}
              >
                <View style={styles.aiCardContent}>
                  <Feather name="cpu" size={24} color={isPremium ? "#fff" : "#4CAF50"} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.aiCardTitle, isPremium && { color: '#fff' }]}>
                      {isPremium ? t('visionAiPlanner') : t('quickPlanner')}
                    </Text>
                    <Text style={[styles.aiCardSubtitle, isPremium && { color: 'rgba(255,255,255,0.7)' }]}>
                      {isPremium ? t('tapToPlan') : t('manualOrAiPlan')}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={isPremium ? "#fff" : "#555"} />
                </View>
              </TouchableOpacity>

              <View style={styles.todoStatsRow}>
                <TouchableOpacity 
                  style={[styles.todoStat, todoFilter === 'active' && styles.todoStatActive]} 
                  onPress={() => setTodoFilter('active')}
                >
                  <Text style={[styles.todoStatValue, todoFilter === 'active' && styles.todoStatValueActive]}>
                    {todos.filter(t => t.date === getLocalDateString() && !t.completed).length}
                  </Text>
                  <Text style={[styles.todoStatLabel, todoFilter === 'active' && styles.todoStatLabelActive]}>{t('todoRemaining')}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.todoStat, todoFilter === 'completed' && styles.todoStatActive]} 
                  onPress={() => setTodoFilter('completed')}
                >
                  <Text style={[styles.todoStatValue, todoFilter === 'completed' && styles.todoStatValueActive]}>
                    {todos.filter(t => t.date === getLocalDateString() && t.completed).length}
                  </Text>
                  <Text style={[styles.todoStatLabel, todoFilter === 'completed' && styles.todoStatLabelActive]}>{t('todoCompleted')}</Text>
                </TouchableOpacity>

                {/* History Button */}
                <TouchableOpacity 
                  style={styles.historyBtn} 
                  onPress={() => setTodoFilter('history')}
                >
                  <Feather name="clock" size={20} color={todoFilter === 'history' ? '#4CAF50' : '#A0A0A0'} />
                  <Text style={[styles.historyBtnText, todoFilter === 'history' && { color: '#fff' }]}>{t('history')}</Text>
                </TouchableOpacity>
              </View>

              {/* Tasks List */}
              {todoFilter === 'history' ? (
                todos.filter(t => t.date < getLocalDateString() && !t.completed).length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Feather name="smile" size={48} color="#2A2A2A" style={{ marginBottom: 16 }} />
                    <Text style={styles.emptyText}>{t('noPastTodo')}</Text>
                  </View>
                ) : (
                  todos
                    .filter(t => t.date < getLocalDateString() && !t.completed)
                    .map(item => (
                      <TodoItem 
                        key={item.id} 
                        item={item} 
                        onToggle={toggleTodo} 
                        onDelete={deleteTodo} 
                      />
                    ))
                )
              ) : todos.filter(t => t.date === getLocalDateString() && (todoFilter === 'active' ? !t.completed : t.completed)).length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Feather name={todoFilter === 'active' ? "check-circle" : "info"} size={48} color="#2A2A2A" style={{ marginBottom: 16 }} />
                  <Text style={styles.emptyText}>
                    {todoFilter === 'active' ? t('noTodo') : t('noCompletedTodo')}
                  </Text>
                </View>
              ) : (
                todos
                  .filter(t => t.date === getLocalDateString() && (todoFilter === 'active' ? !t.completed : t.completed))
                  .map(item => (
                    <TodoItem 
                      key={item.id} 
                      item={item} 
                      onToggle={toggleTodo} 
                      onDelete={deleteTodo} 
                    />
                  ))
              )}
            </View>
          ) : viewMode === 'heatmap' ? (
            <>
              <Heatmap entries={
                reflectMediaType === 'audio' ? audioEntries :
                reflectMediaType === 'video' ? videoEntries :
                savedEntries
              } />
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
              ) : activeMainTab === 'plan' ? (
                todosForSelectedDay.length === 0 ? (
                  <Text style={styles.calendarHint}>{t('noTodo')}</Text>
                ) : (
                  todosForSelectedDay.map((item) => (
                    <TodoItem 
                      key={item.id} 
                      item={item} 
                      onToggle={toggleTodo} 
                      onDelete={deleteTodo} 
                    />
                  ))
                )
              ) : entriesForSelectedDay.length === 0 ? (
                <Text style={styles.calendarHint}>{t('journalNoEntry')}</Text>
              ) : (
                <>
                  {!selectionMode && reflectMediaType === 'text' && (
                    <TouchableOpacity style={styles.copyDayBtn} onPress={copyDayEntries}>
                      <Feather name="copy" size={16} color="#000" />
                      <Text style={styles.copyDayBtnText}>
                        {t('copyDay')} ({entriesForSelectedDay.length})
                      </Text>
                    </TouchableOpacity>
                  )}
                  {entriesForSelectedDay.map((item) => {
                    if (reflectMediaType === 'audio') {
                      return (
                        <AudioItem 
                          key={item.id} 
                          item={item} 
                          onDelete={deleteAudio} 
                          onToggleLock={toggleAudioLock}
                          selectionMode={selectionMode}
                          isSelected={selectedIds.has(item.id)}
                          onSelect={() => toggleSelect(item.id)}
                        />
                      );
                    }
                    if (reflectMediaType === 'video') {
                      return (
                        <VideoItem 
                          key={item.id} 
                          item={item} 
                          onDelete={deleteVideo} 
                          onToggleLock={toggleVideoLock}
                          selectionMode={selectionMode}
                          isSelected={selectedIds.has(item.id)}
                          onSelect={() => toggleSelect(item.id)}
                        />
                      );
                    }
                    return renderEntryCard(item);
                  })}
                </>
              )}
            </>
            ) : (
            reflectMediaType === 'audio' ? (
              audioEntries.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Feather name="mic" size={48} color="#2A2A2A" style={{ marginBottom: 16 }} />
                  <Text style={styles.emptyText}>{t('noAudio')}</Text>
                </View>
              ) : (
                audioEntries.map((item) => (
                  <AudioItem 
                    key={item.id} 
                    item={item} 
                    onDelete={deleteAudio} 
                    onToggleLock={toggleAudioLock}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(item.id)}
                    onSelect={() => toggleSelect(item.id)}
                  />
                ))
              )
            ) : reflectMediaType === 'video' ? (
              videoEntries.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Feather name="video" size={48} color="#2A2A2A" style={{ marginBottom: 16 }} />
                  <Text style={styles.emptyText}>{t('noVideo')}</Text>
                </View>
              ) : (
                videoEntries.map((item) => (
                  <VideoItem 
                    key={item.id} 
                    item={item} 
                    onDelete={deleteVideo} 
                    onToggleLock={toggleVideoLock}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(item.id)}
                    onSelect={() => toggleSelect(item.id)}
                  />
                ))
              )
            ) : filteredEntries.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Feather name="feather" size={48} color="#2A2A2A" style={{ marginBottom: 16 }} />
                <Text style={styles.emptyText}>{t('journalNoEntryList')}</Text>
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
            onPress={() => {
              if (activeMainTab === 'plan') {
                setAiPlannerVisible(true);
              }
              else if (reflectMediaType === 'audio') setAudioModalVisible(true);
              else if (reflectMediaType === 'video') setVideoModalVisible(true);
              else setWriteModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Feather 
              name={
                activeMainTab === 'plan' 
                  ? "check-square" 
                  : reflectMediaType === 'audio' 
                    ? "mic" 
                    : reflectMediaType === 'video'
                      ? "video"
                      : "feather"
              } 
              size={28} 
              color="#000" 
            />
          </TouchableOpacity>
        )}

        {/* Modal for writing journal */}
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

        {/* Modal for writing todo */}
        <TodoWriteModal
          visible={todoModalVisible}
          onClose={() => setTodoModalVisible(false)}
          onSave={addTodo}
        />

        <AudioRecorderModal
          visible={audioModalVisible}
          onClose={() => setAudioModalVisible(false)}
          onSave={addAudio}
        />

        {/* Modal for video recording */}
        <VideoRecorderModal
          visible={videoModalVisible}
          onClose={() => setVideoModalVisible(false)}
          onSave={addVideo}
        />

        <PremiumPaywall
          visible={paywallVisible}
          onClose={() => setPaywallVisible(false)}
          onPurchaseSuccess={async () => {
            setIsPremium(true);
            setPaywallVisible(false);
            setAiPlannerVisible(true);
            const updatedSettings = { ...appSettings, isPremium: true };
            // Note: need to ensure setAppSettings/storage update logic is consistent
          }}
        />

        <AIPlannerModal
          visible={aiPlannerVisible}
          onClose={() => setAiPlannerVisible(false)}
          onAddTasks={(tasks) => addTodo(tasks)}
          existingTodos={todos.filter(t => !t.completed)}
          currentDate={getLocalDateString()}
          isPremium={isPremium}
          onShowPaywall={() => {
            setAiPlannerVisible(false);
            setPaywallVisible(true);
          }}
        />

        <Modal visible={notificationsModalVisible} animationType="slide" transparent>
          <View style={styles.notifOverlay}>
            <View style={styles.notifSheet}>
              <View style={styles.notifHeader}>
                <Text style={styles.notifTitle}>{t('scheduledNotifications')}</Text>
                <TouchableOpacity onPress={() => setNotificationsModalVisible(false)}>
                  <Feather name="x" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.notifList}>
                {scheduledNotifications.length === 0 ? (
                  <Text style={styles.notifEmpty}>{t('noPendingNotif')}</Text>
                ) : (
                  scheduledNotifications.map((n, idx) => {
                    let timeStr = t('systemNotif');
                    const trigger = n.trigger;
                    
                    // Expo-notifications bazen veriyi trigger içinde, bazen trigger.date/value içinde verir
                    const hour = trigger.hour !== undefined ? trigger.hour : trigger.dateComponents?.hour;
                    const minute = trigger.minute !== undefined ? trigger.minute : trigger.dateComponents?.minute;

                    if (hour !== undefined) {
                      // Takvim/Rutin bildirim
                      timeStr = `${t('everyDay')} ${hour.toString().padStart(2, '0')}:${minute?.toString().padStart(2, '0') || '00'}`;
                    } else if (trigger.type === 'date' || trigger.value || trigger.date) {
                      // Tek seferlik tarih bildirimi
                      const dateVal = trigger.value || trigger.date || trigger.timestamp;
                      if (dateVal) {
                        timeStr = new Date(dateVal).toLocaleString('tr-TR');
                      }
                    } else if (trigger.type === 'timeInterval' || trigger.seconds) {
                      // Saniye bazlı bildirim
                      const secs = trigger.seconds || 0;
                      const targetDate = new Date(Date.now() + secs * 1000);
                      timeStr = targetDate.toLocaleString('tr-TR');
                    }

                    return (
                      <View key={n.identifier || idx} style={styles.notifItem}>
                        <Feather name={hour !== undefined ? "repeat" : "clock"} size={18} color="#4CAF50" />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.notifSubject}>{n.content.title}</Text>
                          <Text style={styles.notifBody}>{n.content.body}</Text>
                          <Text style={styles.notifTime}>{timeStr}</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Selection mode bottom bar */}
        {selectionMode && (
          <View style={styles.selectionBar}>
            <TouchableOpacity style={styles.selectionBarBtn} onPress={selectAllVisible}>
              <Feather name="check-square" size={18} color="#fff" />
              <Text style={styles.selectionBarBtnText}>{t('selectAll')}</Text>
            </TouchableOpacity>
            
            {reflectMediaType === 'text' && (
              <TouchableOpacity style={styles.selectionBarBtn} onPress={copySelected}>
                <Feather name="copy" size={18} color="#fff" />
                <Text style={styles.selectionBarBtnText}>{t('copySelected')}</Text>
              </TouchableOpacity>
            )}

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
  mainTabRow: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
  },
  mainTabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  mainTabBtnActive: {
    backgroundColor: '#333',
  },
  mainTabBtnText: {
    color: '#A0A0A0',
    fontSize: 14,
    fontWeight: '700',
  },
  mainTabBtnTextActive: {
    color: '#fff',
  },
  planSection: {
    paddingBottom: 20,
  },
  aiCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  aiCardPremium: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  aiCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  aiCardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  aiCardSubtitle: {
    color: '#777',
    fontSize: 12,
  },
  todoStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  todoStat: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  todoStatActive: {
    backgroundColor: '#333',
    borderColor: '#4CAF50',
  },
  todoStatValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  todoStatValueActive: {
    color: '#4CAF50',
  },
  todoStatLabel: {
    color: '#A0A0A0',
    fontSize: 12,
    fontWeight: '600',
  },
  todoStatLabelActive: {
    color: '#fff',
  },
  historyBtn: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 80,
  },
  historyBtnText: {
    color: '#A0A0A0',
    fontSize: 11,
    fontWeight: '600',
  },
  completedSection: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingTop: 20,
  },
  completedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  completedTitle: {
    color: '#777',
    fontSize: 14,
    fontWeight: '600',
  },
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
  mediaTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  mediaTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#1E1E1E',
  },
  mediaTypeBtnActive: {
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  mediaTypeBtnText: {
    color: '#777',
    fontSize: 13,
    fontWeight: '600',
  },
  mediaTypeBtnTextActive: {
    color: '#fff',
  },
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
  notifOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  notifSheet: { backgroundColor: '#121212', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '70%', padding: 24 },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  notifTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  notifList: { flex: 1 },
  notifItem: { flexDirection: 'row', backgroundColor: '#1E1E1E', padding: 16, borderRadius: 16, marginBottom: 12, alignItems: 'center' },
  notifSubject: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  notifBody: { color: '#AAA', fontSize: 14, marginTop: 4 },
  notifTime: { color: '#4CAF50', fontSize: 12, fontWeight: 'bold', marginTop: 8 },
  notifEmpty: { color: '#666', textAlign: 'center', marginTop: 100 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerBellBtn: { padding: 8, marginRight: 4 },
  bellBtn: { padding: 8, backgroundColor: 'rgba(76, 175, 80, 0.1)', borderRadius: 12, marginLeft: 10, alignSelf: 'center' },
});
