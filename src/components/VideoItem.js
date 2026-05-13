import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Modal,
  DeviceEventEmitter,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Video } from 'expo-av';
import * as Sharing from 'expo-sharing';
import * as LocalAuthentication from 'expo-local-authentication';
import { Swipeable } from 'react-native-gesture-handler';
import { useI18n } from '../utils/i18n';

export default function VideoItem({ 
  item, 
  onDelete, 
  onToggleLock,
  selectionMode = false,
  isSelected = false,
  onSelect
}) {
  const { t } = useI18n();
  const [showPlayer, setShowPlayer] = useState(false);
  const swipeableRef = useRef(null);

  const checkAuth = async () => {
    if (!item.locked) return true;
    
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    
    if (!hasHardware || !isEnrolled) return true;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: t('unlockVideo'),
      fallbackLabel: t('usePassword'),
    });
    
    if (result.success) {
      DeviceEventEmitter.emit('SESSION_AUTHENTICATED');
    }
    
    return result.success;
  };

  const handlePlay = async () => {
    if (selectionMode) {
      onSelect();
      return;
    }
    const isAuth = await checkAuth();
    if (!isAuth) return;
    setShowPlayer(true);
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

  const formatTime = (sec) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
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

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={selectionMode ? undefined : renderRightActions}
      renderLeftActions={selectionMode ? undefined : renderLeftActions}
      rightThreshold={40}
      leftThreshold={40}
      enabled={!selectionMode}
    >
      <View style={styles.container}>
        <TouchableOpacity 
          style={[styles.card, selectionMode && isSelected && styles.cardSelected]} 
          onPress={handlePlay} 
          activeOpacity={selectionMode ? 0.7 : 0.8}
        >
          {selectionMode && (
            <View style={styles.checkboxArea}>
              <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                {isSelected && <Feather name="check" size={14} color="#000" />}
              </View>
            </View>
          )}

          <View style={styles.videoIconContainer}>
            <Feather name="video" size={32} color="#fff" />
            {item.locked && !selectionMode && (
              <View style={styles.lockBadge}>
                <Feather name="lock" size={12} color="#000" />
              </View>
            )}
          </View>
          
          <View style={styles.infoArea}>
            <View style={styles.headerRow}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              {!selectionMode && (
                <TouchableOpacity onPress={handleToggleLock}>
                  <Feather name={item.locked ? "lock" : "unlock"} size={16} color={item.locked ? "#FFD700" : "#555"} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.statsRow}>
              <Text style={styles.duration}>{formatTime(item.duration)}</Text>
              <View style={styles.dot} />
              <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
          </View>

          {!selectionMode && (
            <TouchableOpacity style={styles.playCircle} onPress={handlePlay}>
              <Feather name="play" size={20} color="#000" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        <Modal visible={showPlayer} animationType="fade" transparent={false}>
          <View style={styles.fullPlayerContainer}>
            <Video
              source={{ uri: item.uri }}
              style={styles.fullVideo}
              resizeMode="contain"
              useNativeControls
              shouldPlay
            />
            <TouchableOpacity 
              style={styles.closePlayerBtn} 
              onPress={() => setShowPlayer(false)}
            >
              <Feather name="x" size={32} color="#fff" />
            </TouchableOpacity>
          </View>
        </Modal>
      </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 20,
    padding: 12,
    gap: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: '#4CAF50',
  },
  checkboxArea: { marginRight: 0 },
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
  videoIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FFD700',
    borderRadius: 10,
    padding: 4,
  },
  infoArea: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  duration: { color: '#A0A0A0', fontSize: 13 },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#555' },
  date: { color: '#777', fontSize: 13 },
  playCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullPlayerContainer: { flex: 1, backgroundColor: '#000' },
  fullVideo: { flex: 1 },
  closePlayerBtn: {
    position: 'absolute',
    top: 50,
    right: 24,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
  },
  deleteAction: {
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    width: 90,
    borderRadius: 20,
    marginBottom: 16,
    marginLeft: 10,
  },
  shareAction: {
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    width: 90,
    borderRadius: 20,
    marginBottom: 16,
    marginRight: 10,
  },
  swipeLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
});
