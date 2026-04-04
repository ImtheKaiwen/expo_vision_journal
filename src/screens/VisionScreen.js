import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Alert, Keyboard, Modal, RefreshControl, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { Swipeable } from 'react-native-gesture-handler';

const { width } = Dimensions.get('window');

export default function VisionScreen() {
  const [streakCount, setStreakCount] = useState(0);
  const [visions, setVisions] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const isFocused = useIsFocused();
  const swipeableRefs = useRef(new Map());

  useEffect(() => { if (isFocused) loadData(); }, [isFocused]);

  const loadData = async () => {
    const streakData = await AsyncStorage.getItem('@streak_info');
    if (streakData) setStreakCount(JSON.parse(streakData).count);
    const savedVisions = await AsyncStorage.getItem('@vision_notes');
    if (savedVisions) setVisions(JSON.parse(savedVisions));
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      setIsModalVisible(true);
    }, 500);
  };

  const saveVision = async () => {
    if (newTitle.trim() === '' || newContent.trim() === '') return Alert.alert('Hata', 'Başlık ve içerik boş olamaz.');
    const newVision = { id: Date.now().toString(), title: newTitle, content: newContent };
    const updatedVisions = [newVision, ...visions];
    setVisions(updatedVisions);
    await AsyncStorage.setItem('@vision_notes', JSON.stringify(updatedVisions));
    setNewTitle(''); setNewContent(''); setIsModalVisible(false); Keyboard.dismiss();
  };

  const deleteVision = (id) => {
    Alert.alert("Sil", "Bu vizyonu silmek istiyor musun?", [
      { text: "İptal", style: "cancel", onPress: () => swipeableRefs.current.get(id)?.close() },
      { text: "Sil", style: "destructive", onPress: async () => {
          const updated = visions.filter(v => v.id !== id);
          setVisions(updated);
          await AsyncStorage.setItem('@vision_notes', JSON.stringify(updated));
      }}
    ]);
  };

  const testNotification = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus !== 'granted') return Alert.alert('Hata', 'Bildirim izni vermen gerekiyor.');
    }
    
    await Notifications.scheduleNotificationAsync({
      content: { title: "Test Başarılı! 🚀", body: "Bildirim sistemin saat gibi çalışıyor şıpşıp portakal." },
      trigger: { seconds: 2 },
    });
    Alert.alert("Ayarlandı", "Hemen uygulamayı alta al, 2 saniye içinde düşecek!");
  };

  const renderRightActions = () => (
    <View style={styles.deleteAction}><Feather name="trash-2" size={24} color="#fff" /></View>
  );

  return (
    <View style={styles.pageContainer}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Günaydın.</Text>
        <TouchableOpacity onPress={testNotification} style={styles.testBtn}>
          <Feather name="bell" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.streakBadge}>
        <Feather name="zap" size={16} color="#FFD700" />
        <Text style={styles.streakText}>{streakCount} Gündür Seridesin</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" title="Yeni vizyon eklemek için bırak..." titleColor="#A0A0A0" />}>
        {visions.map(item => (
          <Swipeable 
            key={item.id}
            ref={(ref) => swipeableRefs.current.set(item.id, ref)}
            renderRightActions={renderRightActions}
            rightThreshold={width / 2.5} // Ekranın ortasına yaklaşınca tetiklenir
            onSwipeableRightOpen={() => deleteVision(item.id)}
          >
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Feather name="star" size={20} color="#4CAF50" />
                <Text style={styles.cardTitle}>{item.title}</Text>
              </View>
              <Text style={styles.cardContent}>{item.content}</Text>
            </View>
          </Swipeable>
        ))}
        {visions.length === 0 && <Text style={{color: '#777', textAlign: 'center', marginTop: 20}}>Eklemek için ekranı aşağı kaydır.</Text>}
        <View style={{height: 100}} />
      </ScrollView>

      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={{flex: 1}} onPress={() => { setIsModalVisible(false); Keyboard.dismiss(); }} />
          <View style={styles.addCard}>
            <Text style={{color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 20}}>Yeni Vizyon</Text>
            <TextInput 
              style={styles.input} placeholder="Başlık (Örn: Yeni Hedef)" placeholderTextColor="#777"
              value={newTitle} onChangeText={setNewTitle}
            />
            <TextInput 
              style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]} multiline
              placeholder="Kendine ne söylemek istersin?" placeholderTextColor="#777"
              value={newContent} onChangeText={setNewContent}
            />
            <View style={styles.addActions}>
              <TouchableOpacity style={[styles.btn, {backgroundColor: '#333'}]} onPress={() => { setIsModalVisible(false); Keyboard.dismiss(); }}>
                <Text style={styles.btnTextWhite}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={saveVision}>
                <Text style={styles.btnTextBlack}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: { flex: 1, backgroundColor: '#121212', paddingHorizontal: 24, paddingTop: 60 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerTitle: { fontSize: 32, fontWeight: '700', color: '#ffffff' },
  testBtn: { backgroundColor: '#1E1E1E', padding: 12, borderRadius: 16 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1E1E', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, alignSelf: 'flex-start', gap: 8, marginBottom: 32 },
  streakText: { fontSize: 14, color: '#FFD700', fontWeight: '600' },
  card: { backgroundColor: '#1E1E1E', borderRadius: 24, padding: 20, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff', flexShrink: 1 },
  cardContent: { fontSize: 15, color: '#D0D0D0', lineHeight: 22 },
  
  // BURASI DEĞİŞTİ: Artık %100 değil, sadece 100 piksel genişliğinde şık bir kare.
  deleteAction: { backgroundColor: '#F44336', justifyContent: 'center', alignItems: 'center', width: 100, borderRadius: 24, marginBottom: 16, marginLeft: 15 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  addCard: { backgroundColor: '#1E1E1E', padding: 24, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 50 },
  input: { backgroundColor: '#121212', color: '#fff', padding: 16, borderRadius: 12, marginBottom: 16, fontSize: 15 },
  addActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  btn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, backgroundColor: '#fff' },
  btnTextWhite: { color: '#fff', fontWeight: '600' },
  btnTextBlack: { color: '#000', fontWeight: '600' }
});