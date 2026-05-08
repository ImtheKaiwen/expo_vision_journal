import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  Platform,
  Alert,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { Audio } from 'expo-av';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useI18n } from '../utils/i18n';

export default function AudioRecorderModal({ visible, onClose, onSave }) {
  const { t } = useI18n();
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState('');
  const [audioUri, setAudioUri] = useState(null);
  const [previewSound, setPreviewSound] = useState(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  useEffect(() => {
    return () => {
      if (previewSound) previewSound.unloadAsync();
    };
  }, [previewSound]);

  useEffect(() => {
    let interval;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert(t('error'), t('permissionMicrophone'));
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);
      setAudioUri(null);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert(t('error'), t('audioStartError'));
    }
  };

  const pauseRecording = async () => {
    if (!recording) return;
    try {
      await recording.pauseAsync();
      setIsPaused(true);
    } catch (err) {
      console.error('Failed to pause recording', err);
    }
  };

  const resumeRecording = async () => {
    if (!recording) return;
    try {
      await recording.startAsync();
      setIsPaused(false);
    } catch (err) {
      console.error('Failed to resume recording', err);
    }
  };

  const playPreview = async () => {
    try {
      if (previewSound) {
        const status = await previewSound.getStatusAsync();
        if (isPreviewPlaying) {
          await previewSound.pauseAsync();
          setIsPreviewPlaying(false);
        } else {
          if (status.positionMillis >= status.durationMillis) {
            await previewSound.setPositionAsync(0);
          }
          await previewSound.playAsync();
          setIsPreviewPlaying(true);
        }
      } else {
        if (!audioUri) return;
        
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true }
        );
        setPreviewSound(newSound);
        setIsPreviewPlaying(true);
        
        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            if (status.didJustFinish) {
              setIsPreviewPlaying(false);
            }
          }
        });
      }
    } catch (err) {
      console.error('Preview failed', err);
      Alert.alert(t('error'), t('previewError'));
    }
  };

  const resetRecording = async () => {
    try {
      if (previewSound) {
        await previewSound.unloadAsync();
        setPreviewSound(null);
      }
      if (recording) {
        await recording.stopAndUnloadAsync();
      }
      // If we have a temp file, we could delete it, but let's just reset state
      setAudioUri(null);
      setRecording(null);
      setIsRecording(false);
      setIsPaused(false);
      setIsPreviewPlaying(false);
      setDuration(0);
      setTitle('');
    } catch (err) {
      console.error('Reset failed', err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      setIsRecording(false);
      setIsPaused(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setAudioUri(uri);
      setRecording(null);
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  };

  const handleSave = async () => {
    if (!audioUri) return;
    
    try {
      if (previewSound) {
        await previewSound.unloadAsync();
        setPreviewSound(null);
      }

      // Move file to permanent location
      const fileName = `audio_${Date.now()}.m4a`;
      const dest = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.moveAsync({
        from: audioUri,
        to: dest,
      });

      onSave({
        id: Date.now().toString(),
        title: title || `${t('typeAudio')} - ${new Date().toLocaleDateString()}`,
        uri: dest,
        duration: duration,
        createdAt: new Date().toISOString(),
        locked: false,
      });
      
      resetRecording(); // Reset everything after success
      onClose();
    } catch (err) {
      console.error('Save failed', err);
      Alert.alert(t('error'), t('audioSaveError'));
    }
  };

  const formatTime = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('recordAudio')}</Text>
            <TouchableOpacity onPress={async () => {
              await resetRecording();
              onClose();
            }}>
              <Feather name="x" size={24} color="#A0A0A0" />
            </TouchableOpacity>
          </View>

          <View style={styles.recordArea}>
            <Text style={styles.timer}>{formatTime(duration)}</Text>
            
            {isRecording ? (
              <View style={styles.recordingActions}>
                <TouchableOpacity 
                  style={[styles.recordBtnSecondary, isPaused && styles.recordBtnActiveSmall]} 
                  onPress={isPaused ? resumeRecording : pauseRecording}
                >
                  <Feather name={isPaused ? "play" : "pause"} size={24} color={isPaused ? "#4CAF50" : "#ffffff"} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.recordBtnActive} onPress={stopRecording}>
                  <View style={styles.stopIcon} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.recordBtn} onPress={startRecording}>
                <View style={styles.recordIcon} />
              </TouchableOpacity>
            )}
            
            <Text style={styles.status}>
              {isRecording ? (isPaused ? t('recordingPaused') : t('recording')) : audioUri ? t('recordingFinished') : t('recordAudio')}
            </Text>
          </View>

          {audioUri && (
            <View style={styles.saveArea}>
              <View style={styles.previewActionsRow}>
                <TouchableOpacity 
                  style={[styles.previewPill, isPreviewPlaying && styles.previewPillActive]} 
                  onPress={playPreview}
                >
                  <Feather 
                    name={isPreviewPlaying ? "pause" : "play"} 
                    size={20} 
                    color={isPreviewPlaying ? "#000" : "#4CAF50"} 
                  />
                  <Text style={[styles.previewPillText, isPreviewPlaying && styles.previewPillTextActive]}>
                    {isPreviewPlaying ? t('stop') : t('listen')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.resetPill} onPress={resetRecording}>
                  <Feather name="trash-2" size={18} color="#FF3B30" />
                  <Text style={styles.resetPillText}>{t('delete')}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputWrapper}>
                <Feather name="edit-3" size={18} color="#777" style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.input}
                  placeholder={t('audioPlaceholder')}
                  placeholderTextColor="#555"
                  value={title}
                  onChangeText={setTitle}
                />
              </View>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 50 : 30,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 30,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  recordArea: {
    alignItems: 'center',
    marginBottom: 30,
  },
  timer: {
    fontSize: 48,
    fontWeight: '300',
    color: '#ffffff',
    marginBottom: 20,
    fontVariant: ['tabular-nums'],
  },
  recordBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#444',
  },
  recordBtnActive: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  recordBtnSecondary: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#444',
  },
  recordBtnActiveSmall: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 30,
  },
  recordIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF3B30',
  },
  stopIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  status: {
    color: '#A0A0A0',
    marginTop: 16,
    fontSize: 14,
  },
  saveArea: {
    width: '100%',
    marginTop: 10,
  },
  previewActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
    justifyContent: 'center',
  },
  previewPill: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E1E1E',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  previewPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  previewPillText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  previewPillTextActive: {
    color: '#000',
  },
  resetPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  resetPillText: {
    color: '#FF3B30',
    fontSize: 15,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#222',
  },
  input: {
    flex: 1,
    color: '#fff',
    paddingVertical: 16,
    fontSize: 15,
  },
  saveBtn: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 16,
  },
});
