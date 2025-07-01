import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { MainScreenProps } from '../navigation/types';

const SettingsScreen: React.FC<MainScreenProps<'Settings'>> = ({ navigation, route }) => {
  const [isSyncEnabled, setIsSyncEnabled] = React.useState(true);
  const [isNotificationsEnabled, setIsNotificationsEnabled] = React.useState(true);

  const toggleSync = () => setIsSyncEnabled(previousState => !previousState);
  const toggleNotifications = () => setIsNotificationsEnabled(previousState => !previousState);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <View style={styles.setting}>
        <Text style={styles.label}>Enable Background Sync</Text>
        <Switch
          value={isSyncEnabled}
          onValueChange={toggleSync}
        />
      </View>
      <View style={styles.setting}>
        <Text style={styles.label}>Enable Notifications</Text>
        <Switch
          value={isNotificationsEnabled}
          onValueChange={toggleNotifications}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  setting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  label: {
    fontSize: 18,
  },
});

export default SettingsScreen;