package com.mobdeck

import android.content.Intent
import android.os.Bundle
import android.util.Log
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  companion object {
    var sharedData: Bundle? = null
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "mobdeck"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    handleSharedIntent(intent)
  }

  override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    intent?.let { handleSharedIntent(it) }
  }

  private fun handleSharedIntent(intent: Intent) {
    if (intent.getBooleanExtra("SHARE_ACTION", false)) {
      val sharedText = intent.getStringExtra("SHARED_TEXT")
      val sharedSubject = intent.getStringExtra("SHARED_SUBJECT")
      
      if (sharedText != null) {
        Log.d("MainActivity", "Handling shared content: $sharedText")
        
        // Store shared data for React Native to access
        sharedData = Bundle().apply {
          putString("text", sharedText)
          putString("subject", sharedSubject)
          putLong("timestamp", System.currentTimeMillis())
        }
      }
    }
  }
}
