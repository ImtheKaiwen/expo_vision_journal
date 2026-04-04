import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, TextInput, ScrollView, Keyboard, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';

const { width } = Dimensions.get('window');

export default function JournalScreen() {
  const [entry, setEntry] = useState('');
  const [savedEntries, setSavedEntries] = useState([]);
  const [filterText, setFilterText] = useState('');
  const swipeableRefs = useRef(new Map());

  useEffect(() => { loadEntries(); }, []);

  const loadEntries = async () => {
    const jsonValue = await AsyncStorage.getItem('@journal_entries');
    if (jsonValue != null) setSavedEntries(JSON.parse(jsonValue));
  };

  const updateStreak = async () => {
    const today = new Date().toLocaleDateString('tr-TR');
    const streakData = await AsyncStorage.getItem('@streak_info');
    let streak = streakData ? JSON.parse(streakData) : { count: 0, lastDate: null };
    if (streak.lastDate === today) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('tr-TR');
    if (streak.lastDate === yesterdayStr) streak.count += 1;
    else streak.count = 1;
    streak.lastDate = today;
    await AsyncStorage.setItem('@streak_info', JSON.stringify(streak));
  };

  const saveEntry = async () => {
    if (entry.trim() === '') return;
    const newEntry = { id: Date.now().toString(), text: entry, date: new Date().toLocaleDateString('tr-TR') };
    const updatedEntries = [newEntry, ...savedEntries];
    await AsyncStorage.setItem('@journal_entries', JSON.stringify(updatedEntries));
    setSavedEntries(updatedEntries);
    await updateStreak();
    setEntry(''); 
    Keyboard.dismiss(); 
  };

  const deleteEntry = (id) => {
    Alert.alert("Sil", "Bu günlüğü silmek istediğine emin misin?", [
      { text: "İptal", style: "cancel", onPress: () => swipeableRefs.current.get(id)?.close() },
      { text: "Sil", style: "destructive", onPress: async () => {
          const updatedEntries = savedEntries.filter(item => item.id !== id);
          setSavedEntries(updatedEntries);
          await AsyncStorage.setItem('@journal_entries', JSON.stringify(updatedEntries));
      }}
    ]);
  };

  const copyEntry = async (text, id) => {
    await Clipboard.setStringAsync(text);
    Alert.alert("Kopyalandı", "Metin panoya alındı.");
    swipeableRefs.current.get(id)?.close();
  };

  const renderRightActions = () => (
    <View style={styles.deleteAction}><Feather name="trash-2" size={24} color="#fff" /></View>
  );

  const renderLeftActions = () => (
    <View style={styles.copyAction}><Feather name="copy" size={24} color="#fff" /></View>
  );

  const filteredEntries = savedEntries.filter(item => 
    item.date.includes(filterText) || item.text.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1, backgroundColor: '#121212'}}>
      <View style={styles.pageContainer}>
        <Text style={styles.headerTitle}>Günlük</Text>
        
        <View style={styles.filterBar}>
          <Feather name="search" size={16} color="#555" />
          <TextInput 
            style={styles.filterInput} placeholder="Tarih veya kelime ile ara..."
            placeholderTextColor="#555" value={filterText} onChangeText={setFilterText}
          />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{flex: 1}} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bugün Neler Oldu?</Text>
            <View style={styles.textAreaWrapper}>
              <TextInput style={styles.textArea} multiline={true} placeholder="Düşüncelerini buraya yaz..." placeholderTextColor="#555" value={entry} onChangeText={setEntry} />
            </View>
            <TouchableOpacity style={styles.actionButton} onPress={saveEntry}>
              <Feather name="check" size={18} color="#000" />
              <Text style={styles.actionButtonText}>Kaydet</Text>
            </TouchableOpacity>
          </View>

          {filteredEntries.map((item) => (
            <Swipeable 
              key={item.id}
              ref={(ref) => swipeableRefs.current.set(item.id, ref)}
              renderRightActions={renderRightActions}
              rightThreshold={width / 2.5} 
              onSwipeableRightOpen={() => deleteEntry(item.id)} 
              renderLeftActions={renderLeftActions}
              leftThreshold={width / 2.5} 
              onSwipeableLeftOpen={() => copyEntry(item.text, item.id)}
            >
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Feather name="calendar" size={14} color="#A0A0A0" />
                  <Text style={styles.dateLabel}>{item.date}</Text>
                </View>
                <Text style={styles.cardContent}>{item.text}</Text>
              </View>
            </Swipeable>
          ))}
          <View style={{height: 100}} /> 
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pageContainer: { flex: 1, paddingHorizontal: 24, paddingTop: 60 },
  headerTitle: { fontSize: 32, fontWeight: '700', color: '#ffffff', marginBottom: 20 },
  filterBar: { flexDirection: 'row', backgroundColor: '#1E1E1E', borderRadius: 12, padding: 10, marginBottom: 20, alignItems: 'center', gap: 10 },
  filterInput: { color: '#ffffff', flex: 1, fontSize: 14 },
  card: { backgroundColor: '#1E1E1E', borderRadius: 20, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#ffffff', marginBottom: 10 },
  textAreaWrapper: { backgroundColor: '#121212', borderRadius: 12, padding: 12, minHeight: 120 },
  textArea: { color: '#ffffff', fontSize: 15, textAlignVertical: 'top' },
  actionButton: { flexDirection: 'row', backgroundColor: '#ffffff', paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 },
  actionButtonText: { color: '#000000', fontWeight: '600' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  dateLabel: { color: '#A0A0A0', fontSize: 12 },
  cardContent: { fontSize: 15, color: '#D0D0D0', lineHeight: 22 },
  
  // BURASI DEĞİŞTİ: Sabit 100 piksel genişlik ile ekrana tam oturacak
  deleteAction: { backgroundColor: '#F44336', justifyContent: 'center', alignItems: 'center', width: 100, borderRadius: 20, marginBottom: 16, marginLeft: 15 },
  copyAction: { backgroundColor: '#2196F3', justifyContent: 'center', alignItems: 'center', width: 100, borderRadius: 20, marginBottom: 16, marginRight: 15 }
});