package com.trialum.ziivaiskra

import android.app.Activity
import com.google.android.play.agesignals.AgeSignalsAccessRequest
import com.google.android.play.agesignals.AgeSignalsManager
import com.google.android.play.agesignals.AgeSignalsManagerFactory
import com.google.android.play.agesignals.AgeSignalsRequest
import com.google.android.play.agesignals.model.AgeRangeSource
import com.google.android.play.agesignals.model.AgeSignalsStatus
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicLong

/**
 * Privacy-minimal Play age check. DOB, exact age bounds, source tier,
 * install ID, and significant-change identifiers never leave this class.
 *
 * An Activity stop caused by Google-owned UI does not invalidate a request.
 * Only a newer request supersedes an older callback.
 */
class TrialumAgeSignals(activity: Activity, private val deliver: (JSONObject) -> Unit) {
    private val appContext = activity.applicationContext
    private val manager: AgeSignalsManager = AgeSignalsManagerFactory.create(appContext)
    private val requestSequence = AtomicLong(0)
    @Volatile private var activeRequestId = 0L
    @Volatile private var adultEligible = false

    fun isAdultEligible(): Boolean = adultEligible

    fun beginRequest(): Long {
        val id = requestSequence.incrementAndGet()
        activeRequestId = id
        adultEligible = false
        return id
    }

    fun request(activity: Activity, requestId: Long) {
        if (!isCurrent(requestId)) return
        try {
            val access = AgeSignalsAccessRequest.builder().setActivity(activity).build()
            manager.requestAgeSignalsAccess(access)
                .addOnSuccessListener { result ->
                    if (!isCurrent(requestId)) return@addOnSuccessListener
                    val status = result.ageSignalsStatus()
                    val label = when (status) {
                        AgeSignalsStatus.SHARED -> "SHARED"
                        AgeSignalsStatus.NOT_SHARED -> "NOT_SHARED"
                        AgeSignalsStatus.VERIFICATION_REQUIRED -> "VERIFICATION_REQUIRED"
                        else -> "UNKNOWN"
                    }
                    recordDiagnostic("age_signals.access", label)
                    if (status == AgeSignalsStatus.SHARED) checkSharedSignals(requestId)
                    else finish(requestId, false, label.lowercase())
                }
                .addOnFailureListener { error ->
                    if (!isCurrent(requestId)) return@addOnFailureListener
                    recordDiagnostic("age_signals.access_error", error.javaClass.simpleName)
                    finish(requestId, false, "unavailable")
                }
        } catch (_: Exception) {
            if (isCurrent(requestId)) {
                recordDiagnostic("age_signals.access_error", "exception")
                finish(requestId, false, "unavailable")
            }
        }
    }

    private fun checkSharedSignals(requestId: Long) {
        if (!isCurrent(requestId)) return
        try {
            manager.checkAgeSignals(AgeSignalsRequest.builder().build())
                .addOnSuccessListener { result ->
                    if (!isCurrent(requestId)) return@addOnSuccessListener
                    val ageLower = result.ageLower() ?: -1
                    val ageUpper = result.ageUpper()
                    val sourceValue = result.ageRangeSource()
                    val eligibleSource = sourceValue == AgeRangeSource.TIER_A ||
                        sourceValue == AgeRangeSource.TIER_C ||
                        sourceValue == AgeRangeSource.TIER_D
                    val eligible = eligibleSource && ageLower >= 18 && ageUpper == null
                    val source = when (sourceValue) {
                        AgeRangeSource.TIER_A -> "TIER_A"
                        AgeRangeSource.TIER_B -> "TIER_B"
                        AgeRangeSource.TIER_C -> "TIER_C"
                        AgeRangeSource.TIER_D -> "TIER_D"
                        else -> "UNKNOWN"
                    }
                    val band = when {
                        ageLower < 0 -> "unknown"
                        ageLower >= 18 && ageUpper == null -> "18_plus"
                        else -> "under_18_or_closed_range"
                    }
                    recordDiagnostic("age_signals.result", "band=$band;source=$source;eligible=$eligible")
                    finish(requestId, eligible, if (eligible) "adult_signal" else "restricted")
                }
                .addOnFailureListener { error ->
                    if (!isCurrent(requestId)) return@addOnFailureListener
                    recordDiagnostic("age_signals.result_error", error.javaClass.simpleName)
                    finish(requestId, false, "unavailable")
                }
        } catch (_: Exception) {
            if (isCurrent(requestId)) {
                recordDiagnostic("age_signals.result_error", "exception")
                finish(requestId, false, "unavailable")
            }
        }
    }

    private fun isCurrent(requestId: Long): Boolean =
        requestId > 0L && activeRequestId == requestId

    private fun recordDiagnostic(category: String, message: String) {
        // Keep coarse status only; never persist DOB or exact age boundaries.
        try { TrialumDiagnostics.record(appContext, category, message) } catch (_: Exception) { }
    }

    private fun finish(requestId: Long, eligible: Boolean, status: String) {
        if (!isCurrent(requestId)) return
        adultEligible = eligible
        deliver(JSONObject()
            .put("requestId", requestId)
            .put("status", status)
            .put("adultEligible", eligible))
    }
}
