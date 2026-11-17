package com.trialum.ziivaiskra

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.DocumentsContract
import android.provider.MediaStore
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

/**
 * Crash-resistant, non-destructive game-world backups.
 *
 * Internal rotating rescues are app-private and do NOT survive uninstall.
 * Android 29+ exports always INSERT a NEW Downloads/Trialum document.
 * No exporter ever opens a previously selected document for writing.
 * Every exported file is read back and SHA-256 verified before success.
 * No social credentials, Firebase token or model weights are included.
 */
internal class TrialumBackupVault(private val context: Context) {
    private val root = File(context.noBackupFilesDir, "trialum-world-rescue-v2")
    private val limit = 20 * 1024 * 1024
    private val keep = 16
    private val keepPinned = 4
    private val idRule = Regex("^rescue_(keep_)?[0-9_]+_[0-9a-f]{8}_[0-9a-f]{16}\\.json$")
    private val formatter = SimpleDateFormat("yyyyMMdd_HHmmss_SSS", Locale.US)

    private fun stamp(): String = synchronized(formatter) { formatter.format(Date()) }
    private fun digest(bytes: ByteArray): ByteArray =
        MessageDigest.getInstance("SHA-256").digest(bytes)

    private fun hex(bytes: ByteArray): String =
        bytes.joinToString("") { "%02x".format(it.toInt() and 255) }

    private fun inspect(bytes: ByteArray): JSONObject {
        require(bytes.size in 100..limit) { "World backup is empty or exceeds 20 MB." }
        val json = JSONObject(String(bytes, Charsets.UTF_8))
        require(json.optString("backupFormat") == "trialum") { "Not a Trialum world backup." }
        require(json.optJSONArray("pets") != null && json.optJSONArray("logs") != null) {
            "World backup is missing pets or history."
        }
        require(json.optInt("lastDay", -1) >= 0) { "World backup has no valid day." }
        return json
    }

    private fun verifyFile(file: File, expected: ByteArray) {
        require(file.length() == expected.size.toLong()) { "Backup size mismatch." }
        val hasher = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(65536)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                hasher.update(buffer, 0, count)
            }
        }
        require(MessageDigest.isEqual(hasher.digest(), digest(expected))) {
            "Backup read-back checksum mismatch."
        }
    }

    private fun verifiedRescue(file: File): ByteArray {
        require(file.isFile && file.length() in 100..limit.toLong()) { "Invalid rescue size." }
        require(idRule.matches(file.name)) { "Invalid rescue identifier." }
        val bytes = file.readBytes()
        require(hex(digest(bytes)).startsWith(file.name.removeSuffix(".json").substringAfterLast("_"))) {
            "Rescue SHA-256 mismatch."
        }
        inspect(bytes)
        return bytes
    }

    /** Atomic temp + fsync + rename, keeping older valid rescues untouched. */
    @Synchronized
    fun snapshot(bytes: ByteArray, pinned: Boolean = false): String {
        inspect(bytes)
        check(root.isDirectory || root.mkdirs()) { "Cannot create private rescue folder." }
        val name = (if (pinned) "rescue_keep_" else "rescue_") +
            stamp() + "_" + UUID.randomUUID().toString().take(8) +
            "_" + hex(digest(bytes)).take(16) + ".json"
        val pending = File(root, "." + name + ".part")
        val target = File(root, name)
        try {
            FileOutputStream(pending, false).use { output ->
                output.write(bytes)
                output.fd.sync()
            }
            verifyFile(pending, bytes)
            check(!target.exists() && pending.renameTo(target)) {
                "Could not atomically commit the rescue."
            }
            verifiedRescue(target)
            // Prune only after the latest rescue has been durably committed.
            root.listFiles()?.filter { idRule.matches(it.name) && it.isFile }
                ?.groupBy { it.name.startsWith("rescue_keep_") }
                ?.forEach { (isPinned, files) ->
                    files.sortedByDescending { it.lastModified() }
                        .drop(if (isPinned) keepPinned else keep)
                        .forEach { it.delete() }
                }
            return name
        } finally {
            pending.delete()
        }
    }

    @Synchronized
    fun entries(): JSONArray {
        val out = JSONArray()
        root.listFiles()?.filter { it.isFile && idRule.matches(it.name) }
            ?.sortedByDescending { it.lastModified() }
            ?.take(keep + keepPinned)
            ?.forEach { file ->
                try {
                    val world = JSONObject(String(verifiedRescue(file), Charsets.UTF_8))
                    out.put(JSONObject()
                        .put("id", file.name)
                        .put("pinned", file.name.startsWith("rescue_keep_"))
                        .put("day", world.optInt("lastDay"))
                        .put("pets", world.optJSONArray("pets")?.length() ?: 0)
                        .put("bytes", file.length())
                        .put("savedAt", file.lastModified()))
                } catch (_: Exception) { /* Corrupt rescue is never offered. */ }
            }
        return out
    }

    @Synchronized
    fun load(id: String): ByteArray {
        require(idRule.matches(id)) { "Invalid rescue identifier." }
        return verifiedRescue(File(root, id))
    }

    private fun uniqueName(hint: String): String {
        val stem = hint.removeSuffix(".json")
            .replace(Regex("[^A-Za-z0-9._-]"), "_")
            .trim('.', '_', '-')
            .take(54).ifEmpty { "TRIALUM-world" }
        return stem + "_" + stamp() + "_" + UUID.randomUUID().toString().take(8) + ".json"
    }

    private fun writeAndVerify(uri: Uri, bytes: ByteArray) {
        val resolver = context.contentResolver
        (resolver.openOutputStream(uri, "w") ?: error("Could not open new document.")).use {
            output -> output.write(bytes); output.flush()
        }
        val hasher = MessageDigest.getInstance("SHA-256")
        var length = 0L
        (resolver.openInputStream(uri) ?: error("Could not read back the new document.")).use { input ->
            val buffer = ByteArray(65536)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                length += count
                if (length > bytes.size) error("Exported backup is larger than source.")
                hasher.update(buffer, 0, count)
            }
        }
        check(length == bytes.size.toLong() &&
            MessageDigest.isEqual(hasher.digest(), digest(bytes))) {
            "Export failed verification: size or SHA-256 mismatch."
        }
    }

    /** API 29+: no picker and no overwrite; the new row is invisible until verified. */
    fun exportToDownloads(bytes: ByteArray, hint: String): String {
        require(Build.VERSION.SDK_INT >= 29)
        inspect(bytes)
        val name = uniqueName(hint)
        val resolver = context.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, name)
            put(MediaStore.MediaColumns.MIME_TYPE, "application/json")
            put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Trialum/")
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            ?: error("Cannot create a new backup in Downloads.")
        try {
            writeAndVerify(uri, bytes)
            val published = ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }
            check(resolver.update(uri, published, null, null) == 1) {
                "Could not publish verified backup."
            }
            return "Downloads/Trialum/" + name
        } catch (failure: Exception) {
            // ONLY the row inserted in this call can be deleted. Never touch older backups.
            try { resolver.delete(uri, null, null) } catch (_: Exception) {}
            throw failure
        }
    }

    /** API 26–28 fallback: CREATE a fresh document inside a chosen folder. */
    fun exportToFolder(tree: Uri, bytes: ByteArray, hint: String): String {
        inspect(bytes)
        val resolver = context.contentResolver
        val parent = DocumentsContract.buildDocumentUriUsingTree(
            tree, DocumentsContract.getTreeDocumentId(tree))
        val name = uniqueName(hint)
        val newUri = DocumentsContract.createDocument(resolver, parent, "application/json", name)
            ?: error("Could not create a new document in the chosen folder.")
        try {
            writeAndVerify(newUri, bytes)
            return name
        } catch (failure: Exception) {
            try { DocumentsContract.deleteDocument(resolver, newUri) } catch (_: Exception) {}
            throw failure
        }
    }
}
