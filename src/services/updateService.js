import Constants from 'expo-constants';
import { Platform } from 'react-native';

const VERSION_URL = 'https://raw.githubusercontent.com/ImtheKaiwen/expo_vision_journal/main/version.json';

/**
 * Compares two semantic version strings.
 * Returns:
 *  1 if v1 > v2
 * -1 if v1 < v2
 *  0 if v1 == v2
 */
const compareVersions = (v1, v2) => {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
};

export const checkForUpdate = async () => {
  try {
    const localVersion = Constants.expoConfig?.version || '1.0.0';
    console.log('[UpdateService] Local Version:', localVersion);

    const response = await fetch(`${VERSION_URL}?t=${Date.now()}`); // Prevent caching
    if (!response.ok) {
      console.warn('[UpdateService] Failed to fetch version info');
      return { updateRequired: false };
    }

    const data = await response.json();
    const { minRequiredVersion, latestVersion, iosUrl, androidUrl } = data;

    console.log('[UpdateService] Remote Min Version:', minRequiredVersion);
    
    const comparison = compareVersions(localVersion, minRequiredVersion);
    const updateRequired = comparison === -1;

    return {
      updateRequired,
      latestVersion,
      storeUrl: Platform.OS === 'ios' ? iosUrl : androidUrl,
      localVersion
    };
  } catch (error) {
    console.error('[UpdateService] Error:', error);
    return { updateRequired: false };
  }
};
