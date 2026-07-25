package com.sy.tfm.securestorage

import android.app.Activity
import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.nio.ByteBuffer
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

private enum class SecureStorageResource(val value: String) {
    KeyStoreProvider("AndroidKeyStore"),
    KeyAlias("com.sy.tfm.device-secrets"),
    Preferences("sy_tfm_secure_storage"),
    CipherTransformation("AES/GCM/NoPadding"),
}

@InvokeArg
class AccountArgs {
    lateinit var account: String
}

@InvokeArg
class SetArgs {
    lateinit var account: String
    lateinit var value: String
}

@TauriPlugin
class SecureStoragePlugin(private val activity: Activity) : Plugin(activity) {
    private val preferences by lazy {
        activity.getSharedPreferences(
            SecureStorageResource.Preferences.value,
            Context.MODE_PRIVATE,
        )
    }

    @Command
    fun get(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(AccountArgs::class.java)
            val response = JSObject()
            response.put("value", preferences.getString(args.account, null)?.let(::decrypt))
            invoke.resolve(response)
        } catch (error: Exception) {
            invoke.reject(error.message ?: "Unable to read Android secure storage")
        }
    }

    @Command
    fun set(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(SetArgs::class.java)
            if (!preferences.edit().putString(args.account, encrypt(args.value)).commit()) {
                throw IllegalStateException("Unable to persist Android secure storage")
            }
            invoke.resolve()
        } catch (error: Exception) {
            invoke.reject(error.message ?: "Unable to write Android secure storage")
        }
    }

    @Command
    fun delete(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(AccountArgs::class.java)
            if (!preferences.edit().remove(args.account).commit()) {
                throw IllegalStateException("Unable to update Android secure storage")
            }
            invoke.resolve()
        } catch (error: Exception) {
            invoke.reject(error.message ?: "Unable to delete Android secure storage")
        }
    }

    private fun encrypt(value: String): String {
        val cipher = Cipher.getInstance(SecureStorageResource.CipherTransformation.value)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        val ciphertext = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        val payload = ByteBuffer.allocate(Int.SIZE_BYTES + cipher.iv.size + ciphertext.size)
            .putInt(cipher.iv.size)
            .put(cipher.iv)
            .put(ciphertext)
            .array()
        return Base64.encodeToString(payload, Base64.NO_WRAP)
    }

    private fun decrypt(encoded: String): String {
        val payload = ByteBuffer.wrap(Base64.decode(encoded, Base64.NO_WRAP))
        val ivLength = payload.int
        require(ivLength in 12..16 && payload.remaining() > ivLength) {
            "Invalid Android secure storage payload"
        }
        val iv = ByteArray(ivLength)
        payload.get(iv)
        val ciphertext = ByteArray(payload.remaining())
        payload.get(ciphertext)
        val cipher = Cipher.getInstance(SecureStorageResource.CipherTransformation.value)
        cipher.init(
            Cipher.DECRYPT_MODE,
            getOrCreateKey(),
            javax.crypto.spec.GCMParameterSpec(128, iv),
        )
        return String(cipher.doFinal(ciphertext), Charsets.UTF_8)
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance(SecureStorageResource.KeyStoreProvider.value).apply {
            load(null)
        }
        val alias = SecureStorageResource.KeyAlias.value
        (keyStore.getKey(alias, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            SecureStorageResource.KeyStoreProvider.value,
        )
        generator.init(
            KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build(),
        )
        return generator.generateKey()
    }
}
