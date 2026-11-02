package expo.modules.shareinto

import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.core.content.IntentCompat

/** The text and files of a SEND or SEND_MULTIPLE, as plain maps for JS. UNTRUSTED: any app can send one. */
object SharedContent {
  private const val MAX_FILES = 10

  fun read(context: Context, intent: Intent?): Map<String, Any?>? {
    intent ?: return null
    if (intent.action != Intent.ACTION_SEND && intent.action != Intent.ACTION_SEND_MULTIPLE) return null
    // Opened from Recents, Android hands over the task's first intent again: that share was already attended.
    if (intent.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY != 0) return null
    val files = streams(intent).filter { isForeign(context, it) }.take(MAX_FILES).map { describe(context.contentResolver, it, intent.type) }
    val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()
    val subject = intent.getCharSequenceExtra(Intent.EXTRA_SUBJECT)?.toString()
    if (text.isNullOrBlank() && subject.isNullOrBlank() && files.isEmpty()) return null
    return mapOf("text" to text, "subject" to subject, "files" to files)
  }

  private fun streams(intent: Intent): List<Uri> {
    val fromExtras =
      if (intent.action == Intent.ACTION_SEND_MULTIPLE) IntentCompat.getParcelableArrayListExtra(intent, Intent.EXTRA_STREAM, Uri::class.java).orEmpty()
      else listOfNotNull(IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java))
    if (fromExtras.isNotEmpty()) return fromExtras
    // Some apps put the files only in the clip.
    val clip = intent.clipData ?: return emptyList()
    return (0 until clip.itemCount).mapNotNull { clip.getItemAt(it).uri }
  }

  /** Only another app's content: a `file://` or this app's own provider could hand over Lilachat's private files to upload. */
  private fun isForeign(context: Context, uri: Uri): Boolean =
    uri.scheme == ContentResolver.SCHEME_CONTENT && uri.authority?.startsWith(context.packageName) != true

  private fun describe(resolver: ContentResolver, uri: Uri, fallbackType: String?): Map<String, Any?> {
    var name: String? = null
    var size: Long? = null
    // A provider that refuses the query still lets the file be read: the name and size are only nice to have.
    runCatching {
      resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) {
          name = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME).takeIf { it >= 0 }?.let { cursor.getString(it) }
          size = cursor.getColumnIndex(OpenableColumns.SIZE).takeIf { it >= 0 && !cursor.isNull(it) }?.let { cursor.getLong(it) }
        }
      }
    }
    val type = runCatching { resolver.getType(uri) }.getOrNull() ?: fallbackType?.takeUnless { it.contains('*') }
    return mapOf("uri" to uri.toString(), "mimeType" to type, "name" to name, "size" to size?.toDouble())
  }
}
