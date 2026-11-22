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

    // Short-term raw daily snapshots are folded into month/year semantic summaries.
    // 45 days is now a resolution boundary, NOT a retention expiration.
    private const val RECENT_DAYS = 45
    private const val RECENT_ENTRIES = 60
    private const val MONTHS_AT_FULL_RESOLUTION = 24

    private fun periodMap(array: JSONArray?, field: String): MutableMap<String, JSONObject> {
        val result = linkedMapOf<String, JSONObject>()
        if (array == null) return result
        for (i in 0 until array.length()) {
            val item = array.optJSONObject(i) ?: continue
            val key = item.optString(field)
            if (key.isNotBlank() && !result.containsKey(key)) result[key] = item
        }
        return result
    }

    private fun mergeTags(destination: JSONObject, source: JSONObject, field: String, limit: Int) {
        val target = destination.optJSONArray(field) ?: JSONArray()
        val incoming = source.optJSONArray(field) ?: JSONArray()
        for (i in 0 until incoming.length()) {
            val value = incoming.optString(i).take(if (field == "topics") 24 else 24)
            if (value.isNotBlank() && target.length() < limit &&
                (0 until target.length()).none { target.optString(it) == value }) target.put(value)
        }
        destination.put(field, target)
    }

    private fun mergePeriod(
        store: MutableMap<String, JSONObject>, period: String, field: String, input: JSONObject
    ) {
        val item = store.getOrPut(period) {
            JSONObject().put(field, period).put("place", "shared")
                .put("topics", JSONArray()).put("companions", JSONArray()).put("moments", 0)
        }
        item.put("moments", (item.optLong("moments", 0) +
            input.optLong("moments", 0).coerceAtLeast(0)).coerceAtMost(1_000_000_000L))
        mergeTags(item, input, "topics", 16)
        mergeTags(item, input, "companions", 3)
    }

    private fun compact(state: JSONObject, today: LocalDate): JSONArray {
        val recent = mutableListOf<JSONObject>()
        val months = periodMap(state.optJSONArray("months"), "month")
        val years = periodMap(state.optJSONArray("years"), "year")
        val cutoff = today.minusDays(RECENT_DAYS.toLong()).toString()
        val raw = state.optJSONArray("entries") ?: JSONArray()
        for (i in 0 until raw.length()) {
            val entry = raw.optJSONObject(i) ?: continue
            val day = entry.optString("day")
            if (day.length != 10 || day > today.toString()) continue
            if (day < cutoff) mergePeriod(months, day.substring(0, 7), "month", entry)
            else recent.add(entry)
        }
        val monthLimit = today.withDayOfMonth(1)
            .minusMonths(MONTHS_AT_FULL_RESOLUTION.toLong()).toString().substring(0, 7)
        val monthKeys = months.keys.toList()
        for (month in monthKeys) {
            if (month < monthLimit) {
                val entry = months.remove(month) ?: continue
                mergePeriod(years, month.substring(0, 4), "year", entry)
            }
        }
        state.put("entries", JSONArray(recent.takeLast(RECENT_ENTRIES)))
        state.put("months", JSONArray(months.toSortedMap().values.toList()))
        state.put("years", JSONArray(years.toSortedMap().values.toList()))
        return state.optJSONArray("entries") ?: JSONArray()
    }

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
            .put("months", JSONArray())
            .put("years", JSONArray())
    }

    @Synchronized
    fun remember(context: Context, petId: String, companion: String, canonicalEnglish: String) {
        if (!safePet.matches(petId)) return
        val today = LocalDate.now()
        val state = data(context, petId)
        val retained = compact(state, today)
        var item: JSONObject? = null
        for (i in 0 until retained.length()) {
            val value = retained.optJSONObject(i)
            if (value?.optString("day") == today.toString()) { item = value; break }
        }
        if (item == null) {
            item = JSONObject().put("day", today.toString()).put("place", "shared")
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
        state.put("entries", retained)
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
        val state = data(context, petId)
        val before = state.toString()
        compact(state, LocalDate.now())
        val serialized = state.toString()
        if (before != serialized) {
            // A consolidation-only snapshot must be visible to the JS bridge as a new revision.
            state.put("revision", state.optLong("revision", 0L) + 1L)
            val updated = state.toString()
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putString("pet_" + petId, updated).commit()
            return updated
        }
        return serialized
    }
}
