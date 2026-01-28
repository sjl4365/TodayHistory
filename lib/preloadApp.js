import mobileAds from "react-native-google-mobile-ads";

let preloadPromise = null;

export function preloadAppOnce() {
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    try {
      await mobileAds().initialize();
      console.log("[PRELOAD] Ads initialized");
    } catch {}

    // await AsyncStorage.getItem("selectedCountries");

    return true;
  })();

  return preloadPromise;
}
