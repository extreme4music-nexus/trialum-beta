package com.trialum.ziivaiskra

import android.app.AlertDialog
import android.content.Context
import android.webkit.JavascriptInterface
import java.io.BufferedReader
import java.io.InputStreamReader

/** User-invoked, offline display of bundled third-party notices. */
internal class LicensesBridge(private val context: Context) {
    @JavascriptInterface
    fun show() {
        (context as? android.app.Activity)?.runOnUiThread {
            try {
                val root = "licenses/"
                val notice = readAsset(root + "THIRD-PARTY-NOTICES.txt")
                val mit = readAsset(root + "llama-android-0.1.1/LICENSE")
                val text = notice + "\n\n" + mit
                AlertDialog.Builder(context)
                    .setTitle(context.getString(R.string.third_party_licenses))
                    .setMessage(text)
                    .setPositiveButton(android.R.string.ok, null)
                    .show()
            } catch (_: Exception) {
                AlertDialog.Builder(context)
                    .setTitle(context.getString(R.string.third_party_licenses))
                    .setMessage("The bundled license notices could not be opened.")
                    .setPositiveButton(android.R.string.ok, null)
                    .show()
            }
        }
    }

    private fun readAsset(path: String): String =
        context.assets.open(path).use { input ->
            BufferedReader(InputStreamReader(input, Charsets.UTF_8)).readText()
        }
}
