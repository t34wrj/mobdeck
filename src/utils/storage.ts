import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@user_preferences';

export const saveUserPreferences = async preferences => {
  try {
    const jsonValue = JSON.stringify(preferences);
    await AsyncStorage.setItem(STORAGE_KEY, jsonValue);
  } catch (e) {
    console.error('Failed to save user preferences:', e);
  }
};

export const getUserPreferences = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error('Failed to fetch user preferences:', e);
    return null;
  }
};
