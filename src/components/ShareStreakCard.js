import React from 'react';
import { StyleSheet, Text, View, Dimensions, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const CARD_SIZE = width * 0.9;

export default function ShareStreakCard({ streak, userName, type = 'streak', t }) {
  const displayName = userName?.trim() || t('defaultTraveler');
  
  let dynamicText = '';
  if (type === 'invite') {
    dynamicText = t('inviteCardText');
  } else {
    if (streak >= 30) dynamicText = t('streakText30');
    else if (streak >= 10) dynamicText = t('streakText10');
    else if (streak >= 2) dynamicText = t('streakText2to9').replace('{{streak}}', streak);
    else dynamicText = t('streakText1');
  }

  return (
    <View style={styles.container}>
      <View style={[styles.card, type === 'invite' && styles.cardInvite]}>
        
        <View style={styles.header}>
          <Image 
            source={require('../../assets/icon.png')} 
            style={styles.logo}
          />
          <Text style={styles.appName}>VisionJournal</Text>
        </View>

        <View style={styles.content}>
          {type === 'streak' ? (
            <View style={styles.streakWrapper}>
               <View style={styles.streakCircle}>
                  <Feather name="zap" size={40} color="#FFD700" />
                  <Text style={styles.streakValue}>{streak}</Text>
               </View>
               <Text style={styles.streakLabel}>{t('currStreak')}</Text>
            </View>
          ) : (
            <View style={styles.inviteIconWrapper}>
               <Feather name="users" size={50} color="#FFD700" />
            </View>
          )}
          
          <View style={styles.textArea}>
            <Text style={styles.dynamicMsg}>"{dynamicText}"</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.userBadge}>
            <Feather name="user" size={10} color="#FFF" />
            <Text style={styles.userLabel}>{displayName}</Text>
          </View>
          <Text style={styles.subLabel}>
            {type === 'invite' ? t('inviteSubtitle') : t('shareCardSub')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    backgroundColor: '#161616',
    borderRadius: 44,
    padding: 28,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    overflow: 'hidden',
  },
  cardInvite: {
    borderColor: '#FFD700',
    borderWidth: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  appName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  streakWrapper: {
    alignItems: 'center',
  },
  streakCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#000',
    borderWidth: 3,
    borderColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    marginBottom: 10,
  },
  streakValue: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
  },
  streakLabel: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  inviteIconWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  textArea: {
    marginTop: 15,
    paddingHorizontal: 15,
  },
  dynamicMsg: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    alignItems: 'center',
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 5,
    marginBottom: 5,
  },
  userLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  subLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '500',
  },
});

