package com.trialum.ziivaiskra

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.util.UUID

/**
 * Device-only, compact background speech observations: never store a transcript,
 * network token, room ID, prompts, or another account identifier.
 * A fresh installation receives a new stream ID; world JSON imports are idempotent.
 */
internal object BackgroundPetMemory {
    private const val PREFS = "trialum_background_ai_memory_v1"
    private const val MAX_DAYS = 45
    private const val MAX_ENTRIES = 60
    private val safePet = Regex("^[A-Za-z0-9_-]{1,64}$")
    private val safeName = Regex("^[^<>\\r\\n\\t]{1,24}$")
    private val topics = listOf(
        "slide" to Regex("slide", RegexOption.IGNORE_CASE),
        "seesaw" to Regex("seesaw", RegexOption.IGNORE_CASE),
        "sandbox" to Regex("sand|sandbox", RegexOption.IGNORE_CASE),
        "water" to Regex("water|pool|swim", RegexOption.IGNORE_CASE),
        "jump" to Regex("jump|bounce|trampoline", RegexOption.IGNORE_CASE),
        "obstacle" to Regex("obstacle|path", RegexOption.IGNORE_CASE),
        "explore" to Regex("explor|discover|mystery", RegexOption.IGNORE_CASE),
        "music" to Regex("music|sing|song", RegexOption.IGNORE_CASE),
        "nature" to Regex("nature|flower|tree|garden|grass", RegexOption.IGNORE_CASE),
        "riddle" to Regex("riddle|question|puzzle", RegexOption.IGNORE_CASE),
        "stars" to Regex("star|spark|glow", RegexOption.IGNORE_CASE),
        "food" to Regex("food|snack|eat|hungry", RegexOption.IGNORE_CASE),
        "rest" to Regex("rest|sleep|tired", RegexOption.IGNORE_CASE),
        "emotion" to Regex("happy|laugh|joy|sad|feeling", RegexOption.IGNORE_CASE),
        "toys" to Regex("toy|playground|play", RegexOption.IGNORE_CASE),
        "friendship" to Regex("friend|together", RegexOption.IGNORE_CASE)
    )

    private fun data(context: Context, petId: String): JSONObject {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val raw = prefs.getString("pet_" + petId, null)
        if (raw != null) {
            val parsed = runCatching { JSONObject(raw) }.getOrNull()
            if (parsed?.optString("petId") == petId &&
                parsed.optString("streamId").matches(
                    Regex("^[0-9a-fA-F-]{36}$"))) return parsed
        }
        return JSONObject()
            .put("petId", petId)
            .put("streamId", UUID.randomUUID().toString())
            .put("revision", 0)
            .put("entries", JSONArray())
    }

    @Synchronized
    fun remember(context: Context, petId: String, companion: String, canonicalEnglish: String) {
        if (!safePet.matches(petId)) return
        val day = LocalDate.now()
        val state = data(context, petId)
        val entries = state.optJSONArray("entries") ?: JSONArray()
        val retained = JSONArray()
        val cutoff = day.minusDays(MAX_DAYS.toLong()).toString()
        for (i in 0 until entries.length()) {
            val value = entries.optJSONObject(i) ?: continue
            val key = value.optString("day")
            if (key.length == 10 && key >= cutoff && key <= day.toString())
                retained.put(value)
        }
        var item: JSONObject? = null
        for (i in 0 until retained.length()) {
            val value = retained.optJSONObject(i)
            if (value?.optString("day") == day.toString()) { item = value; break }
        }
        if (item == null) {
            item = JSONObject().put("day", day.toString()).put("place", "shared")
                .put("topics", JSONArray()).put("companions", JSONArray()).put("moments", 0)
            retained.put(item)
        }
        val seenTopics = item.optJSONArray("topics") ?: JSONArray()
        val hit = topics.filter { it.second.containsMatchIn(canonicalEnglish.take(160)) }
            .map { it.first }.take(6)
        for (tag in hit) {
            if ((0 until seenTopics.length()).none { seenTopics.optString(it) == tag } &&
                seenTopics.length() < 6) seenTopics.put(tag)
        }
        if (seenTopics.length() == 0) seenTopics.put("friendship")
        item.put("topics", seenTopics)
        val names = item.optJSONArray("companions") ?: JSONArray()
        val name = companion.trim().take(24)
        if (safeName.matches(name) && !name.contains('@') &&
            !name.contains(Regex("(?i)https?://|www\\.")) &&
            (0 until names.length()).none { names.optString(it) == name } && names.length() < 3)
            names.put(name)
        item.put("companions", names)
        item.put("moments", (item.optInt("moments") + 1).coerceAtMost(99))
        state.put("entries", JSONArray(
            (0 until retained.length()).mapNotNull { retained.optJSONObject(it) }
                .takeLast(MAX_ENTRIES)))
        state.put("revision", state.optLong("revision", 0L) + 1L)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString("pet_" + petId, state.toString()).commit()
    }

    @Synchronized
    fun clear(context: Context, petId: String) {
        if (!safePet.matches(petId)) return
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().remove("pet_" + petId).commit()
    }

    @Synchronized
    fun snapshot(context: Context, petId: String): String {
        if (!safePet.matches(petId)) return "{}"
        return data(context, petId).toString()
    }
}
