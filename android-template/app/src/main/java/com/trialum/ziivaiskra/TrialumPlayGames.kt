package com.trialum.ziivaiskra

import android.app.Activity
import android.content.Intent
import android.util.Log
import com.google.android.gms.games.PlayGames
import com.google.android.gms.games.PlayGamesSdk
import com.google.android.gms.games.SnapshotsClient
import com.google.android.gms.games.snapshot.Snapshot
import com.google.android.gms.games.snapshot.SnapshotMetadataChange
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.security.MessageDigest
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream

/**
 * Optional Google Play Games Services v2 integration for the offline-first
 * TRIALUM WebView app. No app-account, web server, advertising or billing.
 *
 * - Missing Play Console IDs: all network operations remain disabled.
 * - Cloud is strictly opt-in; local JSON / IndexedDB work independently.
 * - Existing cloud data is never overwritten by an automatic upload unless
 *   its SHA-256 matches the baseline observed after a successful prior sync.
 * - Snapshot API conflicts are never auto-resolved (no latest-wins data loss).
 * - Cloud restore returns a candidate; JS validates, asks the user and saves
 *   locally before acknowledging it.
 */
class TrialumPlayGames(
    private val activity: MainActivity,
    private val emit: (JSONObject) -> Unit
) {
    private val prefs by lazy { activity.getSharedPreferences("trialum_play_games", Activity.MODE_PRIVATE) }
    private val configured by lazy {
        val id = activity.getString(R.string.game_services_project_id).trim()
        id.length >= 6 && id.all { it.isDigit() } && id != "0000000000" && id != "0"
    }
    @Volatile private var authenticated = false
    @Volatile private var playerId: String? = null
    @Volatile private var playerName: String? = null
    @Volatile private var busy = false
    private var pendingRestoreDigest: String? = null
    private var pendingRestorePlayerId: String? = null
    private val slot = "trialum_world_primary"
    private val maximumCompressedBytes = 2_850_000
    private val maximumPlainBytes = 12_000_000
    private val maxEventChars = 12_000_000

    private fun event(kind: String, message: String = "", extras: JSONObject? = null) {
        val data = JSONObject().put("kind", kind).put("message", message)
        if (extras != null) {
            val keys = extras.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                data.put(key, extras.get(key))
            }
        }
        emit(data)
    }

    private fun reason(e: Exception?): String {
        val value = e?.localizedMessage ?: e?.javaClass?.simpleName ?: "unknown"
        return value.take(180)
    }

    // Consent and upload baselines are tied to the authenticated gamer profile.
    private fun consent(): Boolean = playerId?.let { prefs.getBoolean("cloud_consent_" + it, false) } ?: false
    private fun baselineKey() = "sha_" + (playerId ?: "unknown")
    private fun baseline(): String = prefs.getString(baselineKey(), "") ?: ""
    private fun saveBaseline(digest: String) { prefs.edit().putString(baselineKey(), digest).apply() }
    private fun sha(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
        .digest(bytes).joinToString("") { "%02x".format(it.toInt() and 255) }

    private fun pack(worldJson: String): ByteArray {
        if (worldJson.length > maximumPlainBytes) throw IllegalArgumentException("World exceeds 12 MB")
        val state = JSONObject(worldJson)
        if (!state.has("version") || !state.has("pets") || !state.has("habitats")) {
            throw IllegalArgumentException("Invalid TRIALUM world")
        }
        val envelope = JSONObject()
            .put("format", "trialum-pgs-v1")
            .put("savedAt", System.currentTimeMillis())
            .put("worldId", worldId(state))
            .put("world", state)
        val bytes = envelope.toString().toByteArray(Charsets.UTF_8)
        if (bytes.size > maximumPlainBytes) throw IllegalArgumentException("World exceeds 12 MB")
        val stream = ByteArrayOutputStream()
        GZIPOutputStream(stream).use { it.write(bytes) }
        return stream.toByteArray().also {
            if (it.size > maximumCompressedBytes) throw IllegalArgumentException("Compressed cloud save exceeds 2.85 MB")
        }
    }

    private fun unpack(bytes: ByteArray): JSONObject? {
        if (bytes.isEmpty()) return null
        if (bytes.size > maximumCompressedBytes) throw IllegalArgumentException("Cloud file too large")
        val out = ByteArrayOutputStream()
        GZIPInputStream(ByteArrayInputStream(bytes)).use { stream ->
            val buffer = ByteArray(16 * 1024)
            var total = 0
            while (true) {
                val read = stream.read(buffer)
                if (read < 0) break
                total += read
                if (total > maximumPlainBytes) throw IllegalArgumentException("Cloud world exceeds 12 MB")
                out.write(buffer, 0, read)
            }
        }
        val envelope = JSONObject(out.toString(Charsets.UTF_8.name()))
        if (envelope.optString("format") != "trialum-pgs-v1") {
            throw IllegalArgumentException("Unsupported cloud save format")
        }
        if (envelope.optJSONObject("world") == null) {
            throw IllegalArgumentException("Cloud save has no world")
        }
        return envelope
    }

    private fun worldId(state: JSONObject): String =
        state.optLong("createdAt", 0).toString() + "-" + state.optLong("seed", 0)

    private fun summary(bytes: ByteArray): JSONObject {
        val data = unpack(bytes)
        if (data == null) return JSONObject().put("exists", false)
        val world = data.getJSONObject("world")
        return JSONObject()
            .put("exists", true)
            .put("worldId", data.optString("worldId", worldId(world)))
            .put("savedAt", data.optLong("savedAt"))
            .put("day", world.optInt("lastDay"))
            .put("pets", world.optJSONArray("pets")?.length() ?: 0)
            .put("version", world.optString("version"))
            .put("compressedBytes", bytes.size)
            .put("sha", sha(bytes))
    }

    private fun canUse(): Boolean {
        if (!configured) {
            event("unconfigured", "Play Console project ID and OAuth setup are required.")
            return false
        }
        if (!authenticated || playerId.isNullOrEmpty()) {
            event("signedOut", "Play Games is not authenticated.")
            return false
        }
        return true
    }

    fun status(): String = JSONObject()
        .put("configured", configured)
        .put("authenticated", authenticated)
        .put("playerName", playerName ?: JSONObject.NULL)
        .put("playerId", playerId ?: JSONObject.NULL)
        .put("cloudConsent", consent())
        .put("busy", busy)
        .toString()

    fun initialize() {
        if (!configured) {
            event("unconfigured", "Play Console setup pending; offline game remains available.")
            return
        }
        try {
            PlayGamesSdk.initialize(activity)
            refresh()
        } catch (e: Exception) {
            event("error", "Play Games initialization: " + reason(e))
        }
    }

    fun refresh() {
        if (!configured) { event("unconfigured"); return }
        PlayGames.getGamesSignInClient(activity).isAuthenticated()
            .addOnSuccessListener { auth ->
                authenticated = auth.isAuthenticated
                if (authenticated) loadPlayer()
                else {
                    playerId = null; playerName = null
                    pendingRestoreDigest = null; pendingRestorePlayerId = null
                    event("signedOut", "Play Games profile is optional.")
                }
            }
            .addOnFailureListener { e ->
                authenticated = false
                playerId = null; playerName = null
                pendingRestoreDigest = null; pendingRestorePlayerId = null
                event("error", "Play Games sign-in check: " + reason(e))
            }
    }

    fun signIn() {
        if (!configured) { event("unconfigured"); return }
        PlayGames.getGamesSignInClient(activity).signIn()
            .addOnSuccessListener { result ->
                authenticated = result.isAuthenticated
                if (authenticated) loadPlayer() else {
                    playerId = null; playerName = null
                    pendingRestoreDigest = null; pendingRestorePlayerId = null
                    event("signedOut")
                }
            }
            .addOnFailureListener { e -> event("error", "Play Games sign-in: " + reason(e)) }
    }

    private fun loadPlayer() {
        PlayGames.getPlayersClient(activity).currentPlayer
            .addOnSuccessListener { player ->
                if (playerId != player.playerId) {
                    pendingRestoreDigest = null; pendingRestorePlayerId = null
                }
                playerId = player.playerId
                playerName = player.displayName.take(70)
                event("signedIn", "", JSONObject()
                    .put("playerName", playerName)
                    .put("playerId", playerId)
                    .put("cloudConsent", consent()))
            }
            .addOnFailureListener { e ->
                authenticated = false
                event("error", "Play Games player: " + reason(e))
            }
    }

    fun cloudConsent(enabled: Boolean) {
        // Only the current authenticated gamer can enable their cloud backup.
        if (!canUse()) return
        prefs.edit().putBoolean("cloud_consent_" + playerId, enabled).apply()
        event("consent", "", JSONObject().put("cloudConsent", enabled))
        if (enabled) cloudCheck()
    }

    private fun withSnapshot(kind: String, create: Boolean = true, action: (Snapshot, ByteArray) -> Unit) {
        if (!canUse()) return
        if (busy) { event("busy", "Cloud operation already running."); return }
        busy = true
        val client = PlayGames.getSnapshotsClient(activity)
        client.open(slot, create, SnapshotsClient.RESOLUTION_POLICY_MANUAL)
            .addOnSuccessListener { result ->
                if (result.isConflict) {
                    busy = false
                    // The user has two distinct cloud histories. Never choose
                    // most-recent, highest-score or local automatically.
                    event("cloudConflict", "Google detected two conflicting cloud snapshots. Export JSON first. Cloud uploads are paused.")
                    return@addOnSuccessListener
                }
                val snapshot = result.data
                if (snapshot == null) {
                    busy = false
                    event("error", "Cloud snapshot was empty.")
                    return@addOnSuccessListener
                }
                try {
                    val existing = snapshot.snapshotContents.readFully() ?: ByteArray(0)
                    action(snapshot, existing)
                } catch (e: Exception) {
                    client.discardAndClose(snapshot)
                    busy = false
                    event("error", kind + ": " + reason(e))
                }
            }
            .addOnFailureListener { e ->
                busy = false
                event("error", kind + ": " + reason(e))
            }
    }

    fun cloudCheck() {
        withSnapshot("check") { snapshot, old ->
            val info = summary(old)
            info.put("matchesBaseline", old.isNotEmpty() && sha(old) == baseline())
            PlayGames.getSnapshotsClient(activity).discardAndClose(snapshot)
                .addOnCompleteListener {
                    busy = false
                    event("cloudStatus", "", info)
                }
        }
    }

    fun cloudSave(json: String, overwriteExplicitly: Boolean = false) {
        if (!consent()) { event("cloudDisabled", "Enable Cloud Save in Settings first."); return }
        if (json.length > maxEventChars) { event("error", "World too large for Cloud Save bridge."); return }
        val payload = try { pack(json) }
            catch (e: Exception) { event("error", "Cloud compression: " + reason(e)); return }
        withSnapshot("save") { snapshot, remote ->
            val fingerprint = if (remote.isEmpty()) "" else sha(remote)
            val expected = baseline()
            val incomingWorld = JSONObject(json)
            val existingWorld = if (remote.isNotEmpty()) unpack(remote)?.optJSONObject("world") else null
            val differentWorld = existingWorld != null && worldId(existingWorld) != worldId(incomingWorld)
            // Even the same device must never silently replace an existing
            // cloud world with a newly started / imported different world.
            if (remote.isNotEmpty() && (fingerprint != expected || differentWorld) && !overwriteExplicitly) {
                val info = summary(remote)
                PlayGames.getSnapshotsClient(activity).discardAndClose(snapshot)
                    .addOnCompleteListener {
                        busy = false
                        event("cloudDiverged", "A different cloud world exists. Choose restore or explicitly replace it.", info)
                    }
                return@withSnapshot
            }
            snapshot.snapshotContents.writeBytes(payload)
            val data = JSONObject(json)
            val metadata = SnapshotMetadataChange.Builder()
                .setDescription("TRIALUM · Day " + data.optInt("lastDay") + " · " + data.optJSONArray("pets")?.length() + " pets")
                .setPlayedTimeMillis(data.optLong("lastDay", 1L) * 60_000L)
                .build()
            PlayGames.getSnapshotsClient(activity).commitAndClose(snapshot, metadata)
                .addOnSuccessListener {
                    saveBaseline(sha(payload))
                    busy = false
                    event("cloudSaved", "Local snapshot queued for Play Games cloud sync.",
                        JSONObject().put("day", data.optInt("lastDay")).put("bytes", payload.size))
                }
                .addOnFailureListener { e ->
                    busy = false
                    event("error", "Cloud save commit: " + reason(e))
                }
        }
    }

    fun cloudRestore() {
        pendingRestoreDigest = null; pendingRestorePlayerId = null
        withSnapshot("restore") { snapshot, remote ->
            val data = unpack(remote)
            if (data == null) {
                PlayGames.getSnapshotsClient(activity).discardAndClose(snapshot).addOnCompleteListener {
                    busy = false
                    event("cloudStatus", "", JSONObject().put("exists", false))
                }
                return@withSnapshot
            }
            val world = data.getJSONObject("world")
            val bytes = world.toString()
            if (bytes.length > maxEventChars) throw IllegalArgumentException("Restore payload too large")
            val digest = sha(remote)
            val info = summary(remote)
            PlayGames.getSnapshotsClient(activity).discardAndClose(snapshot)
                .addOnCompleteListener { result ->
                    busy = false
                    if (result.isSuccessful) {
                        pendingRestoreDigest = digest
                        pendingRestorePlayerId = playerId
                        info.put("world", world)
                        event("cloudCandidate", "Validate and confirm restore before changing local game.", info)
                    } else event("error", "Could not close cloud snapshot.")
                }
        }
    }

    fun confirmRestored(digest: String) {
        if (authenticated && playerId != null && pendingRestorePlayerId == playerId &&
            pendingRestoreDigest == digest && digest.length == 64) {
            saveBaseline(digest)
            pendingRestoreDigest = null; pendingRestorePlayerId = null
            event("cloudRestored", "Restored cloud save was safely stored locally.")
        }
    }

    fun showAchievements() {
        if (!canUse()) return
        PlayGames.getAchievementsClient(activity).achievementsIntent
            .addOnSuccessListener { intent: Intent -> activity.startActivityForResult(intent, 1804) }
            .addOnFailureListener { e -> event("error", "Achievements: " + reason(e)) }
    }

    fun showLeaderboards() {
        if (!canUse()) return
        PlayGames.getLeaderboardsClient(activity).allLeaderboardsIntent
            .addOnSuccessListener { intent: Intent -> activity.startActivityForResult(intent, 1805) }
            .addOnFailureListener { e -> event("error", "Leaderboards: " + reason(e)) }
    }

    private fun achievementResource(key: String): Int? {
        val keys = setOf("first_pet", "first_plant", "learned", "advanced", "ecology", "lab6", "dna")
        if (key !in keys) return null
        val id = activity.resources.getIdentifier("pgs_achievement_" + key, "string", activity.packageName)
        return if (id != 0) id else null
    }

    fun unlockAchievement(key: String) {
        if (!authenticated || !configured) return
        val resource = achievementResource(key) ?: return
        val id = activity.getString(resource).trim()
        if (id.isEmpty()) return
        try { PlayGames.getAchievementsClient(activity).unlock(id) }
        catch (e: Exception) { Log.w("TrialumPGS", "Achievement update unavailable", e) }
    }

    fun submitScore(key: String, value: Long) {
        if (!authenticated || !configured || value < 0 || value > 2_000_000_000L) return
        if (key != "xp" && key != "species") return
        val resId = activity.resources.getIdentifier("pgs_leaderboard_" + key, "string", activity.packageName)
        if (resId == 0) return
        val boardId = activity.getString(resId).trim()
        if (boardId.isBlank()) return
        try { PlayGames.getLeaderboardsClient(activity).submitScore(boardId, value) }
        catch (e: Exception) { Log.w("TrialumPGS", "Score submission unavailable", e) }
    }
}
