import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native'; // Ekran her açıldığında veriyi yenilemek için

// Türkçe'de en sık kullanılan ve analizde anlamsız olan bağlaç/edat listesi (Stopwords)
const stopWords = ['bir', 've', 'bu', 'da', 'de', 'için', 'ile', 'çok', 'gibi', 'daha', 'en', 'kadar', 'ama', 'sonra', 'ben', 'bana', 'beni', 'sen', 'onu', 'bunu', 'olan', 'olarak', 'var', 'yok', 'ki', 'ya'];

export default function AnalyticsScreen() {
  const [topWords, setTopWords] = useState([]);
  const [topBigrams, setTopBigrams] = useState([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const isFocused = useIsFocused(); // Bu sayfaya her gelindiğinde tetiklenir

  useEffect(() => {
    if (isFocused) {
      analyzeData();
    }
  }, [isFocused]);

  const analyzeData = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem('@journal_entries');
      if (jsonValue != null) {
        const entries = JSON.parse(jsonValue);
        setTotalEntries(entries.length);
        
        // Tüm günlük metinlerini tek bir büyük metinde birleştir
        let allText = entries.map(entry => entry.text).join(' ');
        
        // Sadece harfleri bırak, küçük harfe çevir (Basit bir NLP temizlik adımı)
        allText = allText.toLocaleLowerCase('tr-TR').replace(/[.,?!;:()'"]/g, '');
        const words = allText.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));

        // 1. Unigram (Tekli Kelime Frekansı) Hesaplama
        const wordCounts = {};
        words.forEach(word => {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        });
        
        const sortedWords = Object.keys(wordCounts)
          .map(key => ({ word: key, count: wordCounts[key] }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5); // En çok geçen 5 kelime
          
        setTopWords(sortedWords);

        // 2. Bigram (İkili Kelime Örüntüsü) Hesaplama
        const bigramCounts = {};
        for (let i = 0; i < words.length - 1; i++) {
          const bigram = `${words[i]} ${words[i+1]}`;
          bigramCounts[bigram] = (bigramCounts[bigram] || 0) + 1;
        }

        const sortedBigrams = Object.keys(bigramCounts)
          .map(key => ({ bigram: key, count: bigramCounts[key] }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5); // En çok geçen 5 ikili

        setTopBigrams(sortedBigrams);
      }
    } catch (e) {
      console.log("Analiz hatası:", e);
    }
  };

  return (
    <View style={styles.pageContainer}>
      <Text style={styles.headerTitle}>Analiz</Text>
      
      <ScrollView showsVerticalScrollIndicator={false}>
        
        <View style={styles.summaryCard}>
          <Feather name="edit-3" size={24} color="#4CAF50" />
          <View>
            <Text style={styles.summaryValue}>{totalEntries}</Text>
            <Text style={styles.summaryLabel}>Toplam Günlük Kaydı</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="bar-chart-2" size={20} color="#9C27B0" />
            <Text style={styles.cardTitle}>En Çok Kullanılan Kelimeler</Text>
          </View>
          {topWords.length > 0 ? (
            topWords.map((item, index) => (
              <View key={index} style={styles.listItem}>
                <Text style={styles.listText}>{item.word}</Text>
                <Text style={styles.listCount}>{item.count} kez</Text>
              </View>
            ))
          ) : (
            <Text style={styles.cardContent}>Henüz yeterli veri yok. Günlük yazdıkça burada analizlerin belirecek.</Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="git-commit" size={20} color="#FF9800" />
            <Text style={styles.cardTitle}>Düşünce Kalıpları (Bigram)</Text>
          </View>
          <Text style={styles.cardSubtitle}>Hangi kelimeden sonra hangisi geliyor?</Text>
          {topBigrams.length > 0 ? (
            topBigrams.map((item, index) => (
              <View key={index} style={styles.listItem}>
                <Text style={styles.listText}>{item.bigram}</Text>
                <Text style={styles.listCount}>{item.count} kez</Text>
              </View>
            ))
          ) : (
            <Text style={styles.cardContent}>Henüz yeterli veri yok.</Text>
          )}
        </View>
        
        <View style={{height: 100}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: { flex: 1, backgroundColor: '#121212', paddingHorizontal: 24, paddingTop: 60 },
  headerTitle: { fontSize: 32, fontWeight: '700', color: '#ffffff', marginBottom: 20 },
  
  summaryCard: { backgroundColor: '#1E1E1E', borderRadius: 20, padding: 20, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  summaryValue: { fontSize: 24, fontWeight: '700', color: '#ffffff' },
  summaryLabel: { fontSize: 14, color: '#A0A0A0' },

  card: { backgroundColor: '#1E1E1E', borderRadius: 20, padding: 20, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff' },
  cardSubtitle: { fontSize: 13, color: '#A0A0A0', marginBottom: 12 },
  cardContent: { fontSize: 15, color: '#D0D0D0', lineHeight: 22 },

  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2A2A2A', padding: 12, borderRadius: 10, marginBottom: 8 },
  listText: { color: '#ffffff', fontSize: 16, fontWeight: '500', textTransform: 'capitalize' },
  listCount: { color: '#4CAF50', fontSize: 14, fontWeight: '600' }
});