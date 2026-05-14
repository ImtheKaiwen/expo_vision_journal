import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, TextInput, Image, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, Pressable, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { analyzeMealImage } from '../services/aiService';
import { addMealLog } from '../storage';
import { getLocalDateString } from '../utils/journalDates';
import { useI18n } from '../utils/i18n';
const { height } = Dimensions.get('window');

export default function MealAddModal({ visible, onClose, onSuccess }) {
  const { t, langCode } = useI18n();
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [image, setImage] = useState(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const cameraRef = useRef(null);

  const handleClose = () => {
    setImage(null);
    setAnalysis(null);
    setNote('');
    setShowCamera(false);
    onClose();
  };

  const takePhoto = async () => {
    if (!permission.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    setShowCamera(true);
  };

  const handleCapture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
      setImage({ uri: photo.uri, base64: photo.base64 });
      setShowCamera(false);
      // Analizi otomatik başlatmıyoruz
    }
  };

  const pickImage = async () => {
    try {
      // Önce galeri izni isteyelim
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('permissionRequired') || 'İzin Gerekli', t('permissionGallery') || 'Galeriden fotoğraf seçebilmek için izin vermen gerekiyor.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImage({ uri: asset.uri, base64: asset.base64 });
        // Analizi otomatik başlatmıyoruz
      }
    } catch (e) {
      console.log('Image Selection Error:', e);
      Alert.alert(t('error'), t('imageSelectError') || 'Fotoğraf seçilemedi.');
    }
  };

  const startAnalysisManual = () => {
    runAnalysis(image?.base64);
  };

  const runAnalysis = async (base64) => {
    if (!base64 && !note) {
      Alert.alert(t('info'), t('mealAnalysisInputError') || 'Lütfen bir fotoğraf seçin veya ne yediğinizi yazın.');
      return;
    }

    setLoading(true);
    try {
      let finalBase64 = base64;
      
      // Eğer görsel varsa küçült
      if (image && image.uri) {
        const manipResult = await ImageManipulator.manipulateAsync(
          image.uri,
          [{ resize: { width: 640 } }],
          { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        finalBase64 = manipResult.base64;
      }

      const res = await analyzeMealImage(finalBase64, note, langCode);
      
      if (res.isFood === false) {
        Alert.alert(t('analysisFailed'), res.errorMessage || t('notFoodError'));
        return;
      } else {
        setAnalysis(res);
      }
    } catch (error) {
      console.error('Meal Analysis Error:', error);
      if (error.message === 'DAILY_LIMIT_REACHED') {
        Alert.alert(t('aiLimitReachedTitle'), t('aiLimitReachedMsg'));
      } else {
        Alert.alert(t('error'), t('mealAnalysisError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!analysis) return;
    await addMealLog({
      ...analysis,
      imageUri: image?.uri || null,
      note,
      date: getLocalDateString(),
      timestamp: new Date().toISOString(),
    });
    onSuccess();
    handleClose();
  };

  if (showCamera) {
    return (
      <Modal visible={true} animationType="slide">
        <CameraView ref={cameraRef} style={styles.camera}>
          <View style={styles.cameraOverlay}>
            <TouchableOpacity style={styles.closeCam} onPress={() => setShowCamera(false)}>
              <Feather name="x" size={30} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.captureBtn} onPress={handleCapture}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
          </View>
        </CameraView>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable 
          style={StyleSheet.absoluteFill} 
          onPress={() => {
            Keyboard.dismiss();
          }} 
        />

        <View style={styles.keyboardView}>
          <View style={[styles.content, { height: !image ? height * 0.5 : height * 0.95 }]}>
              <View style={styles.header}>
                <Text style={styles.title}>{t('addMeal')}</Text>
                <TouchableOpacity onPress={handleClose}>
                  <Feather name="x" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.scrollArea} 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false} 
                keyboardShouldPersistTaps="handled"
              >
                {!image ? (
                  <View style={styles.selectionAreaContainer}>
                    <View style={styles.selectionArea}>
                      <TouchableOpacity style={styles.selectBtn} onPress={takePhoto}>
                        <Feather name="camera" size={32} color="#fff" />
                        <Text style={styles.selectBtnText}>{t('takePhoto')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.selectBtn} onPress={pickImage}>
                        <Feather name="image" size={32} color="#fff" />
                        <Text style={styles.selectBtnText}>{t('selectFromGallery')}</Text>
                      </TouchableOpacity>
                    </View>
                    
                    <View style={styles.dividerContainer}>
                      <View style={styles.divider} />
                      <Text style={styles.dividerText}>{t('or')}</Text>
                      <View style={styles.divider} />
                    </View>

                    <TouchableOpacity 
                      style={styles.textOnlyBtn} 
                      onPress={() => setImage({ uri: null, base64: null })}
                    >
                      <Feather name="edit-3" size={20} color="#fff" />
                      <Text style={styles.selectBtnText}>{t('analyzeByTextOnly')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.previewArea}>
                    {image.uri && (
                      <>
                        <Image source={{ uri: image.uri }} style={styles.previewImg} />
                        <TouchableOpacity style={styles.changeImg} onPress={() => setImage(null)}>
                          <Text style={styles.changeImgText}>{t('changePhoto')}</Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {!image.uri && (
                      <TouchableOpacity style={styles.changeImg} onPress={() => setImage(null)}>
                        <Text style={styles.changeImgText}>{t('backToPhoto')}</Text>
                      </TouchableOpacity>
                    )}

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>{t('noteOptional')}</Text>
                    <TextInput
                      style={styles.noteInput}
                      placeholder={t('notePlaceholder')}
                      placeholderTextColor="#666"
                      value={note}
                      onChangeText={setNote}
                      multiline
                      textAlignVertical="top"
                      showsVerticalScrollIndicator={true}
                    />
                    </View>

                    {!analysis && !loading && (
                      <TouchableOpacity 
                        style={[
                          styles.analyzeBtn, 
                          (!image && !note?.trim()) && { opacity: 0.5 }
                        ]} 
                        onPress={startAnalysisManual}
                        disabled={!image && !note?.trim()}
                      >
                        <Feather name="cpu" size={20} color="#fff" />
                        <Text style={styles.analyzeBtnText}>{t('analyzeMeal')}</Text>
                      </TouchableOpacity>
                    )}

                    {loading ? (
                      <View style={styles.loadingWrapper}>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={styles.loadingText}>{t('aiAnalyzing')}</Text>
                      </View>
                    ) : analysis ? (
                      <View style={styles.analysisArea}>
                        <Text style={styles.analysisTitle}>{analysis.name}</Text>
                        <View style={styles.statsGrid}>
                          <Stat label={t('calories')} value={`${analysis.calories} kcal`} />
                          <Stat label={t('protein')} value={`${analysis.protein}g`} />
                          <Stat label={t('carbs')} value={`${analysis.carbs}g`} />
                          <Stat label={t('fat')} value={`${analysis.fat}g`} />
                        </View>
                      </View>
                    ) : null}

                    {analysis && !loading && (
                      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                        <Text style={styles.saveBtnText}>{t('addToJournal')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </View>
    </Modal>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.8)', 
    justifyContent: 'flex-end' 
  },
  keyboardView: { 
    width: '100%', 
    justifyContent: 'flex-end' 
  },
  content: { 
    backgroundColor: '#1E1E1E', 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: 24, 
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
    width: '100%',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  selectionAreaContainer: { 
    width: '100%', 
    gap: 16, 
    marginTop: 20,
    paddingBottom: 20
  },
  selectionArea: { flexDirection: 'row', gap: 16 },
  selectBtn: { flex: 1, height: 120, backgroundColor: '#252525', borderRadius: 20, justifyContent: 'center', alignItems: 'center', gap: 10 },
  textOnlyBtn: { width: '100%', height: 60, backgroundColor: '#252525', borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 10, gap: 10 },
  divider: { flex: 1, height: 1, backgroundColor: '#333' },
  dividerText: { color: '#666', fontSize: 12, fontWeight: 'bold' },
  selectBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  previewArea: { alignItems: 'center' },
  previewImg: { width: '100%', height: 200, borderRadius: 20, marginBottom: 16 },
  changeImg: { marginBottom: 20 },
  changeImgText: { color: '#666', fontSize: 14 },
  inputGroup: { width: '100%', marginBottom: 20 },
  label: { color: '#A0A0A0', fontSize: 14, marginBottom: 8 },
  noteInput: { 
    backgroundColor: '#252525', 
    borderRadius: 16, 
    padding: 16, 
    color: '#fff', 
    fontSize: 16, 
    height: 120, // Sabit yükseklik
    marginBottom: 20 
  },
  loadingArea: { padding: 20, alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 10 },
  analysisArea: { width: '100%', backgroundColor: '#252525', padding: 20, borderRadius: 24, marginBottom: 20 },
  analysisTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statItem: { width: '48%', backgroundColor: '#1E1E1E', padding: 12, borderRadius: 16 },
  statLabel: { color: '#666', fontSize: 12, marginBottom: 4 },
  statValue: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#fff', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 10, width: '100%' },
  saveBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  analyzeBtn: { backgroundColor: '#4CAF50', height: 56, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 10, width: '100%' },
  analyzeBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 40 },
  closeCam: { position: 'absolute', top: 60, right: 20 },
  captureBtn: { width: 80, height: 80, borderRadius: 40, borderWidth: 6, borderColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
});
