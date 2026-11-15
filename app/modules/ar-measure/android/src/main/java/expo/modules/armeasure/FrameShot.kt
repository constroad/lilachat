package expo.modules.armeasure

import android.graphics.Bitmap
import android.graphics.Matrix as BitmapMatrix
import android.opengl.GLES20
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

/** Portal's photo standard (7727ee59): the long side at most 1600 px, JPEG. */
private const val LONG_SIDE_PX = 1600
private const val JPEG_QUALITY = 85
private const val RGBA = 4
private const val KEEP_MS = 24L * 60 * 60 * 1000

/**
 * The zone's photo is the AR's own frame with the trace on it (José 15/11:
 * «si se supone que ya lo marqué, ¿por qué me pide la foto?»). Read on the GL
 * thread right after drawing, before the frame is swapped.
 */
object FrameShot {
  fun save(width: Int, height: Int, folder: File): File? = try {
    val pixels = ByteBuffer.allocateDirect(width * height * RGBA).order(ByteOrder.nativeOrder())
    GLES20.glReadPixels(0, 0, width, height, GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, pixels)
    val raw = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).apply { copyPixelsFromBuffer(pixels) }
    val scale = minOf(1f, LONG_SIDE_PX.toFloat() / maxOf(width, height))
    // GL rows start at the bottom: flip, and shrink in the same pass.
    val turn = BitmapMatrix().apply { postScale(scale, -scale) }
    val photo = Bitmap.createBitmap(raw, 0, 0, width, height, turn, true)
    raw.recycle()
    // The shots of earlier zones already went to the report: the cache keeps only today's.
    folder.listFiles { old -> old.name.startsWith("zona-ar-") && System.currentTimeMillis() - old.lastModified() > KEEP_MS }?.forEach { it.delete() }
    val file = File(folder, "zona-ar-${System.currentTimeMillis()}.jpg")
    FileOutputStream(file).use { photo.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, it) }
    photo.recycle()
    file
  } catch (error: Exception) {
    null
  } catch (error: OutOfMemoryError) {
    null
  }
}
