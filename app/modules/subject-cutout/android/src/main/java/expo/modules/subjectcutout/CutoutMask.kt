package expo.modules.subjectcutout

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.media.ExifInterface
import android.net.Uri
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.nio.FloatBuffer
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * The cutout as a MASK over a working copy of the photo (José, 20/10:
 * «WhatsApp's is better, and there is no eraser for what I don't want»).
 *
 * - The working copy is oriented (EXIF) and at most `WORK_SIDE` px: the mask,
 *   the brushes and the sticker share its pixels.
 * - The mask comes from ML Kit's confidence: soft edges (`EDGE_LOW`..`EDGE_HIGH`)
 *   and only the big pieces (a loose hand from the laptop used to stay).
 * - `refine` applies the erase/restore strokes and crops to what is visible.
 */
object CutoutMask {
  private const val WORK_SIDE = 1280
  private const val JPEG_QUALITY = 92
  /** Confidence where the edge starts and where it is fully opaque. */
  private const val EDGE_LOW = 0.4f
  private const val EDGE_HIGH = 0.6f
  /** A piece smaller than this share of the biggest one is dropped. */
  private const val KEEP_RATIO = 0.12f
  private const val MIN_ALPHA = 12

  data class Photo(val file: File, val width: Int, val height: Int)
  data class Refined(val file: File, val width: Int, val height: Int, val box: Rect)
  data class Stroke(val erase: Boolean, val radius: Float, val xs: FloatArray, val ys: FloatArray)

  /** The oriented, reduced copy of the picked photo (JPEG in the cache). */
  fun preparePhoto(context: Context, uri: String): Photo {
    val open = { context.contentResolver.openInputStream(Uri.parse(uri)) ?: error("Could not open the photo") }
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    open().use { BitmapFactory.decodeStream(it, null, bounds) }
    var sample = 1
    while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= WORK_SIDE) sample *= 2
    val decoded = open().use { BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample }) } ?: error("Could not read the photo")
    val rotation = open().use { ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) }
    val factor = minOf(1f, WORK_SIDE.toFloat() / max(decoded.width, decoded.height))
    val matrix = Matrix().apply {
      postScale(factor, factor)
      when (rotation) {
        ExifInterface.ORIENTATION_ROTATE_90 -> postRotate(90f)
        ExifInterface.ORIENTATION_ROTATE_180 -> postRotate(180f)
        ExifInterface.ORIENTATION_ROTATE_270 -> postRotate(270f)
        ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> postScale(-1f, 1f)
      }
    }
    val photo = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
    val file = File(context.cacheDir, "sticker-photo-${System.currentTimeMillis()}.jpg")
    FileOutputStream(file).use { photo.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, it) }
    return Photo(file, photo.width, photo.height)
  }

  /** The mask from ML Kit's confidence: soft edges, loose small pieces removed. `null` if nothing is left. */
  fun fromConfidence(confidence: FloatBuffer, width: Int, height: Int): Bitmap? {
    val values = FloatArray(width * height)
    confidence.rewind()
    confidence.get(values)
    val labels = IntArray(values.size)
    val areas = labelPieces(values, width, height, labels)
    val biggest = areas.maxOrNull() ?: 0
    if (biggest == 0) return null
    val pixels = IntArray(values.size)
    for (index in values.indices) {
      val label = labels[index]
      if (label == 0 || areas[label - 1] < biggest * KEEP_RATIO) continue
      val alpha = smoothstep(values[index])
      pixels[index] = ((alpha * 255).roundToInt() shl 24) or 0x00FFFFFF
    }
    return Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888)
  }

  /** Connected pieces (4 neighbours) above the edge start; returns each piece's area (label = index + 1). */
  private fun labelPieces(values: FloatArray, width: Int, height: Int, labels: IntArray): List<Int> {
    val areas = ArrayList<Int>()
    val queue = IntArray(values.size)
    for (start in values.indices) {
      if (values[start] < EDGE_LOW || labels[start] != 0) continue
      val label = areas.size + 1
      var head = 0
      var tail = 0
      queue[tail++] = start
      labels[start] = label
      fun visit(next: Int) {
        if (labels[next] != 0 || values[next] < EDGE_LOW) return
        labels[next] = label
        queue[tail++] = next
      }
      while (head < tail) {
        val pixel = queue[head++]
        val x = pixel % width
        val y = pixel / width
        if (x > 0) visit(pixel - 1)
        if (x < width - 1) visit(pixel + 1)
        if (y > 0) visit(pixel - width)
        if (y < height - 1) visit(pixel + width)
      }
      areas.add(tail)
    }
    return areas
  }

  private fun smoothstep(value: Float): Float {
    val t = ((value - EDGE_LOW) / (EDGE_HIGH - EDGE_LOW)).coerceIn(0f, 1f)
    return t * t * (3 - 2 * t)
  }

  fun saveMask(context: Context, mask: Bitmap): File {
    val file = File(context.cacheDir, "sticker-mask-${System.currentTimeMillis()}.png")
    FileOutputStream(file).use { mask.compress(Bitmap.CompressFormat.PNG, 100, it) }
    return file
  }

  /** The photo through the mask (or whole, without one) with the brushes applied, cropped to what is visible. */
  fun refine(context: Context, photoUri: String, maskUri: String?, strokes: List<Stroke>): Refined? {
    val photo = decode(context, photoUri)
    val mask = Bitmap.createBitmap(photo.width, photo.height, Bitmap.Config.ARGB_8888)
    val maskCanvas = Canvas(mask)
    if (maskUri == null) mask.eraseColor(Color.WHITE) else maskCanvas.drawBitmap(decode(context, maskUri), null, Rect(0, 0, photo.width, photo.height), Paint(Paint.FILTER_BITMAP_FLAG))
    strokes.forEach { drawStroke(maskCanvas, it) }
    val output = Bitmap.createBitmap(photo.width, photo.height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(output)
    canvas.drawBitmap(mask, 0f, 0f, null)
    canvas.drawBitmap(photo, 0f, 0f, Paint().apply { xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN) })
    val box = visibleBox(output) ?: return null
    val cropped = Bitmap.createBitmap(output, box.left, box.top, box.width(), box.height())
    val file = File(context.cacheDir, "sticker-cutout-${System.currentTimeMillis()}.png")
    Composition.savePng(cropped, file)
    return Refined(file, cropped.width, cropped.height, box)
  }

  /** Erase clears the mask, restore paints it opaque; a single point is a dot. */
  private fun drawStroke(canvas: Canvas, stroke: Stroke) {
    if (stroke.xs.isEmpty()) return
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.WHITE
      strokeWidth = stroke.radius * 2
      strokeCap = Paint.Cap.ROUND
      strokeJoin = Paint.Join.ROUND
      if (stroke.erase) xfermode = PorterDuffXfermode(PorterDuff.Mode.CLEAR)
    }
    if (stroke.xs.size == 1) {
      paint.style = Paint.Style.FILL
      canvas.drawCircle(stroke.xs[0], stroke.ys[0], stroke.radius, paint)
      return
    }
    paint.style = Paint.Style.STROKE
    val path = Path().apply {
      moveTo(stroke.xs[0], stroke.ys[0])
      for (index in 1 until stroke.xs.size) lineTo(stroke.xs[index], stroke.ys[index])
    }
    canvas.drawPath(path, paint)
  }

  /** The smallest box holding what is visible; `null` if nothing is. */
  fun visibleBox(image: Bitmap): Rect? {
    var left = image.width
    var top = image.height
    var right = -1
    var bottom = -1
    val row = IntArray(image.width)
    for (y in 0 until image.height) {
      image.getPixels(row, 0, image.width, 0, y, image.width, 1)
      for (x in row.indices) {
        if (Color.alpha(row[x]) <= MIN_ALPHA) continue
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        bottom = y
      }
    }
    return if (right < 0) null else Rect(left, top, right + 1, bottom + 1)
  }

  private fun decode(context: Context, uri: String): Bitmap =
    (context.contentResolver.openInputStream(Uri.parse(uri)) ?: error("Could not open $uri")).use {
      BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 })
    } ?: error("Could not read $uri")

  /** `{photo, mask?, strokes: [{mode, radius, points: [{x, y}]}]}` from the editor. */
  fun strokesFrom(json: JSONObject): List<Stroke> {
    val list = json.optJSONArray("strokes") ?: return emptyList()
    return (0 until list.length()).map { index ->
      val stroke = list.getJSONObject(index)
      val points = stroke.getJSONArray("points")
      Stroke(
        erase = stroke.optString("mode") == "erase",
        radius = stroke.optDouble("radius", 1.0).toFloat(),
        xs = FloatArray(points.length()) { points.getJSONObject(it).getDouble("x").toFloat() },
        ys = FloatArray(points.length()) { points.getJSONObject(it).getDouble("y").toFloat() },
      )
    }
  }
}
