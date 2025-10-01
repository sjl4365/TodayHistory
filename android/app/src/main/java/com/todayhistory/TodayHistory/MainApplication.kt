// android/app/src/main/java/com/todayhistory/TodayHistory/MainApplication.kt
package com.todayhistory.TodayHistory

import android.app.Application
import android.content.res.Configuration
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.PackageList
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader
import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
    ReactNativeHostWrapper(
      this,
      object : DefaultReactNativeHost(this) {
        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG
        override fun getPackages(): List<ReactPackage> = PackageList(this).packages
        // Expo 관리형 진입점
        override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"
        override fun isNewArchEnabled(): Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override fun isHermesEnabled(): Boolean = BuildConfig.IS_HERMES_ENABLED
      }
    )

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, /* native exopackage */ false)

    // ✅ Expo/RN 0.7x 호환: 기존 템플릿 API
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      DefaultNewArchitectureEntryPoint.load()
    }

    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
