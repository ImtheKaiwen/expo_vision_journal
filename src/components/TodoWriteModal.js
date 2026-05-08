import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useI18n } from '../utils/i18n';

export default function TodoWriteModal({ visible, onClose, onSave }) {
  const { t } = useI18n();
  const [text, setText] = useState('');

  const handleSave = () => {
    if (text.trim() === '') return;
    const lines = text.split('\n').filter(line => line.trim() !== '');
    onSave(lines);
    setText('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={{ flex: 1 }} onPress={() => { onClose(); Keyboard.dismiss(); }} />
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('addTodo')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color="#A0A0A0" />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder={t('todoPlaceholder')}
            placeholderTextColor="#777"
            autoFocus
            value={text}
            onChangeText={setText}
            multiline
          />
          
          <Text style={styles.hint}>{t('todoBulkHint')}</Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>{t('save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  input: {
    backgroundColor: '#121212',
    borderRadius: 16,
    padding: 16,
    color: '#ffffff',
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  hint: {
    color: '#555',
    fontSize: 12,
    marginBottom: 20,
    marginLeft: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  saveBtn: {
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
  },
  saveBtnText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 16,
  },
});
