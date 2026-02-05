// lib/preloadApp.js
import mobileAds from "react-native-google-mobile-ads";

let preloadPromise = null;

export function preloadAppOnce() {
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    try {
      await mobileAds().initialize();
      console.log("[PRELOAD] Ads initialized");
    } catch (e) {
      console.log("[PRELOAD] Ads init failed", e);
    }
    return true;
  })();

  return preloadPromise;
}
