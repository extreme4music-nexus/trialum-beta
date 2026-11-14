package com.trialum.ziivaiskra

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.ArrayDeque
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlin.random.Random

/**
 * Explicitly user-started PRIVATE QA service. The resident 135M model stays
 * on-device; only bounded English speech reaches the already authenticated WSS.
 * Not an Activity/WebView timer. No server/cloud AI, tracking, rewards, logs or
 * background notification spam. Service and connection may be stopped by Android.
 */
class TrialumBackgroundSpeechService : Service() {
    companion object {
        const val START = "com.trialum.ziivaiskra.AI_START"
        const val RESUME = "com.trialum.ziivaiskra.AI_RESUME_BACKGROUND"
        const val PAUSE = "com.trialum.ziivaiskra.AI_PAUSE_FOREGROUND"
        const val STOP = "com.trialum.ziivaiskra.AI_STOP"
        private const val CHANNEL = "trialum_background_ai"
        private const val NOTIFICATION_ID = 58012
        private val uuid = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
        private val petRef = Regex("^[A-Za-z0-9_-]{1,64}$")
        @Volatile var running = false
            private set
    }

    private val handler = Handler(Looper.getMainLooper())
    private val client = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .pingInterval(30, TimeUnit.SECONDS)
        .retryOnConnectionFailure(false)
        .build()
    private lateinit var model: ModelRuntime
    private var room = ""
    private var pet = ""
    private var session = ""
    private var petName = ""
    private var server = ""
    private var credential = ""
    private var socket: WebSocket? = null
    private var paused = true
    private var authorized = false
    private var lastAttempt = 0L
    private var deliveredModelLines = 0
    private var deliveredScriptLines = 0 // count only actual WSS sends, never failed inference
    private var pendingReplyTo = ""
    private val conversation = ArrayDeque<String>()
    // At most 24 private-room peer turns waiting through model cooldown.
    // The native service never persists a transcript or accesses owner/pet chat.
    private data class Heard(val turn: String, val speaker: String,
        val sourcePetId: String, val line: String, val at: Long)
    private val pendingMessages = ArrayDeque<Heard>()
    private val seenTurns = LinkedHashSet<String>()
    private val answeredTurns = LinkedHashSet<String>()
    private var activeTurn: Heard? = null
    private var modelBusy = false
    private val drainRunnable = Runnable { drain() }
    private var epoch = 0
    private val reconnect = Runnable {
        if (running && !paused) connect()
    }
    private val renewer = object : Runnable {
        override fun run() {
            if (running && !paused) {
                renewPresence()
                handler.postDelayed(this, 25 * 60_000L)
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        model = ModelRuntime(applicationContext) { kind, id, line ->
            if (id != pet) return@ModelRuntime
            handler.post {
                if (!running || paused || !authorized) return@post
                if (kind == "status" && line != "Model is already generating.") return@post
                if (kind == "playgroundReply") {
                    val phrase = oneSentence(line)
                    val blocked = activeTurn?.turn?.let { answeredTurns.contains(it) } == true
                    if (!blocked && phrase.isNotEmpty() && relayLine(phrase, pendingReplyTo)) {
                        deliveredModelLines++
                        remember(petName, phrase, pet)
                        activeTurn?.let { answeredTurns.add(it.turn) }
                    } else if (!blocked) activeTurn?.let { if (pendingMessages.size < 24) pendingMessages.addFirst(it) }
                } else activeTurn?.let { if (pendingMessages.size < 24) pendingMessages.addFirst(it) }
                activeTurn = null
                modelBusy = false
                pendingReplyTo = ""
                drain()
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            STOP -> { stopSelf(); return START_NOT_STICKY }
            START -> {
                val requestedRoom = intent.getStringExtra("roomId").orEmpty()
                val requestedPet = intent.getStringExtra("petId").orEmpty()
                val requestedSession = intent.getStringExtra("sessionId").orEmpty()
                val requestedName = intent.getStringExtra("petName").orEmpty()
                val configured = getString(R.string.trialum_social_api_url)
                val key = SocialCredentialVault.read(applicationContext)
                if (!uuid.matches(requestedRoom) || !uuid.matches(requestedSession) ||
                    !petRef.matches(requestedPet) || requestedName.length !in 1..48 ||
                    !configured.matches(Regex("^https://[A-Za-z0-9.-]+(?::443)?$")) ||
                    !key.matches(Regex("^[A-Za-z0-9_-]{43}$")) || model.status() != "installed") {
                    stopSelf(); return START_NOT_STICKY
                }
                // Reconfiguration while already armed cannot retain a socket
                // authenticated for an earlier pet or private room.
                if (running) {
                    disconnect()
                    model.cancelPlayground()
                    lastAttempt = 0L
                    deliveredModelLines = 0
                    deliveredScriptLines = 0
                    pendingMessages.clear()
                    seenTurns.clear()
                    answeredTurns.clear()
                    conversation.clear()
                    activeTurn = null
                    modelBusy = false
                }
                room = requestedRoom; pet = requestedPet; session = requestedSession
                petName = requestedName; server = configured; credential = key
                paused = true // The visible WebView owns dialogue until onStop.
                channel()
                val notification = buildNotification()
                if (Build.VERSION.SDK_INT >= 34) {
                    startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
                } else startForeground(NOTIFICATION_ID, notification)
                running = true
            }
            PAUSE -> {
                paused = true
                disconnect()
                model.cancelPlayground()
            }
            RESUME -> {
                if (running) {
                    paused = false
                    if (!powerPermitsConversation()) {
                        stopSelf(); return START_NOT_STICKY
                    }
                    connect()
                    handler.removeCallbacks(renewer)
                    handler.postDelayed(renewer, 25 * 60_000L)
                }
            }
        }
        return START_NOT_STICKY // Do not auto-resume after OS/process termination.
    }

    private fun channel() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(NotificationChannel(CHANNEL, "Trialum optional AI",
            NotificationManager.IMPORTANCE_LOW).apply {
            description = "Active only when you opted into private background pet dialogue"
        })
    }

    private fun buildNotification(): Notification {
        val stop = Intent(this, TrialumBackgroundSpeechService::class.java).setAction(STOP)
        val action = PendingIntent.getService(this, 31, stop,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val open = PendingIntent.getActivity(this, 32,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        return Notification.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Trialum · mini AI active")
            .setContentText("Optional background playground dialogue · tap to return")
            .setContentIntent(open)
            .setOngoing(true)
            .addAction(Notification.Action.Builder(
                android.R.drawable.ic_menu_close_clear_cancel, "Stop AI", action).build())
            .build()
    }

    private fun powerPermitsConversation(): Boolean {
        val manager = getSystemService(Context.POWER_SERVICE) as PowerManager
        if (manager.isPowerSaveMode) return false
        val battery = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = battery?.getIntExtra(BatteryManager.EXTRA_LEVEL, 100) ?: 100
        val scale = battery?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
        val state = battery?.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
        val charging = state == BatteryManager.BATTERY_STATUS_CHARGING ||
            state == BatteryManager.BATTERY_STATUS_FULL
        return charging || (scale > 0 && level.toDouble() / scale >= 0.20)
    }

    private fun connect() {
        if (paused || !running || socket != null) return
        val socketEpoch = ++epoch
        val url = server.replaceFirst("https://", "wss://") + "/v1/social/live"
        val request = Request.Builder().url(url).build()
        socket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                if (!running || paused || epoch != socketEpoch) { ws.close(1000, "inactive"); return }
                ws.send(JSONObject().put("type", "auth").put("credential", credential).toString())
            }
            override fun onMessage(ws: WebSocket, text: String) {
                if (paused || !running || epoch != socketEpoch || text.length > 2048) return
                val m = runCatching { JSONObject(text) }.getOrNull() ?: return
                when (m.optString("type")) {
                    "ready" -> {
                        // Never run English-canonical background AI against an
                        // older server that cannot guarantee private translation.
                        if (!m.optBoolean("speechTranslationEnabled", false)) {
                            handler.post { stopSelf() }; return
                        }
                        ws.send(JSONObject().put("type", "subscribe")
                            .put("roomId", room).put("language", "en").toString())
                    }
                    "subscribed" -> {
                        if (m.optString("roomId") == room) {
                            authorized = true
                            // One possible conversation opener, only after
                            // an authenticated room subscription.
                            handler.postDelayed({
                                if (running && !paused && authorized && lastAttempt == 0L &&
                                    pendingMessages.isEmpty() && conversation.isEmpty())
                                    ask("Ask one short question about a playground toy in English.", "")
                                else drain()
                            }, 8000L)
                        }
                    }
                    "pet_speech" -> {
                        if (!authorized || m.optString("roomId") != room ||
                            m.optString("petId") == pet || !m.optBoolean("translated", false)) return
                        val line = oneSentence(m.optString("englishText"))
                        val turn = m.optString("turnId")
                        if (line.isEmpty() || !uuid.matches(turn)) return
                        val speaker = m.optString("speaker", "friend").take(32)
                        val sourcePet = m.optString("petId").take(64)
                        val replyTo = m.optString("replyToTurnId")
                        handler.post {
                            if (!running || paused || !authorized || !seenTurns.add(turn)) return@post
                            while (seenTurns.size > 72) seenTurns.remove(seenTurns.first())
                            if (uuid.matches(replyTo)) answeredTurns.add(replyTo)
                            while (answeredTurns.size > 144) answeredTurns.remove(answeredTurns.first())
                            remember(speaker, line, sourcePet)
                            if (pendingMessages.size >= 24) pendingMessages.removeFirst()
                            pendingMessages.addLast(Heard(turn, speaker, sourcePet, line, System.currentTimeMillis()))
                            drain()
                        }
                    }
                    "error" -> {
                        if (m.optString("error") in setOf("auth_required","room_access_denied",
                                "friendship_required","pet_not_present","invalid_action",
                                "translator_unavailable","unsupported_speech_language"))
                                handler.post { stopSelf() }
                    }
                }
            }
            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                lost(socketEpoch)
            }
            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                lost(socketEpoch)
            }
        })
    }

    // The background service runs only with explicit user consent and a
    // verified private room lease. Scripted nudges use the SAME authenticated
    // WSS and private English translation as native model outputs.
    private fun relayLine(phrase: String, replyTo: String): Boolean {
        if (!running || paused || !authorized || phrase.isBlank()) return false
        val event = JSONObject()
            .put("type", "pet_speech").put("roomId", room).put("petId", pet)
            .put("sessionId", session).put("turnId", UUID.randomUUID().toString())
            .put("text", phrase).put("language", "en")
        if (uuid.matches(replyTo)) event.put("replyToTurnId", replyTo)
        return socket?.send(event.toString()) == true
    }

    private fun topicNudge(prompt: String): String {
        val context = prompt.lowercase()
        val lines = when {
            context.contains("garden") || context.contains("flower") ||
                context.contains("plant") || context.contains("tree") ->
                listOf("What else might we find in the garden?",
                    "Shall we look for another little plant?")
            context.contains("toy") || context.contains("slide") ||
                context.contains("seesaw") || context.contains("play") ->
                listOf("Which toy shall we explore next?",
                    "Shall we try another playful challenge?")
            else -> listOf("Could you explain a little more about that?",
                "What do you think about the idea you just mentioned?")
        }
        return lines[Random.nextInt(lines.size)]
    }

    private fun remember(speaker: String, text: String, sourcePetId: String) {
        // RAM-only session turns include verified pet ID and speaker attribution.
        // Personal player/pet talk never enters this relay or model context.
        conversation.addLast("${sourcePetId.take(32)}|${speaker.take(32)}: ${text.take(112)}")
        while (conversation.size > 12) conversation.removeFirst()
        // Persistent local world import receives ONLY day, topic IDs, cosmetic
        // companion name and a bounded moment count. Never a transcript.
        BackgroundPetMemory.remember(applicationContext, pet,
            if (speaker == petName) "" else speaker, text)
    }

    private fun drain() {
        handler.removeCallbacks(drainRunnable)
        if (!running || paused || !authorized || modelBusy) return
        val now = System.currentTimeMillis()
        while (pendingMessages.isNotEmpty() &&
            (answeredTurns.contains(pendingMessages.first.turn) ||
             now - pendingMessages.first.at > 90L * 60_000L)) {
            pendingMessages.removeFirst()
        }
        val next = pendingMessages.firstOrNull() ?: return
        val remaining = 24_000L - (now - lastAttempt)
        if (remaining > 0) {
            handler.postDelayed(drainRunnable, remaining)
            return
        }
        activeTurn = next
        // Only an authenticated room-speech turn is offered to the model.
        // The speaker's stable pet ID prevents same-name confusion.
        val prompt = "Your friend ${next.speaker} (creature ID ${next.sourcePetId}) said: " +
            "\"${next.line}\". Continue that EXISTING topic in one short English sentence, " +
            "without repeating the line or inventing an unrelated subject."
        if (ask(prompt, next.turn)) {
            pendingMessages.removeFirst()
            if (!modelBusy) {
                // A successfully relayed scripted 10th turn finishes synchronously.
                activeTurn = null
                drain()
            }
        } else {
            activeTurn = null
            handler.postDelayed(drainRunnable, 24_000L)
        }
    }

    private fun ask(prompt: String, replyTo: String): Boolean {
        if (!running || paused || !authorized || modelBusy) return false
        if (!powerPermitsConversation()) { handler.post { stopSelf() }; return false }
        if (model.status() != "installed" ||
            System.currentTimeMillis() - lastAttempt < 24_000L) return false
        lastAttempt = System.currentTimeMillis()
        // One successfully sent contextual scripted nudge for nine model lines;
        // existing opted-in model inference and rate limits remain unchanged.
        if ((deliveredModelLines + deliveredScriptLines + 1) % 10 == 0) {
            if (relayLine(topicNudge(prompt), replyTo)) {
                deliveredScriptLines++
                if (uuid.matches(replyTo)) answeredTurns.add(replyTo)
                return true
            }
            return false
        }
        pendingReplyTo = replyTo
        val context = JSONObject().put("llmLanguage", "en")
            .put("roomTurns", JSONArray(conversation.toList().takeLast(8)
                .map { it.take(130) })).toString()
        modelBusy = true
        model.ask(pet, petName, prompt.take(320), "mini", context, true)
        return true
    }

    private fun oneSentence(value: String): String {
        val raw = value.substringBefore('\n').substringBefore('\r').trim()
        if (raw.isBlank() || raw.contains(Regex("https?://|www\\.|\\S+@\\S+"))) return ""
        val mark = raw.indexOfAny(charArrayOf('.', '!', '?'))
        val phrase = (if (mark >= 0) raw.take(mark + 1) else raw)
            .take(112).split(Regex("\\s+")).take(17).joinToString(" ").trim()
        // Guardrail against the small English-leaning model unexpectedly
        // producing non-Latin text. Actual semantic English is not guaranteed.
        return if (phrase.length in 1..112 &&
            phrase.all { it.code in 32..126 } &&
            phrase.any { it in 'A'..'Z' || it in 'a'..'z' }) phrase else ""
    }

    private fun lost(currentEpoch: Int) {
        handler.post {
            if (epoch != currentEpoch) return@post
            socket = null; authorized = false
            if (!paused && running) {
                handler.removeCallbacks(reconnect)
                handler.postDelayed(reconnect, 15_000L)
            }
        }
    }

    private fun disconnect() {
        epoch++
        authorized = false
        handler.removeCallbacks(reconnect)
        handler.removeCallbacks(renewer)
        handler.removeCallbacks(drainRunnable)
        pendingMessages.clear()
        activeTurn = null
        modelBusy = false
        socket?.close(1000, "foreground")
        socket = null
        pendingReplyTo = ""
        conversation.clear()
    }

    private fun renewPresence() {
        if (paused || !running) return
        val body = JSONObject().put("petId", pet).put("sessionId", session)
            .put("roomId", room).toString().toRequestBody("application/json".toMediaType())
        val req = Request.Builder().url(server + "/v1/shared/presence/renew")
            .header("Authorization", "Bearer " + credential).post(body).build()
        client.newCall(req).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {} // Reconnect handles network loss.
            override fun onResponse(call: Call, response: Response) {
                response.use {
                    if (it.code in 400..499 && it.code != 429)
                        handler.post { stopSelf() }
                }
            }
        })
    }

    override fun onDestroy() {
        running = false; paused = true
        disconnect()
        model.destroy()
        client.dispatcher.executorService.shutdown()
        client.connectionPool.evictAll()
        credential = ""; pet = ""; session = ""
        super.onDestroy()
    }
}
