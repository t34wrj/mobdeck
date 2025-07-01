package com.mobdeck

import android.app.job.JobParameters
import android.app.job.JobService
import android.content.Intent
import android.os.Build
import android.util.Log
import com.facebook.react.ReactApplication
import com.facebook.react.ReactInstanceManager
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Android JobService for background synchronization
 * Works with react-native-background-job to provide reliable background sync
 */
class BackgroundSyncJobService : JobService() {
    
    companion object {
        private const val TAG = "BackgroundSyncJobService"
        private const val SYNC_EVENT = "BackgroundSyncEvent"
    }
    
    private var reactInstanceManager: ReactInstanceManager? = null
    
    override fun onStartJob(params: JobParameters?): Boolean {
        Log.d(TAG, "Background sync job started")
        
        try {
            // Get React instance manager
            val app = application as? ReactApplication
            reactInstanceManager = app?.reactNativeHost?.reactInstanceManager
            
            // Send event to React Native
            reactInstanceManager?.currentReactContext?.let { reactContext ->
                sendEvent(reactContext, SYNC_EVENT, "start")
            }
            
            // Job will be handled by React Native side
            // Return true to indicate job is still running
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start background sync job", e)
            return false
        }
    }
    
    override fun onStopJob(params: JobParameters?): Boolean {
        Log.d(TAG, "Background sync job stopped")
        
        // Send stop event to React Native
        reactInstanceManager?.currentReactContext?.let { reactContext ->
            sendEvent(reactContext, SYNC_EVENT, "stop")
        }
        
        // Return true to reschedule the job
        return true
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