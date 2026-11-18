package com.trialum.ziivaiskra

import android.Manifest
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * FCM is optional. No registration/network until explicit user action.
 * The FCM token never touches the WebView, local world, JSON backups or logs.
 */
internal class TrialumPush(
    private val activity: Activity,
    private val dispatch: (JSONObject) -> Unit
) {
    private var generation=0
    private var wantsPush=false
    private fun event(kind: String, message: String) = dispatch(
        JSONObject().put("kind", kind).put("message", message)
    )
    private fun prepare(): Boolean = prepareFirebase(activity)
    fun status(): String = when {
        !configured(activity) -> "unavailable"
        opted(activity) && !notificationChannelEnabled(activity) -> "blocked"
        opted(activity) -> "enabled"
        else -> "off"
    }
    fun enable() {
        if (!configured(activity)) { event("unavailable", "FCM не е конфигуриран во ова APK."); return }
        if (SocialCredentialVault.read(activity).isEmpty()) {
            event("error", "Прво создај социјален профил."); return
        }
        if (Build.VERSION.SDK_INT >= 33 && activity.checkSelfPermission(
                Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            activity.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_CODE)
            return
        }
        ensureNotificationChannel(activity)
        if (!notificationChannelEnabled(activity)) {
            event("blocked","Каналот ТРИАЛУМ пријатели е исклучен во Android Settings.")
            return
        }
        begin()
    }
    fun permissionResult(requestCode: Int, grants: IntArray) {
        if (requestCode != REQUEST_CODE) return
        if (grants.isNotEmpty() && grants.all { it == PackageManager.PERMISSION_GRANTED }) {
            ensureNotificationChannel(activity)
            if(notificationChannelEnabled(activity))begin()
            else event("blocked","Каналот ТРИАЛУМ пријатели е исклучен во Android Settings.")
        } else event("error", "Известувањата се исклучени. Пораките остануваат во играта.")
    }
    private fun begin() {
        wantsPush=true
        val attempt=++generation
        try {
            if (!prepare()) { wantsPush=false;event("unavailable", "FCM не е достапен."); return }
            val messaging=FirebaseMessaging.getInstance()
            messaging.isAutoInitEnabled = true
            messaging.token.addOnSuccessListener { token ->
                worker.execute {
                    val ok=registration(activity.applicationContext, "POST", token)
                    activity.runOnUiThread {
                        if(attempt!=generation){
                            // A stale registration can arrive AFTER an opt-out DELETE.
                            // Revoke it again unless a newer enable attempt wants FCM.
                            if(ok && !wantsPush){
                                prefs(activity).edit().putBoolean(REVOKE,true).apply()
                                syncRevocation(activity.applicationContext)
                            }
                            return@runOnUiThread
                        }
                        if (ok) {
                            prefs(activity).edit().putBoolean(ENABLED,true).putBoolean(REVOKE,false)
                                .putLong(LAST_SYNC,System.currentTimeMillis()).apply()
                            event("enabled","Известувањата се вклучени.")
                        } else {
                            wantsPush=false
                            prefs(activity).edit().putBoolean(REVOKE,true).apply()
                            syncRevocation(activity.applicationContext)
                            messaging.isAutoInitEnabled = false
                            messaging.deleteToken()
                            event("error","Не успеа регистрацијата. Пробај подоцна.")
                        }
                    }
                }
            }.addOnFailureListener {
                if(attempt==generation)wantsPush=false
                messaging.isAutoInitEnabled = false
                event("error","FCM не успеа да добие токен.")
            }
        } catch (_: Exception) { event("error","FCM не е достапен на уредот.") }
    }
    fun disable() {
        wantsPush=false
        generation++
        val context=activity.applicationContext
        // Stop displaying immediately, even with no network.
        prefs(context).edit().putBoolean(ENABLED,false).putBoolean(REVOKE,true).apply()
        try {
            if(prepare()){
                FirebaseMessaging.getInstance().isAutoInitEnabled=false
                FirebaseMessaging.getInstance().deleteToken()
            }
        } catch (_: Exception) {}
        syncRevocation(context)
        event("disabled","Известувањата се исклучени. Пораките остануваат достапни.")
    }
    companion object {
        const val REQUEST_CODE=1567
        private const val CHANNEL="trialum_friends_optin"
        private const val LAST_SYNC="last_registered_at"
        private const val RESYNC_INTERVAL=6L*60*60*1000
        fun ensureNotificationChannel(c: Context) {
            if(Build.VERSION.SDK_INT>=26){
                val manager=c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.createNotificationChannel(NotificationChannel(
                    CHANNEL,"ТРИАЛУМ пријатели",NotificationManager.IMPORTANCE_DEFAULT))
            }
        }
        // Deterministic, local-only system notification probe. No server, FCM,
        // tokens or fake inbox event: the owner can test the exact Friends
        // channel independently from delivery. Trigger only via user tap.
        fun testLocalNotification(c: Context): String {
            if (!configured(c)) return "unavailable"
            if (!opted(c)) return "off"
            if (Build.VERSION.SDK_INT >= 33 &&
                c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) !=
                PackageManager.PERMISSION_GRANTED) return "blocked"
            return try {
                ensureNotificationChannel(c)
                if (!notificationChannelEnabled(c)) return "blocked"
                val intent=Intent(c,MainActivity::class.java).apply {
                    flags=Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val pending=PendingIntent.getActivity(c,2,intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                val n=NotificationCompat.Builder(c,CHANNEL)
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setContentTitle("ТРИАЛУМ · Android тест")
                    .setContentText("Пробно известување. Не е примена нова порака.")
                    .setContentIntent(pending)
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                    .build()
                val manager=c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.notify(17027,n)
                "posted"
            }catch (_:SecurityException){"blocked"}
             catch (_:Exception){"error"}
        }
        fun notificationChannelEnabled(c: Context): Boolean {
            val manager=c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if(!manager.areNotificationsEnabled())return false
            if(Build.VERSION.SDK_INT>=26){
                val channel=manager.getNotificationChannel(CHANNEL)
                if(channel!=null&&channel.importance==NotificationManager.IMPORTANCE_NONE)return false
            }
            return true
        }
        fun prepareFirebase(c: Context): Boolean {
            if(!configured(c))return false
            return try {
                if(FirebaseApp.getApps(c).isEmpty()){
                    val options=FirebaseOptions.Builder()
                        .setApplicationId(c.getString(R.string.trialum_firebase_app_id))
                        .setGcmSenderId(c.getString(R.string.trialum_firebase_sender_id))
                        .setProjectId(c.getString(R.string.trialum_firebase_project_id))
                        .setApiKey(c.getString(R.string.trialum_firebase_api_key))
                        .build()
                    FirebaseApp.initializeApp(c,options)
                }
                FirebaseApp.getApps(c).isNotEmpty()
            }catch (_: Exception){false}
        }

        private const val PREFS="trialum_push_v1"
        private const val ENABLED="explicit_consent"
        private const val REVOKE="revoke_pending"
        private val worker=Executors.newSingleThreadExecutor()
        private fun prefs(c: Context)=c.getSharedPreferences(PREFS,Context.MODE_PRIVATE)
        fun opted(c: Context)=prefs(c).getBoolean(ENABLED,false) && SocialCredentialVault.read(c).isNotEmpty()
        fun configured(c: Context): Boolean {
            val api=c.getString(R.string.trialum_social_api_url)
            return api.matches(Regex("^https://[A-Za-z0-9.-]+(?::443)?$")) &&
                c.getString(R.string.trialum_firebase_app_id).matches(Regex("^1:[0-9]+:android:[0-9a-fA-F]+$")) &&
                c.getString(R.string.trialum_firebase_sender_id).matches(Regex("^[0-9]+$")) &&
                c.getString(R.string.trialum_firebase_project_id).isNotBlank() &&
                c.getString(R.string.trialum_firebase_api_key).isNotBlank()
        }
        /** Network call happens only after opted-in or pending revocation. */
        private fun registration(c: Context,method: String,token: String=""): Boolean {
            val api=c.getString(R.string.trialum_social_api_url)
            val credential=SocialCredentialVault.read(c)
            if(!configured(c)||credential.isEmpty())return false
            var connection: HttpURLConnection?=null
            return try {
                connection=URL(api+"/v1/messages/push").openConnection() as HttpURLConnection
                connection.connectTimeout=7000;connection.readTimeout=7000
                connection.instanceFollowRedirects=false
                connection.requestMethod=method
                connection.setRequestProperty("Authorization","Bearer "+credential)
                connection.setRequestProperty("Cache-Control","no-store")
                if(method=="POST") {
                    connection.doOutput=true
                    connection.setRequestProperty("Content-Type","application/json")
                    val bytes=JSONObject().put("consent",true).put("token",token)
                        .toString().toByteArray(Charsets.UTF_8)
                    connection.outputStream.use { it.write(bytes) }
                }
                connection.responseCode in 200..299
            }catch (_: Exception) {false}
            finally {connection?.disconnect()}
        }
        fun onNewToken(c: Context,token: String) {
            if(opted(c)&&configured(c)&&token.length in 64..4096)
                worker.execute {
                    if(!opted(c))return@execute
                    val ok=registration(c,"POST",token)
                    if(ok && opted(c))
                        prefs(c).edit().putLong(LAST_SYNC,System.currentTimeMillis()).apply()
                    else if(ok)syncRevocation(c)
                }
        }
        /**
         * After a signed app update/server token-table reset, a persistent FCM
         * token may not rotate and onNewToken will never fire. Only for players
         * who already opted in: re-register on cold start, at most every 6h.
         * Never put a token into JS, logs, backups or unconsented network calls.
         */
        fun refreshOptedRegistration(c: Context) {
            if(!opted(c)||!configured(c))return
            ensureNotificationChannel(c)
            if(!notificationChannelEnabled(c))return
            val now=System.currentTimeMillis()
            val last=prefs(c).getLong(LAST_SYNC,0)
            if(last>0 && now>=last && now-last<RESYNC_INTERVAL)return
            try {
                if(!prepareFirebase(c))return
                FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                    if(!opted(c))return@addOnSuccessListener
                    worker.execute {
                        if(!opted(c))return@execute
                        val ok=registration(c,"POST",token)
                        if(ok && opted(c))
                            prefs(c).edit().putLong(LAST_SYNC,System.currentTimeMillis()).apply()
                        else if(ok)syncRevocation(c)
                    }
                }
            }catch (_:Exception){}
        }
        fun syncRevocation(c: Context) {
            if(!prefs(c).getBoolean(REVOKE,false))return
            // Deleting the social account cascades the push row; no session remains.
            if(SocialCredentialVault.read(c).isEmpty()){
                prefs(c).edit().putBoolean(REVOKE,false).apply()
                return
            }
            worker.execute {
                if(registration(c,"DELETE")){
                    prefs(c).edit().putBoolean(REVOKE,false).apply()
                }
            }
        }
        fun notifyGeneric(c: Context,reference: String) {
            if(!opted(c)||!Regex("^[a-fA-F0-9-]{36}$").matches(reference))return
            if(Build.VERSION.SDK_INT>=33 &&
               c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return
            ensureNotificationChannel(c)
            if(!notificationChannelEnabled(c))return
            val manager=c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val channelId=CHANNEL
            val intent=Intent(c,MainActivity::class.java).apply {
                flags=Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pending=PendingIntent.getActivity(c,0,intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            val n=NotificationCompat.Builder(c,channelId)
                // A monochrome status-bar icon, unlike an adaptive launcher mipmap.
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("ТРИАЛУМ")
                .setContentText("Имаш ново известување во играта.")
                .setContentIntent(pending)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .build()
            manager.notify(reference.hashCode(),n)
        }
    }
}
