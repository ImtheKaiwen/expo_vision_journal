import React, { useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useI18n } from '../utils/i18n';

export default function TodoItem({ item, onToggle, onDelete }) {
  const { t } = useI18n();
  const swipeableRef = useRef(null);

  const renderRightActions = () => {
    return (
      <View style={styles.deleteSwipe}>
        <Feather name="trash-2" size={20} color="#fff" />

        <Text style={styles.swipeText}>
          {t('delete')}
        </Text>
      </View>
    );
  };

  const handleToggle = () => {
    swipeableRef.current?.close();
    onToggle(item.id);
  };

  const handleDelete = () => {
    swipeableRef.current?.close();
    onDelete(item.id);
  };

  const renderLeftActions = () => {
    return (
      <View
        style={[
          styles.swipeAction,
          item.completed ? styles.swipeUndo : styles.swipeComplete,
        ]}
      >
        <Feather
          name={item.completed ? 'rotate-ccw' : 'check'}
          size={20}
          color="#fff"
        />

        <Text style={styles.swipeText}>
          {item.completed ? t('undo') : t('markDone')}
        </Text>
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableRightOpen={handleDelete}
      onSwipeableLeftOpen={handleToggle}
      overshootLeft={false}
      overshootRight={false}
      friction={2}
      activeOffsetX={[-10, 10]}
    >
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.contentArea}
          onPress={() => onToggle(item.id)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.checkbox,
              item.completed && styles.checkboxChecked,
            ]}
          >
            {item.completed && (
              <Feather name="check" size={14} color="#000" />
            )}
          </View>

          <Text
            style={[
              styles.text,
              item.completed && styles.textCompleted,
            ]}
          >
            {item.text}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => onDelete(item.id)}
        >
          <Feather name="trash-2" size={18} color="#555" />
        </TouchableOpacity>
      </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },

  contentArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkboxChecked: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },

  text: {
    fontSize: 16,
    color: '#ffffff',
    flex: 1,
  },

  textCompleted: {
    color: '#777',
    textDecorationLine: 'line-through',
  },

  deleteBtn: {
    padding: 4,
    marginLeft: 8,
  },

  swipeAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    marginBottom: 12,
    paddingHorizontal: 24,
    gap: 8,
  },

  swipeComplete: {
    backgroundColor: '#4CAF50',
  },

  swipeUndo: {
    backgroundColor: '#FF9800',
  },

  swipeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  deleteSwipe: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: '#E53935',
    borderRadius: 16,
    marginBottom: 12,
    paddingHorizontal: 24,
    gap: 8,
  }
});