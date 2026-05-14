import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useI18n } from '../utils/i18n';

const { width } = Dimensions.get('window');

export default function WeightUpdateModal({ visible, currentWeight, onUpdate, onSkip }) {
  const { t } = useI18n();
  const [weight, setWeight] = useState(currentWeight?.toString() || '');

  const handleUpdate = () => {
    const val = parseFloat(weight);
    if (!isNaN(val) && val > 0) {
      onUpdate(val);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <View style={styles.container}>
              <View style={styles.iconCircle}>
                <Feather name="trending-down" size={32} color="#fff" />
              </View>

              <Text style={styles.title}>{t('weightUpdateTitle')}</Text>
              <Text style={styles.subtitle}>{t('weightUpdateMsg')}</Text>

              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  placeholder="0.0"
                  placeholderTextColor="#666"
                  autoFocus
                />
                <Text style={styles.unit}>kg</Text>
              </View>

              <TouchableOpacity style={styles.updateBtn} onPress={handleUpdate}>
                <Text style={styles.updateBtnText}>{t('updateWeight')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
                <Text style={styles.skipBtnText}>{t('skipForNow')}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  keyboardView: {
    width: '100%',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1E1E1E',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#A0A0A0',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 40,
    borderBottomWidth: 2,
    borderBottomColor: '#4CAF50',
    paddingBottom: 8,
  },
  input: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    minWidth: 100,
  },
  unit: {
    fontSize: 24,
    color: '#666',
    marginLeft: 8,
    fontWeight: '600',
  },
  updateBtn: {
    width: '100%',
    height: 56,
    backgroundColor: '#fff',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  updateBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  skipBtn: {
    width: '100%',
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipBtnText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
});
