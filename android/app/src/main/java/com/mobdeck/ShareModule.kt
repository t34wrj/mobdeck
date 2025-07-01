package com.mobdeck

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments

class ShareModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "ShareModule"
    }

    @ReactMethod
    fun getSharedData(promise: Promise) {
        try {
            val sharedData = MainActivity.sharedData
            if (sharedData != null) {
                val result: WritableMap = Arguments.createMap()
                result.putString("text", sharedData.getString("text"))
                result.putString("subject", sharedData.getString("subject"))
                result.putDouble("timestamp", sharedData.getLong("timestamp").toDouble())
                
                // Clear the shared data after retrieving it
                MainActivity.sharedData = null
                
                promise.resolve(result)
            } else {
                promise.resolve(null)
            }
        } catch (e: Exception) {
            promise.reject("SHARE_ERROR", "Failed to get shared data", e)
        }
    }

    @ReactMethod
    fun clearSharedData(promise: Promise) {
        try {
            MainActivity.sharedData = null
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CLEAR_ERROR", "Failed to clear shared data", e)
        }
    }
}