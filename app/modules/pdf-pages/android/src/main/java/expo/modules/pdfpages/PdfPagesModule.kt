package expo.modules.pdfpages

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import kotlin.math.roundToInt

/** Bitmap ceiling per page: past it the page is drawn smaller instead of running out of memory. */
private const val MAX_PIXELS = 6_000_000
private const val JPEG_QUALITY = 88

/**
 * PDFs inside Lilachat (pending 7): Android's PdfRenderer draws each page to a
 * JPEG in the cache, only when the screen asks for it, and the viewer shows it
 * as an image. PdfRenderer opens one page at a time and is not thread-safe, so
 * everything runs on one worker thread.
 */
class PdfPagesModule : Module() {
  private class OpenDocument(val descriptor: ParcelFileDescriptor, val renderer: PdfRenderer, val folder: File)

  private val context get() = requireNotNull(appContext.reactContext) { "No Android context" }
  private val worker = Executors.newSingleThreadExecutor()
  private val documents = ConcurrentHashMap<String, OpenDocument>()

  override fun definition() = ModuleDefinition {
    Name("PdfPages")

    /** Opens a local PDF (`file://`) and answers its id and the size of every page. */
    AsyncFunction("open") { uri: String, promise: Promise ->
      worker.execute {
        try {
          val file = File(requireNotNull(Uri.parse(uri).path) { "Not a file uri" })
          val descriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
          val renderer = try {
            PdfRenderer(descriptor)
          } catch (error: Exception) {
            descriptor.close()
            throw error
          }
          val pages = (0 until renderer.pageCount).map { index ->
            val page = renderer.openPage(index)
            try {
              mapOf("width" to page.width, "height" to page.height)
            } finally {
              page.close()
            }
          }
          val id = UUID.randomUUID().toString()
          val folder = File(context.cacheDir, "pdf-pages/$id").apply { mkdirs() }
          documents[id] = OpenDocument(descriptor, renderer, folder)
          promise.resolve(mapOf("id" to id, "pages" to pages))
        } catch (error: SecurityException) {
          // A password-protected PDF: PdfRenderer cannot open it.
          promise.reject("ERR_PDF_PROTECTED", "This PDF has a password", error)
        } catch (error: Exception) {
          promise.reject("ERR_PDF_OPEN", error.message ?: "Could not open the PDF", error)
        }
      }
    }

    /** Draws one page `width` pixels wide on white; a page already drawn at that width is reused. */
    AsyncFunction("renderPage") { id: String, index: Int, width: Int, promise: Promise ->
      worker.execute {
        val document = documents[id]
        if (document == null) {
          promise.reject("ERR_PDF_CLOSED", "The PDF is closed", null)
          return@execute
        }
        try {
          promise.resolve(render(document, index, width))
        } catch (error: Exception) {
          promise.reject("ERR_PDF_RENDER", error.message ?: "Could not draw the page", error)
        }
      }
    }

    /** Closes the PDF and deletes its drawn pages. */
    AsyncFunction("close") { id: String ->
      worker.execute { documents.remove(id)?.let(::release) }
    }

    OnDestroy {
      worker.execute {
        documents.values.forEach(::release)
        documents.clear()
      }
    }
  }

  private fun render(document: OpenDocument, index: Int, requestedWidth: Int): Map<String, Any> {
    val page = document.renderer.openPage(index)
    try {
      val ratio = page.height.toDouble() / page.width.coerceAtLeast(1)
      var width = requestedWidth.coerceAtLeast(1)
      if (width * width * ratio > MAX_PIXELS) width = Math.sqrt(MAX_PIXELS / ratio).toInt()
      val height = (width * ratio).roundToInt().coerceAtLeast(1)
      val target = File(document.folder, "$index-$width.jpg")
      if (!target.exists()) {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        try {
          // PDF pages are transparent: without white the text sits on black.
          bitmap.eraseColor(Color.WHITE)
          page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
          FileOutputStream(target).use { stream -> bitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, stream) }
        } finally {
          bitmap.recycle()
        }
      }
      return mapOf("uri" to Uri.fromFile(target).toString(), "width" to width, "height" to height)
    } finally {
      page.close()
    }
  }

  private fun release(document: OpenDocument) {
    runCatching { document.renderer.close() }
    runCatching { document.descriptor.close() }
    document.folder.deleteRecursively()
  }
}
