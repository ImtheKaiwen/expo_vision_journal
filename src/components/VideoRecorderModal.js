import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Video } from 'expo-av';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useI18n } from '../utils/i18n';

const { width, height } = Dimensions.get('screen');

export default function VideoRecorderModal({ visible, onClose, onSave }) {
  const { t } = useI18n();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  
  const [isRecording, setIsRecording] = useState(false);
  const [videoUri, setVideoUri] = useState(null);
  const [facing, setFacing] = useState('front');
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState('');
  
  const cameraRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    let interval;
    if (isRecording) {
      interval = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  if (!cameraPermission || !micPermission) {
    return <View />;
  }

  if (!cameraPermission.granted || !micPermission.granted) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.permissionContainer}>
          <Feather name="video" size={64} color="#555" />
          <Text style={styles.permissionText}>{t('permissionCamera')}</Text>
          <TouchableOpacity 
            style={styles.permissionBtn} 
            onPress={() => {
              requestCameraPermission();
              requestMicPermission();
            }}
          >
            <Text style={styles.permissionBtnText}>{t('allowPermission')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={{ marginTop: 20 }}>
            <Text style={{ color: '#aaa' }}>{t('cancel')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  const startRecording = async () => {
    if (cameraRef.current) {
      try {
        setIsRecording(true);
        setDuration(0);
        const video = await cameraRef.current.recordAsync({
          maxDuration: 60,
          quality: '720p',
        });
        setVideoUri(video.uri);
        setIsRecording(false);
      } catch (error) {
        console.error("Recording failed", error);
        setIsRecording(false);
      }
    }
  };

  const stopRecording = async () => {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
      setIsRecording(false);
    }
  };

  const handleSave = async () => {
    if (!videoUri) return;
    try {
      const fileName = `video_${Date.now()}.mp4`;
      const dest = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.moveAsync({ from: videoUri, to: dest });

      onSave({
        id: Date.now().toString(),
        title: title || `Self-Talk - ${new Date().toLocaleDateString()}`,
        uri: dest,
        duration: duration,
        createdAt: new Date().toISOString(),
        locked: false,
      });

      resetAll();
      onClose();
    } catch (error) {
      Alert.alert(t('error'), t('videoSaveError'));
    }
  };

  const resetAll = () => {
    setVideoUri(null);
    setIsRecording(false);
    setDuration(0);
    setTitle('');
  };

  const formatTime = (sec) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      transparent={false}
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <View style={styles.container}>
          {!videoUri ? (
            <>
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing={facing}
                mode="video"
              />
              
              <View style={styles.overlay}>
                <View style={styles.topBar}>
                  <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <Feather name="x" size={28} color="#fff" />
                  </TouchableOpacity>
                  
                  {isRecording && (
                    <View style={styles.timerBadge}>
                      <View style={styles.redDot} />
                      <Text style={styles.timerText}>{formatTime(duration)}</Text>
                    </View>
                  )}
                  
                  {!isRecording ? (
                    <TouchableOpacity 
                      onPress={() => setFacing(facing === 'front' ? 'back' : 'front')}
                      style={styles.closeBtn}
                    >
                      <Feather name="refresh-cw" size={24} color="#fff" />
                    </TouchableOpacity>
                  ) : (
                    <View style={{ width: 44 }} />
                  )}
                </View>

              <View style={styles.bottomBar}>
                <TouchableOpacity
                  onPress={isRecording ? stopRecording : startRecording}
                  style={styles.recordBtnOuter}
                >
                  <View style={[styles.recordBtnInner, isRecording && styles.recordingBtn]} />
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.previewContainer}>
            <Video
              ref={videoRef}
              source={{ uri: videoUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              shouldPlay
              isLooping
              useNativeControls
            />
            
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.previewOverlay}>
                <View style={styles.previewHeader}>
                  <Text style={styles.previewTitle}>{t('preview')}</Text>
                </View>

                {/* TOP: Naming Capsule */}
                <View style={styles.topNamingArea}>
                  <View style={styles.namingWrapper}>
                    <Feather name="feather" size={16} color="rgba(255,255,255,0.6)" style={{ marginRight: 6 }} />
                    <TextInput
                      style={styles.floatingInput}
                      placeholder={t('videoPlaceholder')}
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      value={title}
                      onChangeText={setTitle}
                    />
                    {title.length > 0 && (
                      <TouchableOpacity onPress={() => { setTitle(''); Keyboard.dismiss(); }}>
                        <Feather name="x-circle" size={16} color="rgba(255,255,255,0.4)" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* BOTTOM: Action Buttons */}
                <View style={styles.floatingActions}>
                  <TouchableOpacity 
                    style={[styles.floatBtnRed, { backgroundColor: 'rgba(255, 59, 48, 0.2)', borderWidth: 1, borderColor: '#FF3B30' }]} 
                    onPress={() => { resetAll(); onClose(); }}
                  >
                    <Feather name="trash-2" size={18} color="#FF3B30" />
                    <Text style={[styles.floatBtnText, { color: '#FF3B30' }]}>{t('delete')}</Text>
                  </TouchableOpacity>
 
                  <TouchableOpacity style={styles.floatBtnRed} onPress={resetAll}>
                    <Feather name="rotate-ccw" size={18} color="#fff" />
                    <Text style={styles.floatBtnText}>{t('retry')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.floatBtnGreen} onPress={handleSave}>
                    <Feather name="check" size={18} color="#000" />
                    <Text style={[styles.floatBtnText, { color: '#000' }]}>{t('save')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
</Modal>
  );
}

const styles = StyleSheet.create({
  container: { 
    width: width,
    height: height,
    backgroundColor: '#000',
  },
  overlay: { 
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  topBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  closeBtn: { 
    padding: 10, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    borderRadius: 25,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,0,0,0.3)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    gap: 8,
  },
  redDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF3B30' },
  timerText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  bottomBar: { alignItems: 'center', marginBottom: 60 },
  recordBtnOuter: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordBtnInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#FF3B30',
  },
  recordingBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  permissionContainer: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center', padding: 40 },
  permissionText: { color: '#fff', textAlign: 'center', marginVertical: 20, fontSize: 16, lineHeight: 24 },
  permissionBtn: { backgroundColor: '#4CAF50', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  permissionBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  previewContainer: { flex: 1, backgroundColor: '#000' },
  previewOverlay: { 
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  previewHeader: { 
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.4)', 
    zIndex: 10,
  },
  previewHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  previewHeaderBtnText: {
    color: '#FF3B30',
    fontWeight: '700',
    fontSize: 14,
  },
  previewTitle: { color: '#fff', fontWeight: '800', fontSize: 18, textAlign: 'center', width: '100%' },
  topNamingArea: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 140 : 120,
    left: 20,
    right: 20,
    zIndex: 100,
  },
  floatingActions: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 60 : 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 100,
  },
  floatBtnRed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  floatBtnGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  floatBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  namingWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  floatingInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    padding: 0, // Remove default padding
  },
});
