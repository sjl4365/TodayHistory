// notification.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, Switch, Alert
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL_ID = 'default';
const REMINDER_TYPE = 'DAILY_PRE_SCHEDULED';
const PRE_SCHEDULE_DAYS = 14;
const TOP_UP_THRESHOLD = 5;

export default function Notification() {
  const [isNotificationOn, setIsNotificationOn] = useState(false);
  const [date, setDate] = useState(new Date());
  const [savedTime, setSavedTime] = useState(null);
  const [scheduledIds, setScheduledIds] = useState([]); 

  useEffect(() => {
    requestPermissions();
    ensureAndroidChannel();
  }, []);


  const requestPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Notification permission is required to use this feature.');
    }
  };

  async function ensureAndroidChannel() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: true,
      });
    }
  }

  const handleTimeChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      if (event.type === 'set' && selectedDate) setDate(selectedDate);
    } else {
      if (selectedDate) setDate(selectedDate);
    }
  };

  async function listOurReminders() {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return all.filter(n => n?.content?.data?.type === REMINDER_TYPE);
  }

  async function cancelAllOurReminders() {
    const ours = await listOurReminders();
    await Promise.all(
      ours.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
  }

  async function scheduleForNextNDays(notificationTime, days = PRE_SCHEDULE_DAYS) {
    const ids = [];
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const fire = new Date();
      fire.setDate(fire.getDate() + i);
      fire.setHours(notificationTime.getHours(), notificationTime.getMinutes(), 0, 0);

      if (fire.getTime() <= now.getTime() + 1000) continue;

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Daily Reminder 📱',
          body: "It's time for your daily check-in!",
          sound: true,
          data: { type: REMINDER_TYPE },
        },
        trigger: fire, 
      });

      ids.push(id);
    }
    return ids;
  }

  async function topUpIfLow(notificationTime /* Date */) {
    const ours = await listOurReminders();
    if (ours.length < TOP_UP_THRESHOLD) {
      await cancelAllOurReminders();
      const newIds = await scheduleForNextNDays(notificationTime, PRE_SCHEDULE_DAYS);
      setScheduledIds(newIds);
    }
  }

  const scheduleNotification = async (notificationTime) => {
    try {
      await ensureAndroidChannel();

      await cancelAllOurReminders();
      const ids = await scheduleForNextNDays(notificationTime, PRE_SCHEDULE_DAYS);
      return ids;
    } catch (e) {
      console.error('노티 스케줄 실패:', e);
      Alert.alert('Error', 'Failed to schedule notification.');
      return null;
    }
  };

  const cancelNotification = async () => {
    try {
      if (scheduledIds.length) {
        await Promise.all(
          scheduledIds.map(id => Notifications.cancelScheduledNotificationAsync(id))
        );
        setScheduledIds([]);
      }
      await cancelAllOurReminders();

      setSavedTime(null);
    } catch (error) {
      console.error('노티피케이션 취소 실패:', error);
    }
  };
  const handleSaveTime = async () => {
    if (!isNotificationOn) return;

    const ids = await scheduleNotification(date);
    if (ids && ids.length) {
      setScheduledIds(ids);
      setSavedTime(date);
      const timeString = date.toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit', hour12: false
      });
      Alert.alert('Notification Scheduled! ✅', `Pre-scheduled for ${ids.length} days at ${timeString}.`);
    } else {
      Alert.alert('Schedule Failed', 'No notifications were scheduled.');
    }
  };

  const handleToggleNotification = async (value) => {
    setIsNotificationOn(value);
    if (!value) {
      await cancelNotification();
      Alert.alert('Notification Disabled', 'Daily notifications have been turned off.');
    } else {
      await topUpIfLow(savedTime ?? date);
    }
  };

  useEffect(() => {
    if (isNotificationOn) {
      topUpIfLow(savedTime ?? date);
    }
  }, [isNotificationOn]);

  // UI
  const NotificationItem = ({ title, value, onToggle, selectedDate, onTimeChange }) => (
    <View style={styles.notificationSection}>
      <View style={styles.notificationHeader}>
        <Text style={styles.notificationTitle}>{title}</Text>
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: "#767577", true: "#8B5CF6" }}
          thumbColor={value ? "#ffffff" : "#f4f3f4"}
        />
      </View>

      {isNotificationOn && (
        <View style={styles.timePickerContainer}>
          <View style={styles.timePickerWrapper}>
            <DateTimePicker
              value={selectedDate}
              mode="time"
              is24Hour={true}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onTimeChange}
              style={styles.timePicker}
              textColor={Platform.OS === 'ios' ? '#000000' : undefined}
            />
          </View>

          <TouchableOpacity style={styles.doneButton} onPress={handleSaveTime}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <NotificationItem
          title="Allow Notification"
          value={isNotificationOn}
          onToggle={handleToggleNotification}
          selectedDate={date}
          onTimeChange={handleTimeChange}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  section: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 0,
    marginBottom: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'grey',
  },
  notificationSection: { paddingHorizontal: 10, paddingVertical: 10 },
  notificationHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, minHeight: 50,
  },
  notificationTitle: { fontSize: 16, color: 'white', flex: 1 },
  timePickerContainer: { marginTop: 15, position: 'relative' },
  timePickerWrapper: {
    backgroundColor: 'white', borderRadius: 12,
    padding: Platform.OS === 'ios' ? 10 : 5, alignItems: 'center',
    ...Platform.select({
      ios: { height: 200, justifyContent: 'center' },
      android: { minHeight: 60, justifyContent: 'center' },
    }),
  },
  timePicker: {
    ...Platform.select({
      ios: { height: 180, width: '100%' },
      android: { height: 50, width: 150 },
    }),
  },
  doneButton: {
    position: 'absolute', bottom: Platform.OS === 'ios' ? 15 : 10, right: 15,
    backgroundColor: '#8B5CF6', paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 8, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 3.84,
  },
  doneButtonText: { color: 'white', fontSize: 14, fontWeight: '600' },
});
