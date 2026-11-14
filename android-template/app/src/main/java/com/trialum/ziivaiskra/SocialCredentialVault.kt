package com.trialum.ziivaiskra

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Device-only token vault. No password is written to world JSON, WebView
 * localStorage, external backups or logs. The Android Keystore key does not
 * leave this installation. An OS/device reset revokes access to old identity
 * unless an account recovery feature is explicitly built later.
 */
internal object SocialCredentialVault {
    private const val ALIAS = "trialum_social_identity_aes_v1"
    private const val PREFS = "trialum_social_v1"
    private const val TOKEN = "protected_credential"
    private const val NO_BACKUP_FILE = "trialum_social_credential_v1.enc"
    private val valid = Regex("^[A-Za-z0-9_-]{43}$")

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore")
        store.load(null)
        val previous = store.getKey(ALIAS, null)
        if (previous is SecretKey) return previous
        val generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore"
        )
        generator.init(
            KeyGenParameterSpec.Builder(
                ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }

    fun save(context: Context, credential: String): Boolean {
        if (!valid.matches(credential)) return false
        return try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, key())
            val encrypted = cipher.doFinal(credential.toByteArray(Charsets.UTF_8))
            val iv = cipher.iv
            if (iv.size !in 12..16) return false
            val packed = byteArrayOf(iv.size.toByte()) + iv + encrypted
            val encoded = Base64.encodeToString(packed, Base64.NO_WRAP)
            val file = java.io.File(context.noBackupFilesDir, NO_BACKUP_FILE)
            val temp = java.io.File(context.noBackupFilesDir, NO_BACKUP_FILE + ".tmp")
            temp.writeText(encoded, Charsets.UTF_8)
            if (!temp.renameTo(file)) {
                temp.delete()
                false
            } else {
                context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(TOKEN).apply()
                true
            }
        } catch (_: Exception) { false }
    }

    fun read(context: Context): String {
        return try {
            val file = java.io.File(context.noBackupFilesDir, NO_BACKUP_FILE)
            val encoded = if (file.exists()) file.readText(Charsets.UTF_8)
                else context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .getString(TOKEN, null) ?: return ""
            val packed = Base64.decode(encoded, Base64.DEFAULT)
            if (packed.size < 32) return ""
            val count = packed[0].toInt() and 0xff
            if (count !in 12..16 || packed.size < count + 17) return ""
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, packed.copyOfRange(1, 1 + count)))
            val result = String(cipher.doFinal(packed.copyOfRange(1 + count, packed.size)), Charsets.UTF_8)
            if (valid.matches(result)) {
                if (!file.exists()) save(context, result) // migrate older encrypted preferences
                result
            } else ""
        } catch (_: Exception) { "" }
    }

    fun clear(context: Context) {
        // Revoking private social identity must terminate any ongoing native
        // room conversations before the Keystore credential is destroyed.
        context.stopService(android.content.Intent(
            context, TrialumBackgroundSpeechService::class.java))
        java.io.File(context.noBackupFilesDir, NO_BACKUP_FILE).delete()
        java.io.File(context.noBackupFilesDir, NO_BACKUP_FILE + ".tmp").delete()
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().remove(TOKEN).apply()
    }
}
