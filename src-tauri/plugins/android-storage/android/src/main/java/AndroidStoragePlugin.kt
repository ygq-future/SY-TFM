package com.sy.tfm.androidstorage

import android.app.Activity
import android.content.ContentValues
import android.net.Uri
import android.provider.MediaStore
import android.webkit.MimeTypeMap
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File
import java.net.URLConnection
import java.security.MessageDigest

private enum class DownloadResource(val value: String) {
    FallbackMimeType("application/octet-stream"),
}

private enum class BackgroundImageResource(val value: String) {
    Directory("backgrounds"),
    FileStem("selected-background"),
    TemporarySuffix(".tmp"),
}

private const val MAX_BACKGROUND_IMAGE_BYTES = 20L * 1024L * 1024L

@InvokeArg
class PublishArgs {
    lateinit var sourcePath: String
    lateinit var displayName: String
    lateinit var relativeDirectory: String
}

@InvokeArg
class ImportImageArgs {
    lateinit var uri: String
}

@TauriPlugin
class AndroidStoragePlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun importImage(invoke: Invoke) {
        var temporaryFile: File? = null
        try {
            val args = invoke.parseArgs(ImportImageArgs::class.java)
            val uri = Uri.parse(args.uri)
            require(uri.scheme == "content") { "Selected image is not an Android content URI" }

            val resolver = activity.contentResolver
            val mimeType = resolver.getType(uri)?.lowercase()
                ?: throw IllegalArgumentException("Selected image has no MIME type")
            val extension = when (mimeType) {
                "image/png" -> "png"
                "image/jpeg" -> "jpg"
                "image/webp" -> "webp"
                "image/gif" -> "gif"
                "image/bmp", "image/x-ms-bmp" -> "bmp"
                "image/avif" -> "avif"
                else -> MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType)
                    ?.takeIf { it in setOf("png", "jpg", "jpeg", "webp", "gif", "bmp", "avif") }
                    ?: throw IllegalArgumentException("Unsupported background image type")
            }

            val destinationDirectory = File(
                activity.filesDir,
                BackgroundImageResource.Directory.value,
            ).apply { mkdirs() }
            require(destinationDirectory.isDirectory) {
                "Unable to create background image directory"
            }
            val stagingFile = File(
                destinationDirectory,
                BackgroundImageResource.FileStem.value + BackgroundImageResource.TemporarySuffix.value,
            )
            temporaryFile = stagingFile
            val digest = MessageDigest.getInstance("SHA-256")
            resolver.openInputStream(uri)?.use { input ->
                stagingFile.outputStream().use { output ->
                    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                    var totalBytes = 0L
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        totalBytes += read
                        require(totalBytes <= MAX_BACKGROUND_IMAGE_BYTES) {
                            "Background image exceeds 20 MB"
                        }
                        digest.update(buffer, 0, read)
                        output.write(buffer, 0, read)
                    }
                }
            } ?: throw IllegalStateException("Unable to read selected background image")

            val contentHash = digest.digest().joinToString("") { byte ->
                "%02x".format(byte.toInt() and 0xff)
            }
            val destination = File(
                destinationDirectory,
                "${BackgroundImageResource.FileStem.value}-${contentHash.take(16)}.$extension",
            )
            destinationDirectory.listFiles()?.forEach { existing ->
                if (existing != stagingFile && existing != destination) existing.delete()
            }
            if (destination.exists()) destination.delete()
            require(stagingFile.renameTo(destination)) {
                "Unable to persist selected background image"
            }
            temporaryFile = null

            val response = JSObject()
            response.put("path", destination.absolutePath)
            invoke.resolve(response)
        } catch (error: Exception) {
            temporaryFile?.delete()
            invoke.reject(error.message ?: "Unable to import Android background image")
        }
    }

    @Command
    fun publish(invoke: Invoke) {
        var insertedUri: android.net.Uri? = null
        try {
            val args = invoke.parseArgs(PublishArgs::class.java)
            val source = File(args.sourcePath)
            require(source.isFile) { "Download staging file does not exist" }

            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, args.displayName)
                put(
                    MediaStore.MediaColumns.MIME_TYPE,
                    URLConnection.guessContentTypeFromName(args.displayName)
                        ?: DownloadResource.FallbackMimeType.value,
                )
                put(MediaStore.MediaColumns.RELATIVE_PATH, args.relativeDirectory)
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
            val resolver = activity.contentResolver
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: throw IllegalStateException("Unable to create public download")
            insertedUri = uri
            resolver.openOutputStream(uri)?.use { output ->
                source.inputStream().use { input -> input.copyTo(output) }
            } ?: throw IllegalStateException("Unable to open public download")
            values.clear()
            values.put(MediaStore.MediaColumns.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            invoke.resolve()
        } catch (error: Exception) {
            insertedUri?.let { activity.contentResolver.delete(it, null, null) }
            invoke.reject(error.message ?: "Unable to publish Android download")
        }
    }
}
