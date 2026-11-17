package com.trialum.ziivaiskra

import android.content.Context

/** Native Android copy follows the language selected by the game WebView. */
internal object TrialumNativeText {
    fun get(context: Context, macedonian: String, english: String): String {
        val language = context.getSharedPreferences("trialum", Context.MODE_PRIVATE)
            .getString("uiLanguage", "en")
        return if (language == "mk") macedonian else english
    }
}
