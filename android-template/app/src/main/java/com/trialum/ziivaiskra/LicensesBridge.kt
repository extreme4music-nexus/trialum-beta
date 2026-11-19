package com.trialum.ziivaiskra

import android.content.Context
import android.webkit.JavascriptInterface
import org.json.JSONObject

/** User-invoked, offline display of notices and the exact build dependency inventory. */
internal class LicensesBridge(private val context: Context) {
    @JavascriptInterface
    fun getNotices(): String = try {
        val root = "licenses/"
        val notice = readAsset(root + "THIRD-PARTY-NOTICES.txt")
        val llamaLicense = readAsset(root + "llama-android-0.1.1/LICENSE")
        val modelLicenses = readAsset(root + "MODEL-LICENSES.md")
        val report = JSONObject(readAsset(root + "ANDROID-DEPENDENCY-LICENSES.json"))
        val dependencies = report.optJSONArray("dependencies")
        val inventory = buildString {
            appendLine("Android runtime dependencies included in this build")
            if (dependencies == null || dependencies.length() == 0) {
                appendLine("The dependency inventory is unavailable.")
            } else {
                for (index in 0 until dependencies.length()) {
                    val item = dependencies.optJSONObject(index) ?: continue
                    append(item.optString("moduleName", "Unknown component"))
                    append(" ")
                    appendLine(item.optString("moduleVersion", ""))
                    val licenses = item.optJSONArray("moduleLicenses")
                    if (licenses != null) {
                        for (licenseIndex in 0 until licenses.length()) {
                            val license = licenses.optJSONObject(licenseIndex) ?: continue
                            append("  License: ")
                            appendLine(license.optString("moduleLicense", "Not declared"))
                            val url = license.optString("moduleLicenseUrl", "")
                            if (url.isNotBlank()) {
                                append("  License text: ")
                                appendLine(url)
                            }
                        }
                    } else {
                        append("  License: ")
                        appendLine(item.optString("moduleLicense", "Not declared"))
                        val url = item.optString("moduleLicenseUrl", "")
                        if (url.isNotBlank()) {
                            append("  License text: ")
                            appendLine(url)
                        }
                    }
                }
            }
        }
        listOf(
            "TRIALUM — Third-party software notices",
            notice,
            "llama-android 0.1.1 — MIT license",
            llamaLicense,
            modelLicenses,
            inventory
        ).joinToString("\n\n")
    } catch (_: Exception) {
        "The bundled third-party license notices could not be opened. Please check the release-specific notices and dependency license report."
    }

    private fun readAsset(path: String): String =
        context.assets.open(path).bufferedReader(Charsets.UTF_8).use { it.readText() }
}
