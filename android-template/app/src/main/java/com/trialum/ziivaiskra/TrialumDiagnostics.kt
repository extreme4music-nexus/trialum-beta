package com.trialum.ziivaiskra

import android.app.Application
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import org.json.JSONArray
import org.json.JSONObject
import java.io.PrintWriter
import java.io.StringWriter
import java.util.regex.Pattern

/** Small, opt-in diagnostic journal for the one-time Play Games test build. */
object TrialumDiagnostics {
    private const val PREFS = "trialum_diagnostics"
    private const val EVENTS_KEY = "events"
    private const val CRASH_KEY = "last_uncaught_exception"
    private const val MAX_EVENTS = 80
    private const val MAX_EVENT_CHARS = 1200
    private const val MAX_CRASH_CHARS = 12000

    private val emailPattern = Pattern.compile("[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}", Pattern.CASE_INSENSITIVE)
    private val secretPattern = Pattern.compile(
        "(?i)(access[_-]?token|refresh[_-]?token|id[_-]?token|authorization|password|api[_-]?key)\\s*[:=]\\s*[^\\s,;]+"
    )

    fun installCrashHandler(application: Application) {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        if (previous is DiagnosticsExceptionHandler) return
        Thread.setDefaultUncaughtExceptionHandler(DiagnosticsExceptionHandler(application, previous))
    }

    fun record(context: Context, category: String, message: String = "", stack: String = "") {
        synchronized(this) {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val events = try { JSONArray(prefs.getString(EVENTS_KEY, "[]")) } catch (_: Exception) { JSONArray() }
            val item = JSONObject()
                .put("at", System.currentTimeMillis())
                .put("category", sanitize(category).take(80))
                .put("message", sanitize(message).take(MAX_EVENT_CHARS))
            if (stack.isNotBlank()) item.put("stack", sanitize(stack).take(MAX_EVENT_CHARS))
            events.put(item)
            val trimmed = JSONArray()
            for (i in (events.length() - MAX_EVENTS).coerceAtLeast(0) until events.length()) {
                trimmed.put(events.getJSONObject(i))
            }
            prefs.edit().putString(EVENTS_KEY, trimmed.toString()).apply()
        }
    }

    fun report(context: Context): JSONObject {
        val packageInfo = context.packageManager.getPackageInfo(
            context.packageName,
            if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
        )
        val versionCode = if (Build.VERSION.SDK_INT >= 28) packageInfo.longVersionCode else packageInfo.versionCode.toLong()
        val signingCertificateSha1 = try {
            @Suppress("DEPRECATION")
            val signatures = if (Build.VERSION.SDK_INT >= 28) {
                packageInfo.signingInfo?.apkContentsSigners
            } else {
                packageInfo.signatures
            }
            signatures?.firstOrNull()?.toByteArray()?.let { certificate ->
                java.security.MessageDigest.getInstance("SHA-1").digest(certificate)
                    .joinToString(":") { "%02X".format(it.toInt() and 0xff) }
            }.orEmpty()
        } catch (_: Exception) { "" }
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val crash = try { JSONObject(prefs.getString(CRASH_KEY, "{}")) } catch (_: Exception) { JSONObject() }
        val events = try { JSONArray(prefs.getString(EVENTS_KEY, "[]")) } catch (_: Exception) { JSONArray() }
        return JSONObject()
            .put("format", "trialum-diagnostic-report-v1")
            .put("purpose", "one-time Play Games troubleshooting")
            .put("exportedAt", System.currentTimeMillis())
            .put("scope", "App uncaught exceptions, JavaScript errors, and Play Games diagnostic events only. Android system logcat and native-process crashes are not readable by this app.")
            .put("app", JSONObject()
                .put("package", context.packageName)
                .put("versionName", packageInfo.versionName ?: "")
                .put("versionCode", versionCode)
                .put("signingCertificateSha1", signingCertificateSha1))
            .put("device", JSONObject()
                .put("manufacturer", sanitize(Build.MANUFACTURER).take(80))
                .put("model", sanitize(Build.MODEL).take(80))
                .put("androidApi", Build.VERSION.SDK_INT))
            .put("lastUncaughtException", if (crash.has("at")) crash else JSONObject.NULL)
            .put("recentEvents", events)
    }

    private fun persistCrash(context: Context, thread: Thread, error: Throwable) {
        val writer = StringWriter()
        error.printStackTrace(PrintWriter(writer))
        val crash = JSONObject()
            .put("at", System.currentTimeMillis())
            .put("thread", sanitize(thread.name).take(80))
            .put("type", sanitize(error.javaClass.name).take(200))
            .put("message", sanitize(error.message ?: "").take(1000))
            .put("stack", sanitize(writer.toString()).take(MAX_CRASH_CHARS))
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(CRASH_KEY, crash.toString())
            .commit()
        record(context, "app.uncaught_exception", error.javaClass.simpleName, writer.toString())
    }

    private fun sanitize(input: String): String {
        val noSecrets = secretPattern.matcher(input).replaceAll("$1=[redacted]")
        return emailPattern.matcher(noSecrets).replaceAll("[email-redacted]")
            .replace(Regex("(?i)bearer\\s+[A-Za-z0-9._~+/-]+=*"), "Bearer [redacted]")
    }

    private class DiagnosticsExceptionHandler(
        private val application: Application,
        private val previous: Thread.UncaughtExceptionHandler?
    ) : Thread.UncaughtExceptionHandler {
        override fun uncaughtException(thread: Thread, error: Throwable) {
            try { persistCrash(application, thread, error) } catch (_: Throwable) { }
            if (previous != null && previous !is DiagnosticsExceptionHandler) {
                previous.uncaughtException(thread, error)
            } else {
                Process.killProcess(Process.myPid())
                kotlin.system.exitProcess(10)
            }
        }
    }
}
