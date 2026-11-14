package com.trialum.ziivaiskra

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Only private, explicitly opted-in transactional push. Message/pet content is
 * never included in FCM payloads. The app fetches events securely on opening.
 */
class TrialumFirebaseService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        TrialumPush.onNewToken(applicationContext,token)
    }
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        // Foreground delivery of an FCM notification has NO automatic system
        // tray display. Legacy data-only messages carry our UUID reference;
        // notification-only (e.g. Firebase console) messages may not.
        val kind=message.data["kind"]
        if(kind=="trialum_event"){
            val reference=message.data["reference"]
            if(reference!=null) TrialumPush.notifyGeneric(applicationContext,reference)
            else if(message.notification!=null)
                TrialumPush.notifyGeneric(applicationContext,
                    java.util.UUID.randomUUID().toString())
        } else if(kind==null&&message.notification!=null) {
            // Only the explicitly consented and authorized Android app can show
            // this fixed generic text. No sender names or private message text.
            TrialumPush.notifyGeneric(applicationContext,
                java.util.UUID.randomUUID().toString())
        }
    }
}
