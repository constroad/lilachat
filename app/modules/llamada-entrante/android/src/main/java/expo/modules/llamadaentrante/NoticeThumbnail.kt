package expo.modules.llamadaentrante

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

/** A thumbnail never needs more: the notification draws it at 64 dp. */
private const val MAX_SIDE_PX = 256
private const val MAX_BYTES = 2 * 1024 * 1024
private const val TIMEOUT_MS = 4_000
/** Thumbnails older than this are deleted when a new one is written. */
private const val KEEP_MS = 24 * 3_600_000L
/** expo-file-system's provider already shares the cache folder (`file_system_provider_paths`). */
private const val PROVIDER_SUFFIX = ".FileSystemFileProvider"

/**
 * The image of a sticker, photo, GIF or wink in its notification (pending 57,
 * José 22/10: it arrived as the word «Sticker»). Downloaded on the push's own
 * background thread, small, and if anything fails the notice goes without it.
 */
object NoticeThumbnail {
  fun load(url: String): Bitmap? {
    if (!url.startsWith("https://") && !url.startsWith("http://")) return null
    return try {
      val bytes = download(url) ?: return null
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
      var sample = 1
      while (bounds.outWidth / (sample * 2) >= MAX_SIDE_PX && bounds.outHeight / (sample * 2) >= MAX_SIDE_PX) sample *= 2
      BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
    } catch (_: Exception) {
      null
    }
  }

  /**
   * The thumbnail as a `content://` the system's notification shade can read,
   * so the message shows it inline like WhatsApp. `null` if it cannot be shared.
   */
  fun share(context: Context, bitmap: Bitmap, name: String): Uri? = try {
    val folder = File(context.cacheDir, "notice-thumbs").apply { mkdirs() }
    folder.listFiles()?.filter { System.currentTimeMillis() - it.lastModified() > KEEP_MS }?.forEach { it.delete() }
    val file = File(folder, "$name.png")
    FileOutputStream(file).use { stream -> bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream) }
    val uri = FileProvider.getUriForFile(context, context.packageName + PROVIDER_SUFFIX, file)
    context.grantUriPermission("com.android.systemui", uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
    uri
  } catch (_: Exception) {
    null
  }

  private fun download(url: String): ByteArray? {
    val connection = URL(url).openConnection() as HttpURLConnection
    connection.connectTimeout = TIMEOUT_MS
    connection.readTimeout = TIMEOUT_MS
    try {
      if (connection.responseCode !in 200..299 || connection.contentLength > MAX_BYTES) return null
      val out = ByteArrayOutputStream()
      connection.inputStream.use { input ->
        val buffer = ByteArray(16 * 1024)
        while (true) {
          val read = input.read(buffer)
          if (read < 0) break
          out.write(buffer, 0, read)
          if (out.size() > MAX_BYTES) return null
        }
      }
      return out.toByteArray()
    } finally {
      connection.disconnect()
    }
  }
}
