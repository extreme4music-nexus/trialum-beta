package com.trialum.ziivaiskra

import android.app.Activity
import android.util.Base64
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.StandardIntegrityManager
import java.security.MessageDigest
import org.json.JSONObject

/**
 * Obtains a short-lived, action-bound Play Integrity Standard token.
 * Age eligibility comes ONLY from TrialumAgeSignals on this device.
 * Neither the age response nor any account/device identifier enters the token request.
 * The token is forwarded once to the bundled WebView and is never persisted or logged.
 */
class TrialumSocialIntegrity(
    private val activity: Activity,
    private val ageEligible: () -> Boolean,
    private val deliver: (JSONObject) -> Unit
) {
    private val manager by lazy { IntegrityManagerFactory.createStandard(activity.applicationContext) }
    private var provider: StandardIntegrityManager.StandardIntegrityTokenProvider? = null
    private var generation = 0
    private var busy = false

    fun cancel() {
        generation++
        busy = false
    }

    private fun fail(id: String, reason: String) {
        deliver(JSONObject().put("requestId", id).put("ok", false).put("error", reason))
    }

    fun request(id: String, action: String, consentVersion: String, subject: String) {
        if (!id.matches(Regex("[A-Za-z0-9_-]{8,80}")) ||
            action !in setOf("register", "renew") ||
            !consentVersion.matches(Regex("[A-Za-z0-9._-]{1,80}")) ||
            subject.length !in 1..64 || subject.contains('\n') || subject.contains('\r') ||
            (action == "register" && (subject != subject.trim() || subject.length > 32)) ||
            (action == "renew" && !subject.matches(Regex("[0-9a-fA-F-]{36}")))) {
            fail(id, "invalid_request")
            return
        }
        if (!ageEligible()) {
            fail(id, "age_gate_required")
            return
        }
        // Never attest QA/debug/suffixed APKs, even if a local client is modified.
        if (BuildConfig.DEBUG || activity.packageName != "com.trialum.ziivaiskra") {
            fail(id, "production_play_install_required")
            return
        }
        if (BuildConfig.SOCIAL_INTEGRITY_CLOUD_PROJECT_NUMBER <= 0L) {
            fail(id, "integrity_unconfigured")
            return
        }
        if (busy) {
            fail(id, "integrity_busy")
            return
        }
        busy = true
        val epoch = ++generation
        val message = "trialum-social-integrity-v1\n" + action + "\n" + consentVersion + "\n" + subject
        val hash = Base64.encodeToString(
            MessageDigest.getInstance("SHA-256").digest(message.toByteArray(Charsets.UTF_8)),
            Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP
        )
        fun requestToken(p: StandardIntegrityManager.StandardIntegrityTokenProvider) {
            if (epoch != generation || !ageEligible()) {
                if (epoch == generation) { busy = false; fail(id, "age_gate_required") }
                return
            }
            try {
                p.request(
                    StandardIntegrityManager.StandardIntegrityTokenRequest.builder()
                        .setRequestHash(hash).build()
                ).addOnSuccessListener { response ->
                    if (epoch != generation) return@addOnSuccessListener
                    busy = false
                    if (!ageEligible()) { fail(id, "age_gate_required"); return@addOnSuccessListener }
                    deliver(JSONObject().put("requestId", id).put("ok", true).put("token", response.token()))
                }.addOnFailureListener {
                    if (epoch == generation) {
                        provider = null // On retry reprepare a possibly expired provider.
                        busy = false
                        fail(id, "integrity_unavailable")
                    }
                }
            } catch (_: Exception) {
                if (epoch == generation) { provider = null; busy = false; fail(id, "integrity_unavailable") }
            }
        }
        val activeProvider = provider
        if (activeProvider != null) {
            requestToken(activeProvider)
            return
        }
        try {
            manager.prepareIntegrityToken(
                StandardIntegrityManager.PrepareIntegrityTokenRequest.builder()
                    .setCloudProjectNumber(BuildConfig.SOCIAL_INTEGRITY_CLOUD_PROJECT_NUMBER)
                    .build()
            ).addOnSuccessListener { ready ->
                if (epoch == generation) { provider = ready; requestToken(ready) }
            }.addOnFailureListener {
                if (epoch == generation) { busy = false; fail(id, "integrity_unavailable") }
            }
        } catch (_: Exception) {
            if (epoch == generation) { busy = false; fail(id, "integrity_unavailable") }
        }
    }
}
