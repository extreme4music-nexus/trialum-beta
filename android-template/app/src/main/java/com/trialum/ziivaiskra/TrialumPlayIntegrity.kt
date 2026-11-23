package com.trialum.ziivaiskra

import android.content.Context
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.StandardIntegrityManager
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap

/**
 * Play Integrity Standard API client. Only the encrypted token is delivered to the
 * eligibility flow; this class never logs the token or stores it persistently.
 */
class TrialumPlayIntegrity(
    context: Context,
    private val cloudProjectNumber: String,
    private val deliver: (JSONObject) -> Unit
) {
    private val manager = IntegrityManagerFactory.createStandard(context.applicationContext)
    @Volatile private var provider: StandardIntegrityManager.StandardIntegrityTokenProvider? = null
    @Volatile private var preparing = false
    private val waiting = ConcurrentHashMap<Long, String>()

    fun prepare() {
        prepareIfNeeded()
    }

    fun request(requestId: Long, requestHash: String) {
        if (requestId <= 0L || requestHash.length !in 1..500) {
            deliver(JSONObject().put("requestId", requestId).put("status", "invalid_request"))
            return
        }
        if (waiting.putIfAbsent(requestId, requestHash) != null) return
        val ready = provider
        if (ready != null) {
            requestWith(ready, requestId, requestHash)
        } else {
            prepareIfNeeded()
        }
    }

    private fun prepareIfNeeded() {
        if (cloudProjectNumber.isBlank() || !cloudProjectNumber.matches(Regex("^[0-9]{1,20}$"))) {
            failWaiting("configuration_missing")
            return
        }
        synchronized(this) {
            if (provider != null || preparing) return
            preparing = true
        }
        val number = cloudProjectNumber.toLongOrNull()
        if (number == null || number <= 0L) {
            synchronized(this) { preparing = false }
            failWaiting("configuration_missing")
            return
        }
        try {
            manager.prepareIntegrityToken(
                StandardIntegrityManager.PrepareIntegrityTokenRequest.builder()
                    .setCloudProjectNumber(number)
                    .build()
            ).addOnSuccessListener { tokenProvider ->
                synchronized(this) {
                    provider = tokenProvider
                    preparing = false
                }
                waiting.entries.toList().forEach { (id, hash) ->
                    if (waiting.remove(id, hash)) requestWith(tokenProvider, id, hash)
                }
            }.addOnFailureListener {
                synchronized(this) { preparing = false }
                failWaiting("unavailable")
            }
        } catch (_: Exception) {
            synchronized(this) { preparing = false }
            failWaiting("unavailable")
        }
    }

    private fun requestWith(
        tokenProvider: StandardIntegrityManager.StandardIntegrityTokenProvider,
        requestId: Long,
        requestHash: String
    ) {
        try {
            tokenProvider.request(
                StandardIntegrityManager.StandardIntegrityTokenRequest.builder()
                    .setRequestHash(requestHash)
                    .build()
            ).addOnSuccessListener { response ->
                waiting.remove(requestId)
                deliver(JSONObject()
                    .put("requestId", requestId)
                    .put("status", "ok")
                    .put("token", response.token()))
            }.addOnFailureListener {
                waiting.remove(requestId)
                deliver(JSONObject().put("requestId", requestId).put("status", "unavailable"))
            }
        } catch (_: Exception) {
            waiting.remove(requestId)
            deliver(JSONObject().put("requestId", requestId).put("status", "unavailable"))
        }
    }

    private fun failWaiting(status: String) {
        waiting.keys.toList().forEach { id ->
            if (waiting.remove(id) != null) deliver(JSONObject().put("requestId", id).put("status", status))
        }
    }
}
