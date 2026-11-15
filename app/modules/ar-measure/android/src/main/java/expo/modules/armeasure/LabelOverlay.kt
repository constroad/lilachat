package expo.modules.armeasure

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.opengl.GLES20
import android.opengl.GLUtils
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

private const val VERTEX = """
attribute vec2 aPos;
attribute vec2 aUv;
varying vec2 vUv;
void main() { vUv = aUv; gl_Position = vec4(aPos, 0.0, 1.0); }
"""
private const val FRAGMENT = """
precision mediump float;
uniform sampler2D uTexture;
varying vec2 vUv;
void main() { gl_FragColor = texture2D(uTexture, vUv); }
"""
private const val CACHE = 48
private const val TEXT_SP = 15f
private const val PAD_DP = 7f
private const val FLOATS_PER_VERTEX = 4

/** A label to draw this frame: its text, where (pixels, y up from the bottom), and whether it is the strong one. */
class Label(val text: String, val x: Float, val y: Float, val strong: Boolean = false)

/**
 * The meters written on the trace itself (José 15/11, his reference app: each
 * side's length sits on its line and does not swim). Each text is painted once
 * into a texture and drawn every frame at its side's middle.
 */
class LabelOverlay(private val density: Float) {
  private class Texture(val id: Int, val width: Int, val height: Int)

  private var program = 0
  private var position = 0
  private var uv = 0
  private val textures = object : LinkedHashMap<String, Texture>(CACHE, 0.75f, true) {
    override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Texture>): Boolean {
      if (size <= CACHE) return false
      GLES20.glDeleteTextures(1, intArrayOf(eldest.value.id), 0)
      return true
    }
  }
  private val quad: FloatBuffer = ByteBuffer.allocateDirect(6 * FLOATS_PER_VERTEX * 4).order(ByteOrder.nativeOrder()).asFloatBuffer()

  @Volatile var accent = 0xFF6B38D4.toInt()

  fun create() {
    program = GLES20.glCreateProgram()
    GLES20.glAttachShader(program, shader(GLES20.GL_VERTEX_SHADER, VERTEX))
    GLES20.glAttachShader(program, shader(GLES20.GL_FRAGMENT_SHADER, FRAGMENT))
    GLES20.glLinkProgram(program)
    position = GLES20.glGetAttribLocation(program, "aPos")
    uv = GLES20.glGetAttribLocation(program, "aUv")
    textures.clear()
  }

  fun draw(labels: List<Label>, size: Pair<Int, Int>) {
    if (labels.isEmpty()) return
    GLES20.glUseProgram(program)
    GLES20.glDisable(GLES20.GL_DEPTH_TEST)
    GLES20.glDepthMask(false)
    GLES20.glEnable(GLES20.GL_BLEND)
    GLES20.glBlendFunc(GLES20.GL_ONE, GLES20.GL_ONE_MINUS_SRC_ALPHA)
    labels.forEach { drawOne(it, size) }
    GLES20.glDisable(GLES20.GL_BLEND)
    GLES20.glDepthMask(true)
    GLES20.glEnable(GLES20.GL_DEPTH_TEST)
  }

  private fun drawOne(label: Label, size: Pair<Int, Int>) {
    val texture = textureOf(label.text, label.strong)
    val left = label.x - texture.width / 2f
    val bottom = label.y - texture.height / 2f
    val x0 = left / size.first * 2f - 1f
    val x1 = (left + texture.width) / size.first * 2f - 1f
    val y0 = bottom / size.second * 2f - 1f
    val y1 = (bottom + texture.height) / size.second * 2f - 1f
    quad.clear()
    // Bitmap rows go down; GL's v goes up: the top of the quad takes v = 0.
    floatArrayOf(x0, y0, 0f, 1f, x1, y0, 1f, 1f, x0, y1, 0f, 0f, x0, y1, 0f, 0f, x1, y0, 1f, 1f, x1, y1, 1f, 0f).forEach { quad.put(it) }
    GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, texture.id)
    quad.position(0)
    GLES20.glEnableVertexAttribArray(position)
    GLES20.glVertexAttribPointer(position, 2, GLES20.GL_FLOAT, false, FLOATS_PER_VERTEX * 4, quad)
    quad.position(2)
    GLES20.glEnableVertexAttribArray(uv)
    GLES20.glVertexAttribPointer(uv, 2, GLES20.GL_FLOAT, false, FLOATS_PER_VERTEX * 4, quad)
    GLES20.glDrawArrays(GLES20.GL_TRIANGLES, 0, 6)
    GLES20.glDisableVertexAttribArray(position)
    GLES20.glDisableVertexAttribArray(uv)
  }

  /** A rounded pill: dark with white text, or the accent for the side being drawn and the area. */
  private fun textureOf(text: String, strong: Boolean): Texture = textures.getOrPut("$strong|$text") {
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      textSize = TEXT_SP * density * (if (strong) 1.15f else 1f)
      typeface = Typeface.DEFAULT_BOLD
      color = android.graphics.Color.WHITE
    }
    val pad = PAD_DP * density
    val width = (paint.measureText(text) + pad * 2).toInt().coerceAtLeast(1)
    val height = (paint.fontSpacing + pad).toInt().coerceAtLeast(1)
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val back = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = if (strong) accent else 0xD9000000.toInt() }
    canvas.drawRoundRect(RectF(0f, 0f, width.toFloat(), height.toFloat()), height / 2f, height / 2f, back)
    canvas.drawText(text, pad, height / 2f - (paint.descent() + paint.ascent()) / 2f, paint)
    val ids = IntArray(1)
    GLES20.glGenTextures(1, ids, 0)
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, ids[0])
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
    GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bitmap, 0)
    bitmap.recycle()
    Texture(ids[0], width, height)
  }

  private fun shader(type: Int, source: String): Int = GLES20.glCreateShader(type).also {
    GLES20.glShaderSource(it, source)
    GLES20.glCompileShader(it)
  }
}
