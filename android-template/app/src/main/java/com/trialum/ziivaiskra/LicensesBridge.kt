package com.trialum.ziivaiskra

import android.content.Context
import android.webkit.JavascriptInterface
import org.json.JSONObject

/**
 * User-invoked, entirely offline license reader for Trialum 1.4 v44.
 *
 * Every release includes the resolved Android runtime license inventory,
 * bundled OSS notices, model-download terms and license text. Missing one
 * optional asset must not suppress the others (legacy all-or-nothing bug).
 */
internal class LicensesBridge(private val context: Context) {
    @JavascriptInterface
    fun getNotices(): String {
        val root = "licenses/"
        fun optional(file: String): String =
            runCatching { readAsset(root + file) }.getOrElse {
                "[MISSING OFFLINE NOTICE: $file — rebuild the Android package with bundleOfflineLicenseNotices]"
            }

        val reportText = optional("ANDROID-DEPENDENCY-LICENSES.json")
        val inventory = runCatching {
            val dependencies = JSONObject(reportText).optJSONArray("dependencies")
            buildString {
                appendLine("ANDROID RUNTIME DEPENDENCIES — OFFLINE INVENTORY")
                if (dependencies == null || dependencies.length() == 0) {
                    appendLine("Dependency inventory is missing or empty. This build is NOT licensing-complete.")
                } else {
                    appendLine("Components: " + dependencies.length())
                    for (index in 0 until dependencies.length()) {
                        val item = dependencies.optJSONObject(index) ?: continue
                        append(item.optString("moduleName", "Unknown component"))
                        append(" ")
                        appendLine(item.optString("moduleVersion", ""))
                        val licenses = item.optJSONArray("moduleLicenses")
                        if (licenses != null && licenses.length() > 0) {
                            for (licenseIndex in 0 until licenses.length()) {
                                val license = licenses.optJSONObject(licenseIndex) ?: continue
                                append("  License: ")
                                appendLine(license.optString("moduleLicense", "Not declared"))
                                val url = license.optString("moduleLicenseUrl", "")
                                if (url.isNotBlank()) appendLine("  Publisher notice URL: $url")
                            }
                        } else {
                            append("  License: ")
                            appendLine(item.optString("moduleLicense", "Not declared"))
                            val url = item.optString("moduleLicenseUrl", "")
                            if (url.isNotBlank()) appendLine("  Publisher notice URL: $url")
                        }
                    }
                }
            }
        }.getOrElse {
            "ANDROID RUNTIME DEPENDENCIES — inventory not bundled. " +
                "See the offline notice file ANDROID-DEPENDENCY-LICENSES.json; " +
                "this APK requires a corrected build."
        }

        return listOf(
            "TRIALUM — Third-party software notices | 1.4 v44",
            "No network connection is needed to read these notices. " +
                "Optional GGUF models are NOT bundled in this APK.",
            "TRIALUM THIRD-PARTY SUMMARY",
            optional("THIRD-PARTY-NOTICES.txt"),
            "LLAMA-ANDROID 0.1.1 / LLAMA.CPP / GGML — UPSTREAM NOTICES",
            optional("llama-android-0.1.1/THIRD-PARTY-NOTICES.txt"),
            "LLAMA-ANDROID 0.1.1 — MIT",
            optional("llama-android-0.1.1/LICENSE"),
            "APACHE LICENSE 2.0 — OPTIONAL LOCAL MODEL DOWNLOADS",
            optional("APACHE-2.0.txt"),
            "ZZFX — MIT AUDIO LICENSE",
            optional("ZZFX-MIT.txt"),
            "MODEL SOURCE, PINNED VERSION, HASH AND LICENSE DISCLOSURES",
            optional("MODEL-LICENSES.md"),
            inventory
        ).joinToString("\n\n")
    }

    private fun readAsset(path: String): String =
        context.assets.open(path).bufferedReader(Charsets.UTF_8).use { it.readText() }
}
