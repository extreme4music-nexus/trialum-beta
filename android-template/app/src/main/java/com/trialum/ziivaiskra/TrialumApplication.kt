package com.trialum.ziivaiskra

import android.app.Application
import com.google.firebase.messaging.FirebaseMessaging

/**
 * Cold-start FCM support for users who explicitly opted in earlier.
 * No Firebase setup or token request for players who have not opted in.
 */
class TrialumApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        if(TrialumPush.opted(this) && TrialumPush.prepareFirebase(this)) {
            try {
                FirebaseMessaging.getInstance().isAutoInitEnabled=true
                // Existing tokens may survive upgrades while their server rows do
                // not. Only users who already consented get bounded re-registration.
                TrialumPush.refreshOptedRegistration(this)
            } catch (_: Exception) {}
        }
        TrialumPush.syncRevocation(this)
    }
}
