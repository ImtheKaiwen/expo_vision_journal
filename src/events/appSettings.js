import { DeviceEventEmitter } from 'react-native';

export const APP_SETTINGS_CHANGED = 'visionjournal-app-settings-changed';

export function emitAppSettingsChanged() {
  DeviceEventEmitter.emit(APP_SETTINGS_CHANGED);
}
