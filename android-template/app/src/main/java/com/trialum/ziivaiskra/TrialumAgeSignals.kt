package com.trialum.ziivaiskra

import android.app.Activity
import com.google.android.play.agesignals.AgeSignalsAccessRequest
import com.google.android.play.agesignals.AgeSignalsManager
import com.google.android.play.agesignals.AgeSignalsManagerFactory
import com.google.android.play.agesignals.AgeSignalsRequest
import com.google.android.play.agesignals.model.AgeRangeSource
import com.google.android.play.agesignals.model.AgeSignalsStatus
import org.json.JSONObject

/**
 * Privacy-minimal Play age check. Never returns DOB, age bounds, source tier,
 * install ID, or significant-change identifiers to JavaScript or the server.
 */
class TrialumAgeSignals(activity: Activity, private val deliver: (JSONObject) -> Unit) {
    private val appContext = activity.applicationContext
    private val manager: AgeSignalsManager =
        AgeSignalsManagerFactory.create(appContext)
    @Volatile private var adultEligible = false

    fun isAdultEligible(): Boolean = adultEligible

    fun request(activity: Activity) {
        adultEligible = false
        try {
            val access = AgeSignalsAccessRequest.builder().setActivity(activity).build()
            manager.requestAgeSignalsAccess(access)
                .addOnSuccessListener { result ->
                    val status = result.ageSignalsStatus()
                    val label = when (status) {
                        AgeSignalsStatus.SHARED -> "SHARED"
                        AgeSignalsStatus.NOT_SHARED -> "NOT_SHARED"
                        AgeSignalsStatus.VERIFICATION_REQUIRED -> "VERIFICATION_REQUIRED"
                        else -> "UNKNOWN"
                    }
                    recordDiagnostic("age_signals.access", label)
                    if (status == AgeSignalsStatus.SHARED) checkSharedSignals()
                    else finish(false, label.lowercase())
                }
                .addOnFailureListener { error ->
                    recordDiagnostic("age_signals.access_error", error.javaClass.simpleName)
                    finish(false, "unavailable")
                }
        } catch (_: Exception) {
            recordDiagnostic("age_signals.access_error", "exception")
            finish(false, "unavailable")
        }
    }

    private fun checkSharedSignals() {
        try {
            manager.checkAgeSignals(AgeSignalsRequest.builder().build())
                .addOnSuccessListener { result ->
                    val ageLower = result.ageLower() ?: -1
                    val ageUpper = result.ageUpper()
                    val eligibleSource = result.ageRangeSource() == AgeRangeSource.TIER_A ||
                        result.ageRangeSource() == AgeRangeSource.TIER_C ||
                        result.ageRangeSource() == AgeRangeSource.TIER_D
                    // This is restricted to owner-curated 18+ internal testers by
                    // the internalBeta build and Play's private tester allowlist.
                    // TIER_A is only a Google-reported, self-declared age; it is not
                    // treated as proof for general availability. TIER_B (supervised),
                    // child bands, unknowns, declined sharing and errors fail closed.
                    val eligible = eligibleSource && ageLower >= 18 && ageUpper == null
                    val source = when (result.ageRangeSource()) {
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
                    recordDiagnostic(
                        "age_signals.result",
                        "band=$band;source=$source;eligible=$eligible"
                    )
                    finish(eligible, if (eligible) "adult_signal" else "restricted")
                }
                .addOnFailureListener { error ->
                    recordDiagnostic("age_signals.result_error", error.javaClass.simpleName)
                    finish(false, "unavailable")
                }
        } catch (_: Exception) {
            recordDiagnostic("age_signals.result_error", "exception")
            finish(false, "unavailable")
        }
    }

    private fun recordDiagnostic(category: String, message: String) {
        // Keep only coarse status/source metadata in the opt-in local debug export.
        // Never persist a date of birth, exact age bounds, install ID, or exception text.
        try { TrialumDiagnostics.record(appContext, category, message) } catch (_: Exception) { }
    }

    private fun finish(eligible: Boolean, status: String) {
        adultEligible = eligible
        deliver(JSONObject().put("status", status).put("adultEligible", eligible))
    }
}
