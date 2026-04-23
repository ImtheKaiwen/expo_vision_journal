import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useI18n } from '../utils/i18n';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function JournalWriteModal({ visible, onClose, onSave }) {
  const { t } = useI18n();
  const [text, setText] = useState('');

  const handleSave = () => {
    if (text.trim().length === 0) return;
    onSave(text);
    setText('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); onClose(); }}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.container}
            >
              <View style={styles.sheet}>
                <View style={styles.handle} />
                <View style={styles.header}>
                  <Text style={styles.title}>{t('whatHappened')}</Text>
                  <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <Feather name="x" size={24} color="#A0A0A0" />
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.input}
                  multiline
                  placeholder={t('journalPlaceholder')}
                  placeholderTextColor="#555"
                  autoFocus
                  value={text}
                  onChangeText={setText}
                  textAlignVertical="top"
                />

                <View style={styles.footer}>
                  <TouchableOpacity 
                    style={[styles.clearBtn, { opacity: text.trim().length > 0 ? 1 : 0 }]} 
                    onPress={() => setText('')}
                    disabled={text.trim().length === 0}
                  >
                    <Feather name="trash-2" size={20} color="#F44336" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.saveBtn, text.trim().length === 0 && styles.saveBtnDisabled]} 
                    onPress={handleSave}
                    disabled={text.trim().length === 0}
                  >
                    <Feather name="check" size={20} color={text.trim().length === 0 ? "#555" : "#000"} />
                    <Text style={[styles.saveBtnText, text.trim().length === 0 && { color: '#555' }]}>{t('save')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    width: '100%',
  },
  sheet: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingTop: 12,
    minHeight: SCREEN_HEIGHT * 0.5,
    maxHeight: SCREEN_HEIGHT * 0.9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  input: {
    flex: 1,
    backgroundColor: '#121212',
    color: '#fff',
    borderRadius: 20,
    padding: 20,
    fontSize: 16,
    minHeight: 150,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  clearBtn: {
    padding: 12,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderRadius: 14,
  },
  saveBtn: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  saveBtnDisabled: {
    backgroundColor: '#333',
  },
  saveBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});
