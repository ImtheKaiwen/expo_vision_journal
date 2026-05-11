import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Sharing from 'expo-sharing';
import * as LocalAuthentication from 'expo-local-authentication';
import { Swipeable } from 'react-native-gesture-handler';
import { useI18n } from '../utils/i18n';

export default function AudioItem({ 
  item, 
  onDelete, 
  onToggleLock,
  selectionMode = false,
  isSelected = false,
  onSelect
}) {
  const { t } = useI18n();
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const swipeableRef = useRef(null);

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const checkAuth = async () => {
    if (!item.locked) return true;
    
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    
    if (!hasHardware || !isEnrolled) return true;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: t('unlockAudio'),
      fallbackLabel: t('usePassword'),
    });
    
    return result.success;
  };

  const playSound = async () => {
    if (selectionMode) {
      onSelect();
      return;
    }

    // Eğer zaten oynatılıyorsa, durdururken şifre sorma
    if (isPlaying && sound) {
      await sound.pauseAsync();
      setIsPlaying(false);
      return;
    }

    const isAuth = await checkAuth();
    if (!isAuth) return;

    if (sound) {
      const status = await sound.getStatusAsync();
      if (status.positionMillis >= status.durationMillis) {
        await sound.setPositionAsync(0);
      }
      await sound.playAsync();
      setIsPlaying(true);
    } else {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: item.uri },
        { shouldPlay: true }
      );
      setSound(newSound);
      setIsPlaying(true);
      
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setPosition(status.positionMillis);
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPosition(0);
          }
        }
      });
    }
  };

  const handleShare = async () => {
    const isAuth = await checkAuth();
    if (!isAuth) {
      swipeableRef.current?.close();
      return;
    }

    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert(t('error'), 'Sharing is not available');
      swipeableRef.current?.close();
      return;
    }
    await Sharing.shareAsync(item.uri);
    swipeableRef.current?.close();
  };

  const handleDelete = async () => {
    const isAuth = await checkAuth();
    if (!isAuth) {
      swipeableRef.current?.close();
      return;
    }
    onDelete(item.id);
    swipeableRef.current?.close();
  };

  const handleToggleLock = async () => {
    const isAuth = await checkAuth();
    if (!isAuth) return;
    onToggleLock(item.id);
  };

  const formatTime = (ms) => {
    const sec = Math.floor(ms / 1000);
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const renderRightActions = () => (
    <TouchableOpacity style={styles.deleteAction} onPress={handleDelete}>
      <Feather name="trash-2" size={24} color="#fff" />
      <Text style={styles.swipeLabel}>{t('delete')}</Text>
    </TouchableOpacity>
  );

  const renderLeftActions = () => (
    <TouchableOpacity style={styles.shareAction} onPress={handleShare}>
      <Feather name="share-2" size={24} color="#fff" />
      <Text style={styles.swipeLabel}>{t('share')}</Text>
    </TouchableOpacity>
  );

  const displayDuration = formatTime(item.duration * 1000);

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={selectionMode ? undefined : renderRightActions}
      renderLeftActions={selectionMode ? undefined : renderLeftActions}
      rightThreshold={40}
      leftThreshold={40}
      enabled={!selectionMode}
    >
      <TouchableOpacity 
        activeOpacity={selectionMode ? 0.7 : 1}
        onPress={selectionMode ? onSelect : undefined}
      >
        <View style={[
          styles.container, 
          selectionMode && isSelected && styles.containerSelected
        ]}>
          {selectionMode && (
            <View style={styles.checkboxArea}>
              <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                {isSelected && <Feather name="check" size={14} color="#000" />}
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.playBtn} onPress={playSound}>
            <Feather name={isPlaying ? "pause" : "play"} size={24} color="#ffffff" />
          </TouchableOpacity>
          
          <View style={styles.content}>
            <View style={styles.headerRow}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              {!selectionMode && (
                <TouchableOpacity onPress={handleToggleLock}>
                  <Feather name={item.locked ? "lock" : "unlock"} size={16} color={item.locked ? "#FFD700" : "#555"} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.meta}>
              <Text style={styles.duration}>{isPlaying ? formatTime(position) : displayDuration}</Text>
              <View style={styles.dot} />
              <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  containerSelected: {
    borderColor: '#4CAF50',
  },
  checkboxArea: { marginRight: 14 },
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
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  duration: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '700',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#555',
    marginHorizontal: 8,
  },
  date: {
    color: '#777',
    fontSize: 12,
  },
  deleteAction: {
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    width: 90,
    borderRadius: 20,
    marginBottom: 12,
    marginLeft: 10,
  },
  shareAction: {
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    width: 90,
    borderRadius: 20,
    marginBottom: 12,
    marginRight: 10,
  },
  swipeLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
});
