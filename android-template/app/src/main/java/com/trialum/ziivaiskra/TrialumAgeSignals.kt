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
    private val manager: AgeSignalsManager =
        AgeSignalsManagerFactory.create(activity.applicationContext)
    @Volatile private var adultEligible = false

    fun isAdultEligible(): Boolean = adultEligible

    fun request(activity: Activity) {
        adultEligible = false
        try {
            val access = AgeSignalsAccessRequest.builder().setActivity(activity).build()
            manager.requestAgeSignalsAccess(access)
                .addOnSuccessListener { result ->
                    if (result.ageSignalsStatus() != AgeSignalsStatus.SHARED) {
                        finish(false, "not_shared")
                    } else {
                        checkSharedSignals()
                    }
                }
                .addOnFailureListener { finish(false, "unavailable") }
        } catch (_: Exception) {
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
                    finish(eligible, if (eligible) "adult_signal" else "restricted")
                }
                .addOnFailureListener { finish(false, "unavailable") }
        } catch (_: Exception) {
            finish(false, "unavailable")
        }
    }

    private fun finish(eligible: Boolean, status: String) {
        adultEligible = eligible
        deliver(JSONObject().put("status", status).put("adultEligible", eligible))
    }
}
