package com.trialum.ziivaiskra

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import org.json.JSONObject
import java.util.Locale

/**
 * Explicit user-started English speech tools for the PRIVATE on-device pet chat.
 * Recognition is on-device ONLY (API 31+). No implicit cloud recognition fallback.
 * TTS selects an installed non-network voice. Audio is never persisted by Trialum.
 */
class TrialumPetVoice(
    private val activity: Activity,
    private val emit: (JSONObject) -> Unit
) : RecognitionListener, TextToSpeech.OnInitListener {
    companion object { const val MICROPHONE_REQUEST = 1441 }
    private var recognizer: SpeechRecognizer? = null
    private var speaker: TextToSpeech? = null
    private var activePet: String? = null
    private var lastSpeechPet: String? = null
    private var pendingText: String? = null
    private var speakerReady = false

    private fun notify(kind: String, pet: String?, message: String, text: String = "") {
        val id = pet ?: return
        emit(JSONObject().put("kind", kind).put("petId", id)
            .put("message", message.take(180)).put("text", text.take(340)))
    }

    fun start(petId: String) {
        if (!petId.matches(Regex("^[A-Za-z0-9_-]{1,64}$"))) return
        if (Build.VERSION.SDK_INT < 31 ||
            !SpeechRecognizer.isOnDeviceRecognitionAvailable(activity)) {
            notify("error", petId, "Install an English on-device Android speech recognition pack to use the microphone.")
            return
        }
        activePet = petId
        if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            activity.requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), MICROPHONE_REQUEST)
            return
        }
        beginListening()
    }

    fun onPermissionResult(requestCode: Int, grantResults: IntArray) {
        if (requestCode != MICROPHONE_REQUEST) return
        if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) beginListening()
        else {
            notify("error", activePet, "Microphone permission denied.")
            activePet = null
        }
    }

    private fun beginListening() {
        val id = activePet ?: return
        try {
            recognizer?.destroy()
            recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(activity).also {
                it.setRecognitionListener(this)
                it.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "en-US")
                    putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, false)
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
                    putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
                })
            }
            notify("listening", id, "Listening in English…")
        } catch (_: Exception) {
            notify("error", id, "English on-device speech recognition is not available.")
            activePet = null
        }
    }

    fun speak(petId: String, text: String) {
        if (!petId.matches(Regex("^[A-Za-z0-9_-]{1,64}$"))) return
        val line = text.trim().take(500)
        if (line.isBlank()) return
        lastSpeechPet = petId
        pendingText = line
        if (speaker == null) {
            speakerReady = false
            speaker = TextToSpeech(activity, this)
        } else if (speakerReady) speakPending()
        else notify("status", petId, "Android English voice is initializing…")
    }

    override fun onInit(status: Int) {
        val tts = speaker ?: return
        if (status != TextToSpeech.SUCCESS) {
            notify("error", lastSpeechPet, "Android text-to-speech could not initialize.")
            pendingText = null
            return
        }
        // A local voice is required for the offline/private chat: no network TTS.
        val localVoice = tts.voices?.firstOrNull {
            it.locale.language == Locale.ENGLISH.language && !it.isNetworkConnectionRequired
        }
        if (localVoice == null || tts.setVoice(localVoice) != TextToSpeech.SUCCESS) {
            notify("error", lastSpeechPet, "Install an offline English Android TTS voice.")
            pendingText = null
            return
        }
        speakerReady = true
        speakPending()
    }

    private fun speakPending() {
        if (!speakerReady) return
        val line = pendingText ?: return
        pendingText = null
        val status = speaker?.speak(line, TextToSpeech.QUEUE_FLUSH, null, "trialum-pet-chat")
        if (status != TextToSpeech.SUCCESS)
            notify("error", lastSpeechPet, "Could not play the English voice.")
        else notify("status", lastSpeechPet, "Reading pet reply aloud.")
    }

    override fun onReadyForSpeech(params: Bundle?) {}
    override fun onBeginningOfSpeech() {}
    override fun onRmsChanged(rmsdB: Float) {}
    override fun onBufferReceived(buffer: ByteArray?) {}
    override fun onEndOfSpeech() {}
    override fun onError(error: Int) {
        notify("error", activePet, "Speech recognition ended. Check the offline English pack or try again.")
        activePet = null
    }
    override fun onResults(results: Bundle?) {
        val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            ?.firstOrNull().orEmpty().trim().take(340)
        if (text.isNotBlank()) notify("transcript", activePet, "English speech recognized.", text)
        else notify("error", activePet, "No speech recognized.")
        activePet = null
    }
    override fun onPartialResults(partialResults: Bundle?) {}
    override fun onEvent(eventType: Int, params: Bundle?) {}

    fun stop() {
        recognizer?.cancel()
        recognizer?.destroy()
        recognizer = null
        activePet = null
        speaker?.stop()
    }
    fun destroy() {
        stop()
        speaker?.shutdown()
        speaker = null
        speakerReady = false
        pendingText = null
    }
}
