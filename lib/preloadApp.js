import mobileAds from "react-native-google-mobile-ads";

let preloadPromise = null;

export function preloadAppOnce() {
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    try {
      await mobileAds().initialize();
      console.log("[PRELOAD] Ads initialized");
    } catch {}

    // TODO: 필요한 AsyncStorage preload 가능
    // await AsyncStorage.getItem("selectedCountries");

    return true;
  })();

  return preloadPromise;
}
