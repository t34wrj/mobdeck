package com.mobdeck

import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity

class ShareActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Handle the share intent
        handleShareIntent(intent)
        
        // Close this activity and open the main app
        finish()
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        intent?.let { handleShareIntent(it) }
        finish()
    }

    private fun handleShareIntent(intent: Intent) {
        try {
            if (intent.action == Intent.ACTION_SEND && intent.type?.startsWith("text/") == true) {
                val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
                val sharedSubject = intent.getStringExtra(Intent.EXTRA_SUBJECT)
                
                if (sharedText != null) {
                    Log.d("ShareActivity", "Received shared text: $sharedText")
                    
                    // Create intent to launch main activity with shared data
                    val mainIntent = Intent(this, MainActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                        putExtra("SHARED_TEXT", sharedText)
                        putExtra("SHARED_SUBJECT", sharedSubject)
                        putExtra("SHARE_ACTION", true)
                    }
                    
                    startActivity(mainIntent)
                } else {
                    Log.w("ShareActivity", "No text content found in share intent")
                    // Just open the main app without shared data
                    openMainApp()
                }
            } else {
                Log.w("ShareActivity", "Unsupported share intent: ${intent.action}, type: ${intent.type}")
                openMainApp()
            }
        } catch (e: Exception) {
            Log.e("ShareActivity", "Error handling share intent", e)
            openMainApp()
        }
    }

    private fun openMainApp() {
        val mainIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        startActivity(mainIntent)
    }
}