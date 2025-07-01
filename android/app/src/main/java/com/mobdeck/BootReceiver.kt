package com.mobdeck

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.facebook.react.ReactApplication
import com.facebook.react.ReactInstanceManager
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Boot receiver to restart background sync after device reboot
 */
class BootReceiver : BroadcastReceiver() {
    
    companion object {
        private const val TAG = "BootReceiver"
        private const val BOOT_EVENT = "DeviceBootCompleted"
    }
    
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            "android.intent.action.QUICKBOOT_POWERON" -> {
                Log.d(TAG, "Device boot completed, notifying React Native")
                handleBootCompleted(context)
            }
        }
    }
    
    private fun handleBootCompleted(context: Context) {
        try {
            // Try to get React instance manager when app starts
            val app = context.applicationContext as? ReactApplication
            val reactInstanceManager = app?.reactNativeHost?.reactInstanceManager
            
            // If React Native is running, send event
            reactInstanceManager?.currentReactContext?.let { reactContext ->
                sendEvent(reactContext, BOOT_EVENT, "boot_completed")
            }
            
            Log.d(TAG, "Boot event sent to React Native")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to handle boot completed", e)
        }
    }
    
    /**
     * Send event to React Native JavaScript
     */
    private fun sendEvent(reactContext: ReactContext, eventName: String, params: Any?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
}