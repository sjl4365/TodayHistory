// notification.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Switch,
  Alert
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function Notification() {
  const [isNotificationOn, setIsNotificationOn] = useState(false);
  const [date, setDate] = useState(new Date());
  const [savedTime, setSavedTime] = useState(null);

  const handleTimeChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      if (event.type === 'set' && selectedDate) {
        setDate(selectedDate);
      }
    } else {
      if (selectedDate) {
        setDate(selectedDate);
      }
    }
  };

  const handleSaveTime = () => {
    if (isNotificationOn) {
      setSavedTime(date);
      Alert.alert('Notification is set.');
    }
  };

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

          <TouchableOpacity 
            style={styles.doneButton}
            onPress={handleSaveTime}
          >
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
          onToggle={setIsNotificationOn}
          selectedDate={date}
          onTimeChange={handleTimeChange}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  section: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 0,
    marginBottom: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'grey',
  },
  notificationSection: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    minHeight: 50,
  },
  notificationTitle: {
    fontSize: 16,
    color: 'white',
    flex: 1,
  },
  timePickerContainer: {
    marginTop: 15,
    position: 'relative',
  },
  timePickerWrapper: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: Platform.OS === 'ios' ? 10 : 5,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        height: 200,
        justifyContent: 'center',
      },
      android: {
        minHeight: 60,
        justifyContent: 'center',
      },
    }),
  },
  timePicker: {
    ...Platform.select({
      ios: {
        height: 180,
        width: '100%',
      },
      android: {
        height: 50,
        width: 150,
      },
    }),
  },

  doneButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 15 : 10,
    right: 15,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  doneButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  }
});