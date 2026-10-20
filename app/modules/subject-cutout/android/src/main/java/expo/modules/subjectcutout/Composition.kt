package expo.modules.subjectcutout

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import android.graphics.RectF
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * How a 512×512 sticker is built (like WhatsApp): the image centered, optional
 * white outline, then the layers (text with a black stroke, emojis, pencil
 * strokes). The numbers are the ones of `STICKER_COMPOSITION` in the shared
 * editor, so the web draws the same sticker.
 */
object Composition {
  private const val SIDE = 512
  private const val OUTLINE_MARGIN = 30
  private const val PLAIN_MARGIN = 12
  private const val OUTLINE_RADIUS = 9f
  private const val OUTLINE_STEPS = 24
  private const val TEXT_STROKE = 0.14f
  private const val MIN_ALPHA = 12
  private const val MIN_LETTER = 12f
  /** Limit of a static sticker; past it the WebP quality goes down. */
  private const val MAX_BYTES = 480 * 1024
  private const val MAX_INPUT_SIDE = 1024

  data class Point(val x: Float, val y: Float)

  /** A layer: `x`/`y` is the center (0..1), `scale` the letter height relative to the side, `rotation` in radians. */
  data class Layer(val kind: String, val text: String, val x: Float, val y: Float, val scale: Float, val rotation: Float, val color: Int, val points: List<Point>, val width: Float)

  data class Request(val image: String, val outline: Boolean, val layers: List<Layer>) {
    companion object {
      fun from(json: String): Request {
        val root = JSONObject(json)
        val layers = root.optJSONArray("layers")
        return Request(
          image = root.getString("image"),
          outline = root.optBoolean("outline", true),
          layers = (0 until (layers?.length() ?: 0)).map { index -> layerFrom(layers!!.getJSONObject(index)) }
        )
      }

      private fun layerFrom(layer: JSONObject): Layer {
        val points = layer.optJSONArray("points")
        return Layer(
          kind = layer.optString("kind", "text"),
          text = layer.optString("text", ""),
          x = layer.optDouble("x", 0.5).toFloat(),
          y = layer.optDouble("y", 0.85).toFloat(),
          scale = layer.optDouble("scale", 0.12).toFloat(),
          rotation = layer.optDouble("rotation", 0.0).toFloat(),
          color = runCatching { Color.parseColor(layer.optString("color", "#FFFFFF")) }.getOrDefault(Color.WHITE),
          points = (0 until (points?.length() ?: 0)).map { index ->
            val point = points!!.getJSONObject(index)
            Point(point.optDouble("x").toFloat(), point.optDouble("y").toFloat())
          },
          width = layer.optDouble("width", 0.02).toFloat()
        )
      }
    }
  }

  /** The smallest box holding what is visible (what ML Kit left with alpha). `null` if nothing is left. */
  fun cropToContent(source: Bitmap): Bitmap? {
    var left = source.width
    var top = source.height
    var right = -1
    var bottom = -1
    val row = IntArray(source.width)
    for (y in 0 until source.height) {
      source.getPixels(row, 0, source.width, 0, y, source.width, 1)
      for (x in row.indices) {
        if (Color.alpha(row[x]) > MIN_ALPHA) {
          if (x < left) left = x
          if (x > right) right = x
          if (y < top) top = y
          bottom = y
        }
      }
    }
    if (right < 0) return null
    return Bitmap.createBitmap(source, left, top, right - left + 1, bottom - top + 1)
  }

  fun savePng(image: Bitmap, file: File) {
    FileOutputStream(file).use { image.compress(Bitmap.CompressFormat.PNG, 100, it) }
  }

  fun compose(context: Context, request: Request): File {
    val image = read(context, request.image)
    val output = Bitmap.createBitmap(SIDE, SIDE, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(output)
    val margin = if (request.outline) OUTLINE_MARGIN else PLAIN_MARGIN
    val factor = min((SIDE - 2f * margin) / image.width, (SIDE - 2f * margin) / image.height)
    val width = image.width * factor
    val height = image.height * factor
    val target = RectF((SIDE - width) / 2, (SIDE - height) / 2, (SIDE + width) / 2, (SIDE + height) / 2)
    if (request.outline) drawOutline(canvas, image, target)
    canvas.drawBitmap(image, null, target, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
    request.layers.forEach { if (it.kind == "stroke") drawStroke(canvas, it) else drawLetters(canvas, it) }
    val file = File(context.cacheDir, "sticker-${System.currentTimeMillis()}.webp")
    FileOutputStream(file).use { it.write(compress(output)) }
    return file
  }

  /** The silhouette in white, repeated around: the thick outline of stickers. */
  private fun drawOutline(canvas: Canvas, image: Bitmap, target: RectF) {
    val white = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply { colorFilter = PorterDuffColorFilter(Color.WHITE, PorterDuff.Mode.SRC_IN) }
    for (step in 0 until OUTLINE_STEPS) {
      val angle = 2 * Math.PI * step / OUTLINE_STEPS
      for (radius in listOf(OUTLINE_RADIUS, OUTLINE_RADIUS / 2)) {
        val dx = (cos(angle) * radius).toFloat()
        val dy = (sin(angle) * radius).toFloat()
        canvas.drawBitmap(image, null, RectF(target.left + dx, target.top + dy, target.right + dx, target.bottom + dy), white)
      }
    }
  }

  private fun drawLetters(canvas: Canvas, layer: Layer) {
    if (layer.text.isBlank()) return
    val size = max(MIN_LETTER, layer.scale * SIDE)
    val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      textAlign = Paint.Align.CENTER
      textSize = size
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
      color = layer.color
    }
    val metrics = fill.fontMetrics
    val baseline = -(metrics.ascent + metrics.descent) / 2
    canvas.save()
    canvas.translate(layer.x * SIDE, layer.y * SIDE)
    canvas.rotate(Math.toDegrees(layer.rotation.toDouble()).toFloat())
    if (layer.kind == "text") {
      val stroke = Paint(fill).apply {
        style = Paint.Style.STROKE
        strokeWidth = size * TEXT_STROKE
        strokeJoin = Paint.Join.ROUND
        color = Color.BLACK
      }
      canvas.drawText(layer.text, 0f, baseline, stroke)
    }
    canvas.drawText(layer.text, 0f, baseline, fill)
    canvas.restore()
  }

  /** A pencil line, with round ends, like WhatsApp's. */
  private fun drawStroke(canvas: Canvas, layer: Layer) {
    if (layer.points.size < 2) return
    val path = Path().apply {
      moveTo(layer.points[0].x * SIDE, layer.points[0].y * SIDE)
      layer.points.drop(1).forEach { lineTo(it.x * SIDE, it.y * SIDE) }
    }
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      style = Paint.Style.STROKE
      strokeWidth = layer.width * SIDE
      strokeCap = Paint.Cap.ROUND
      strokeJoin = Paint.Join.ROUND
      color = layer.color
    }
    canvas.drawPath(path, paint)
  }

  /** Transparent WebP, lowering the quality until it fits the limit. */
  private fun compress(image: Bitmap): ByteArray {
    @Suppress("DEPRECATION")
    val format = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) Bitmap.CompressFormat.WEBP_LOSSY else Bitmap.CompressFormat.WEBP
    var quality = 90
    while (true) {
      val bytes = ByteArrayOutputStream().also { image.compress(format, quality, it) }.toByteArray()
      if (bytes.size <= MAX_BYTES || quality <= 40) return bytes
      quality -= 10
    }
  }

  /** The input image, scaled down if huge (a 12 MP photo is not needed for 512 px). */
  private fun read(context: Context, uri: String): Bitmap {
    val open = { context.contentResolver.openInputStream(Uri.parse(uri)) ?: error("Could not open the image") }
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    open().use { BitmapFactory.decodeStream(it, null, bounds) }
    var sample = 1
    while (max(bounds.outWidth, bounds.outHeight) / sample > MAX_INPUT_SIDE) sample *= 2
    val options = BitmapFactory.Options().apply { inSampleSize = sample; inPreferredConfig = Bitmap.Config.ARGB_8888 }
    return open().use { BitmapFactory.decodeStream(it, null, options) } ?: error("Could not read the image")
  }
}
