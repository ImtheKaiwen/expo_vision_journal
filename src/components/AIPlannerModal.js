import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useI18n } from '../utils/i18n';

import { generateAIPlan, transcribeAudio } from '../services/aiService';

const { width, height } = Dimensions.get('window');

export default function AIPlannerModal({ 
  visible, 
  onClose, 
  onAddTasks, 
  existingTodos = [], 
  currentDate = '',
  isPremium = false,
  onShowPaywall
}) {
  const { t, langCode } = useI18n();
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedTasks, setSuggestedTasks] = useState([]);
  const [stagedTasks, setStagedTasks] = useState([]);
  const [recording, setRecording] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const getCategoryColor = (cat) => {
    switch(cat) {
      case 'morning': return '#FFB300';
      case 'afternoon': return '#03A9F4';
      case 'evening': return '#9C27B0';
      default: return '#777';
    }
  };

  const detectCategory = (text) => {
    const lower = text.toLowerCase().trim();
    if (lower.startsWith('sabah') || lower.startsWith('morning')) return 'morning';
    if (lower.startsWith('öğle') || lower.startsWith('öğlen') || lower.startsWith('afternoon')) return 'afternoon';
    if (lower.startsWith('akşam') || lower.startsWith('evening')) return 'evening';
    return 'general';
  };

  const stripCategoryKeyword = (text, category) => {
    if (category === 'general') return text;
    const lower = text.toLowerCase().trim();
    let keyword = '';
    if (category === 'morning') keyword = lower.startsWith('sabah') ? 'sabah' : 'morning';
    else if (category === 'afternoon') {
      if (lower.startsWith('öğle')) keyword = 'öğle';
      else if (lower.startsWith('öğlen')) keyword = 'öğlen';
      else keyword = 'afternoon';
    }
    else if (category === 'evening') keyword = lower.startsWith('akşam') ? 'akşam' : 'evening';

    if (keyword && lower.startsWith(keyword)) {
      const rest = text.substring(keyword.length).trim();
      return rest || text; // If nothing left, keep original
    }
    return text;
  };

  const handleInputChange = (text) => {
    // If user enters a newline, add current text to staged tasks
    if (text.endsWith('\n')) {
      const taskText = text.trim();
      if (taskText) {
        const category = detectCategory(taskText);
        const cleanText = stripCategoryKeyword(taskText, category);

        setStagedTasks(prev => [...prev, { 
          id: Date.now().toString(), 
          text: cleanText, 
          time: null,
          category,
          selected: true 
        }]);
        setInputText('');
      }
    } else {
      setInputText(text);
    }
  };

  const handleGenerate = async () => {
    if (!isPremium) {
      onShowPaywall();
      return;
    }
    if (!inputText.trim()) return;

    Keyboard.dismiss();
    setIsLoading(true);

    try {
      const tasks = await generateAIPlan(inputText, existingTodos, currentDate, langCode);
      const formattedTasks = tasks.map((task, index) => ({
        id: Date.now().toString() + index,
        text: task.text,
        time: task.time,
        category: task.category || 'general',
        isTimeAmbiguous: task.isTimeAmbiguous,
        selected: true
      }));
      setSuggestedTasks(formattedTasks);
    } catch (error) {
      Alert.alert(t('error'), t('errorAI'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualAdd = () => {
    if (!inputText.trim()) return;
    const lines = inputText.split('\n').filter(l => l.trim() !== '');
    const newTasks = lines.map((l, index) => {
      const category = detectCategory(l);
      const cleanText = stripCategoryKeyword(l, category);

      return { 
        id: (Date.now() + index).toString(),
        text: cleanText, 
        time: null,
        category,
        selected: true
      };
    });
    setStagedTasks(prev => [...prev, ...newTasks]);
    setInputText('');
  };

  const removeStagedTask = (id) => {
    setStagedTasks(prev => prev.filter(t => t.id !== id));
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.LOW_QUALITY
      );
      setRecording(recording);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setRecording(null);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    
    setIsTranscribing(true);
    try {
      const text = await transcribeAudio(uri);
      setInputText(prev => prev + (prev ? ' ' : '') + text);
    } catch (error) {
      console.error('Voice Error:', error);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleVoicePress = () => {
    if (!isPremium) {
      onShowPaywall();
      return;
    }
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const toggleTask = (id) => {
    setSuggestedTasks(prev =>
      prev.map(t => t.id === id ? { ...t, selected: !t.selected } : t)
    );
  };

  const setAmPm = (id, type) => {
    setSuggestedTasks(prev => prev.map(t => {
      if (t.id === id && t.time) {
        const [h, m] = t.time.split(':');
        let hours = parseInt(h, 10);
        if (type === 'PM' && hours < 12) hours += 12;
        if (type === 'AM' && hours >= 12) hours -= 12;
        const newTime = `${hours.toString().padStart(2, '0')}:${m}`;
        return { ...t, time: newTime, isTimeAmbiguous: false };
      }
      return t;
    }));
  };

  const handleConfirm = () => {
    const suggested = suggestedTasks.filter(t => t.selected).map(t => ({
      text: t.text,
      time: t.time,
      category: t.category || 'general'
    }));
    const staged = stagedTasks.filter(t => t.selected).map(t => ({
      text: t.text,
      time: t.time,
      category: t.category || 'general'
    }));
    
    const finalTasks = [...staged, ...suggested];
    if (finalTasks.length === 0) return;

    onAddTasks(finalTasks);
    setInputText('');
    setSuggestedTasks([]);
    setStagedTasks([]);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <TouchableOpacity
            style={{ flex: 1, width: '100%' }}
            activeOpacity={1}
            onPress={() => { Keyboard.dismiss(); onClose(); }}
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? -60 : 0}
            style={{ width: '100%' }}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.sheet}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollContent}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.header}>
                    <View style={styles.aiBadge}>
                      <Feather name="cpu" size={14} color="#4CAF50" />
                      <Text style={styles.aiBadgeText}>{t('aiPlanner')}</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                      <Feather name="x" size={24} color="#555" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.title}>{t('tabPlan')}</Text>
                  <Text style={styles.subtitle}>{t('aiPlannerSubtitle')}</Text>

                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      multiline
                      placeholder={t('aiPlannerPlaceholder')}
                      placeholderTextColor="#555"
                      value={inputText}
                      onChangeText={handleInputChange}
                      scrollEnabled={true}
                      blurOnSubmit={false}
                    />
                    {inputText.length > 0 && !isLoading && (
                      <TouchableOpacity 
                        style={styles.clearBtn} 
                        onPress={() => setInputText('')}
                      >
                        <Feather name="x-circle" size={18} color="#666" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.manualHint}>{t('aiPlannerHint')}</Text>

                  <View style={styles.actionRow}>
                    {isPremium && (
                      <TouchableOpacity
                        style={[
                          styles.generateBtn,
                          (!inputText.trim() || isLoading) && styles.generateBtnDisabled,
                          (isLoading) && { backgroundColor: '#4CAF50' }
                        ]}
                        onPress={handleGenerate}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <View style={styles.loadingWrapper}>
                            <ActivityIndicator color="#fff" size="small" />
                            <Text style={[styles.generateBtnText, { color: '#fff', marginLeft: 8 }]}>{t('planning')}</Text>
                          </View>
                        ) : (
                          <>
                            <Text style={styles.generateBtnText}>{t('planWithAI')}</Text>
                            <Feather name="zap" size={16} color="#000" />
                          </>
                        )}
                      </TouchableOpacity>
                    )}
 
                    <TouchableOpacity 
                      style={[styles.manualAddBtn, !inputText.trim() && styles.manualAddBtnDisabled]}
                      onPress={handleManualAdd}
                      disabled={!inputText.trim()}
                    >
                      <Feather name="plus" size={18} color="#fff" style={{ marginRight: 4 }} />
                      <Text style={styles.manualAddBtnText}>{t('add')}</Text>
                    </TouchableOpacity>

                    {isPremium && (
                      <TouchableOpacity 
                        style={[
                          styles.voiceBtn, 
                          (recording) && styles.voiceBtnActive,
                        ]}
                        onPress={handleVoicePress}
                        disabled={isTranscribing}
                      >
                        {isTranscribing ? (
                          <ActivityIndicator color="#4CAF50" size="small" />
                        ) : (
                          <View style={styles.voiceBtnContent}>
                            <Feather name="mic" size={22} color={recording ? "#fff" : "#4CAF50"} />
                          </View>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>

                  {recording && (
                    <Text style={styles.voiceStatus}>{t('listening')}</Text>
                  )}
                  {isTranscribing && (
                    <Text style={styles.voiceStatus}>{t('transcribing')}</Text>
                  )}

                  {stagedTasks.length > 0 && (
                    <View style={styles.resultArea}>
                      <Text style={styles.resultTitle}>{t('todoTitle')} ({stagedTasks.length})</Text>
                      <View style={styles.taskList}>
                        {stagedTasks.map(task => (
                          <View key={task.id} style={styles.taskItem}>
                            <View style={[styles.checkbox, styles.checkboxChecked]}>
                              <Feather name="check" size={14} color="#fff" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.taskText}>{task.text}</Text>
                              {task.category && (
                                <Text style={[styles.categoryBadge, { color: getCategoryColor(task.category) }]}>
                                  {t(task.category)}
                                </Text>
                              )}
                            </View>
                            <TouchableOpacity onPress={() => removeStagedTask(task.id)} style={styles.removeBtn}>
                              <Feather name="trash-2" size={16} color="#FF4B4B" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {suggestedTasks.length > 0 && (
                    <View style={styles.resultArea}>
                      <Text style={styles.resultTitle}>{t('suggestedTasks')}</Text>
                      <View style={styles.taskList}>
                        {suggestedTasks.map(task => (
                          <TouchableOpacity
                            key={task.id}
                            style={styles.taskItem}
                            onPress={() => toggleTask(task.id)}
                          >
                            <View style={[styles.checkbox, task.selected && styles.checkboxChecked]}>
                              {task.selected && <Feather name="check" size={14} color="#fff" />}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.taskText, !task.selected && styles.taskTextDisabled]}>
                                {task.text}
                              </Text>
                              {task.category && (
                                <Text style={[styles.categoryBadge, { color: getCategoryColor(task.category) }]}>
                                  {t(task.category)}
                                </Text>
                              )}
                              {task.time && (
                                <View style={styles.timeBadgeRow}>
                                  <View style={styles.timeBadge}>
                                    <Feather name="clock" size={10} color="#4CAF50" />
                                    <Text style={styles.timeText}>{t('timer')}: {task.time}</Text>
                                  </View>
                                  {task.isTimeAmbiguous && (
                                    <View style={styles.ampmRow}>
                                      <TouchableOpacity onPress={() => setAmPm(task.id, 'AM')} style={styles.ampmBtn}>
                                        <Text style={styles.ampmText}>{t('morning')}</Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity onPress={() => setAmPm(task.id, 'PM')} style={styles.ampmBtn}>
                                        <Text style={styles.ampmText}>{t('evening')}</Text>
                                      </TouchableOpacity>
                                    </View>
                                  )}
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                  {(suggestedTasks.length > 0 || stagedTasks.length > 0) && (
                    <TouchableOpacity 
                      style={styles.confirmBtn} 
                      onPress={handleConfirm}
                    >
                      <Text style={styles.confirmBtnText}>
                        {t('addToMyList')} ({suggestedTasks.filter(t => t.selected).length + stagedTasks.length})
                      </Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    minHeight: height * 0.7,
    maxHeight: height * 0.9,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  closeBtn: {
    padding: 4,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  aiBadgeText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: 'bold',
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  subtitle: {
    color: '#777',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  inputWrapper: {
    backgroundColor: '#1E1E1E',
    borderRadius: 20,
    padding: 16,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  input: {
    color: '#fff',
    fontSize: 17,
    maxHeight: 180,
    textAlignVertical: 'top',
    paddingTop: 0,
    paddingRight: 40,
  },
  manualHint: {
    color: '#4CAF50',
    fontSize: 11,
    marginTop: 10,
    marginLeft: 4,
    opacity: 0.8,
    fontWeight: '600',
  },
  clearBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    alignItems: 'center',
  },
  generateBtn: {
    backgroundColor: '#4CAF50',
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flex: 2,
  },
  generateBtnDisabled: {
    backgroundColor: '#2A2A2A',
    opacity: 0.5,
  },
  voiceBtnDisabled: {
    opacity: 0.5,
    backgroundColor: '#1A1A1A',
  },
  generateBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: 'bold',
  },
  manualAddBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  manualAddBtnDisabled: {
    opacity: 0.3,
  },
  manualAddBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  voiceBtn: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtn: {
    padding: 8,
    backgroundColor: 'rgba(255, 75, 75, 0.1)',
    borderRadius: 10,
  },
  voiceBtnContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceBtnActive: {
    backgroundColor: '#FF4B4B',
  },
  lockIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  loadingWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceStatus: {
    color: '#4CAF50',
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  resultArea: {
    marginTop: 32,
  },
  resultTitle: {
    color: '#A0A0A0',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  taskList: {
    gap: 12,
  },
  taskItem: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 18,
    alignItems: 'center',
    gap: 14,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4CAF50',
  },
  taskText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  categoryBadge: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  taskTextDisabled: {
    color: '#555',
    textDecorationLine: 'line-through',
  },
  timeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  timeText: {
    color: '#4CAF50',
    fontSize: 11,
    fontWeight: '700',
  },
  ampmRow: {
    flexDirection: 'row',
    gap: 6,
  },
  ampmBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  ampmText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  confirmBtn: {
    marginTop: 24,
    marginBottom: 20,
    height: 60,
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
});
