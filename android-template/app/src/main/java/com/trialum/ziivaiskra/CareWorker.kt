package com.trialum.ziivaiskra

import android.Manifest
import android.app.NotificationChannel
import android.app.Notification
import android.media.RingtoneManager
import android.media.AudioAttributes
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/** Offline reminder checks from the last state snapshot. WorkManager is not real-time. */
class CareWorker(context: Context, params: WorkerParameters): Worker(context, params) {
    override fun doWork(): Result {
        val prefs=applicationContext.getSharedPreferences("trialum",Context.MODE_PRIVATE)
        val saved=prefs.getString("snapshot",null) ?: return Result.success()
        val data=try { JSONObject(saved) } catch (_:Exception){return Result.success()}
        val language=if(data.optString("language","en")=="mk") "mk" else "en"
        fun text(mk:String,en:String)=if(language=="mk") mk else en
        val updated=data.optLong("updatedAt",System.currentTimeMillis())
        val elapsedDays=TimeUnit.MILLISECONDS.toDays((System.currentTimeMillis()-updated).coerceAtLeast(0))
        val pets=data.optJSONArray("pets")?:return Result.success()
        val warnings=mutableListOf<String>()
        for(i in 0 until pets.length()) {
            val p=pets.optJSONObject(i)?:continue
            val name=p.optString("name",text("Миленик","Pet"))
            if(p.optDouble("satiety",90.0)-elapsedDays*7.0 <35)warnings.add(if(language=="mk") "$name е гладно" else "$name is hungry")
            if(p.optDouble("joy",90.0)-elapsedDays*5.5 <35)warnings.add(if(language=="mk") "$name сака да игра" else "$name wants to play")
            if(p.optDouble("clean",90.0)-elapsedDays*5.5 <30)warnings.add(if(language=="mk") "$name треба да се исчисти" else "$name needs cleaning")
        }
        val habitats=data.optJSONArray("habitats")
        if(habitats!=null)for(i in 0 until habitats.length()){
            val h=habitats.optJSONObject(i)?:continue
            if(h.optDouble("quality",100.0)<58)warnings.add(text("Провери ја средината: ","Check the habitat: ")+h.optString("name",text("биосвет","habitat")))
        }
        if(warnings.isEmpty()){
            (applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(1401)
            prefs.edit().remove("lastAlert").apply()
            return Result.success()
        }
        val day=(System.currentTimeMillis()/86_400_000L).toString()
        val fingerprint=day+":"+warnings.sorted().joinToString("|")
        if(prefs.getString("lastAlert",null)==fingerprint)return Result.success()
        if (Build.VERSION.SDK_INT>=33 && applicationContext.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED) return Result.success()
        val manager=applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel=NotificationChannel("trialum-care-v14",text("Грижа за TRIALUM","TRIALUM care"),NotificationManager.IMPORTANCE_DEFAULT).apply{
            description=text("Глад, потреба од игра и квалитет на биосветот","Hunger, play needs and habitat quality")
            setShowBadge(true)
            enableVibration(true)
            setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build())
        }
        manager.createNotificationChannel(channel)
        val intent=Intent(applicationContext,MainActivity::class.java)
        val pending=PendingIntent.getActivity(applicationContext,1,intent,PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val message=warnings.take(3).joinToString(" · ")+(if(warnings.size>3)text(" и уште ${warnings.size-3}"," and ${warnings.size-3} more") else "")
        val n=NotificationCompat.Builder(applicationContext,"trialum-care-v14")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(text("TRIALUM · Потребна е твојата грижа","TRIALUM · Your pets need care"))
            .setContentText(message).setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setContentIntent(pending).setAutoCancel(true).setNumber(warnings.size)
            .setBadgeIconType(NotificationCompat.BADGE_ICON_SMALL).build()
        NotificationManagerCompat.from(applicationContext).notify(1401,n)
        prefs.edit().putString("lastAlert",fingerprint).apply()
        return Result.success()
    }
}
