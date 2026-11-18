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
        val updated=data.optLong("updatedAt",System.currentTimeMillis())
        val elapsedDays=TimeUnit.MILLISECONDS.toDays((System.currentTimeMillis()-updated).coerceAtLeast(0))
        val pets=data.optJSONArray("pets")?:return Result.success()
        val warnings=mutableListOf<String>()
        for(i in 0 until pets.length()) {
            val p=pets.optJSONObject(i)?:continue
            val name=p.optString("name","Миленик")
            if(p.optDouble("satiety",90.0)-elapsedDays*7.0 <35)warnings.add("$name е гладно")
            if(p.optDouble("joy",90.0)-elapsedDays*5.5 <35)warnings.add("$name сака да игра")
            if(p.optDouble("clean",90.0)-elapsedDays*5.5 <30)warnings.add("$name треба да се исчисти")
        }
        val habitats=data.optJSONArray("habitats")
        if(habitats!=null)for(i in 0 until habitats.length()){
            val h=habitats.optJSONObject(i)?:continue
            if(h.optDouble("quality",100.0)<58)warnings.add("Провери ја средината: ${h.optString("name", "биосвет")}")
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
        val channel=NotificationChannel("trialum-care-v14","Грижа за ТРИАЛУМ",NotificationManager.IMPORTANCE_DEFAULT).apply{
            description="Глад, потреба од игра и квалитет на биосветот"
            setShowBadge(true)
            enableVibration(true)
            setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build())
        }
        manager.createNotificationChannel(channel)
        val intent=Intent(applicationContext,MainActivity::class.java)
        val pending=PendingIntent.getActivity(applicationContext,1,intent,PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val message=warnings.take(3).joinToString(" · ")+(if(warnings.size>3)" и уште ${warnings.size-3}" else "")
        val n=NotificationCompat.Builder(applicationContext,"trialum-care-v14")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("ТРИАЛУМ · Потребна е твојата грижа")
            .setContentText(message).setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setContentIntent(pending).setAutoCancel(true).setNumber(warnings.size)
            .setBadgeIconType(NotificationCompat.BADGE_ICON_SMALL).build()
        NotificationManagerCompat.from(applicationContext).notify(1401,n)
        prefs.edit().putString("lastAlert",fingerprint).apply()
        return Result.success()
    }
}
