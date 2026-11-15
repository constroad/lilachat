package expo.modules.armeasure

import android.opengl.GLES20
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

private const val VERTEX = """
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
"""
private const val FRAGMENT = """
precision mediump float;
uniform vec4 uColor;
void main() { gl_FragColor = uColor; }
"""
private const val FLOAT_BYTES = 4
private const val CIRCLE_STEPS = 20
private const val COMPONENTS = 2
/** Points this close to the camera plane are cut there: behind it they would wrap across the screen. */
private const val NEAR_W = 0.01f
private const val MAX_DASHES = 160

/** A world point already multiplied by the view-projection: x, y and w of clip space. */
class Clip(val x: Float, val y: Float, val w: Float) {
  val inFront get() = w > NEAR_W
}

/**
 * The trace drawn on the camera image itself, every frame (José 15/11: the
 * lines drawn from JS ten times a second swam behind the camera). Thick lines
 * and dots in the screen's pixels, glued to the floor because they are
 * projected in the same frame the camera image comes from.
 */
class TraceOverlay {
  private var program = 0
  private var position = 0
  private var color = 0
  private var buffer: FloatBuffer = allocate(1024)

  fun create() {
    program = GLES20.glCreateProgram()
    GLES20.glAttachShader(program, shader(GLES20.GL_VERTEX_SHADER, VERTEX))
    GLES20.glAttachShader(program, shader(GLES20.GL_FRAGMENT_SHADER, FRAGMENT))
    GLES20.glLinkProgram(program)
    position = GLES20.glGetAttribLocation(program, "aPos")
    color = GLES20.glGetUniformLocation(program, "uColor")
  }

  /** Each segment as a band `widthPx` wide; a segment half behind the camera is cut at its plane. */
  fun lines(segments: List<Pair<Clip, Clip>>, widthPx: Float, rgba: FloatArray, size: Pair<Int, Int>, dashPx: Float = 0f) {
    val vertices = ArrayList<Float>()
    for ((from, to) in segments) {
      val cut = clipped(from, to) ?: continue
      val start = pixels(cut.first, size)
      val end = pixels(cut.second, size)
      if (dashPx > 0f) dashes(start, end, dashPx).forEach { (a, b) -> band(vertices, a, b, widthPx, size) } else band(vertices, start, end, widthPx, size)
    }
    draw(vertices, rgba)
  }

  /** Round dots of `radiusPx` on the points in front of the camera. */
  fun dots(points: List<Clip>, radiusPx: Float, rgba: FloatArray, size: Pair<Int, Int>) {
    val vertices = ArrayList<Float>()
    points.filter { it.inFront }.forEach { circle(vertices, pixels(it, size), radiusPx, size) }
    draw(vertices, rgba)
  }

  /** Small squares on the floor ARCore found (the scan's dotted floor). */
  fun squares(points: List<Clip>, halfPx: Float, rgba: FloatArray, size: Pair<Int, Int>) {
    val vertices = ArrayList<Float>(points.size * 12)
    for (point in points) {
      if (!point.inFront) continue
      val c = pixels(point, size)
      val corners = listOf(floatArrayOf(c[0] - halfPx, c[1] - halfPx), floatArrayOf(c[0] + halfPx, c[1] - halfPx), floatArrayOf(c[0] - halfPx, c[1] + halfPx), floatArrayOf(c[0] + halfPx, c[1] + halfPx))
      listOf(0, 1, 2, 2, 1, 3).forEach { index -> ndc(vertices, corners[index], size) }
    }
    draw(vertices, rgba)
  }

  /** The closed zone, filled: ear clipping on the screen (a floor polygon stays simple when projected). */
  fun fill(points: List<Clip>, rgba: FloatArray, size: Pair<Int, Int>) {
    if (points.size < 3 || points.any { !it.inFront }) return
    val ring = points.map { pixels(it, size) }
    val vertices = ArrayList<Float>()
    earClip(ring).forEach { index -> ndc(vertices, ring[index], size) }
    draw(vertices, rgba)
  }

  private fun earClip(ring: List<FloatArray>): List<Int> {
    val signed = ring.indices.sumOf { i -> val a = ring[i]; val b = ring[(i + 1) % ring.size]; (a[0] * b[1] - b[0] * a[1]).toDouble() }
    val left = ring.indices.toMutableList().let { if (signed < 0) it.asReversed().toMutableList() else it }
    val out = ArrayList<Int>()
    var guard = left.size * left.size
    while (left.size > 3 && guard-- > 0) {
      val ear = left.indices.firstOrNull { isEar(ring, left, it) } ?: break
      out.addAll(listOf(left[(ear + left.size - 1) % left.size], left[ear], left[(ear + 1) % left.size]))
      left.removeAt(ear)
    }
    if (left.size == 3) out.addAll(left)
    return out
  }

  private fun isEar(ring: List<FloatArray>, left: List<Int>, at: Int): Boolean {
    val a = ring[left[(at + left.size - 1) % left.size]]
    val b = ring[left[at]]
    val c = ring[left[(at + 1) % left.size]]
    if (cross(a, b, c) <= 0f) return false
    return left.none { index -> val p = ring[index]; p !== a && p !== b && p !== c && inside(p, a, b, c) }
  }

  private fun cross(a: FloatArray, b: FloatArray, c: FloatArray) = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  private fun inside(p: FloatArray, a: FloatArray, b: FloatArray, c: FloatArray) = cross(a, b, p) >= 0f && cross(b, c, p) >= 0f && cross(c, a, p) >= 0f

  /** A clip point on the screen in pixels, y up; null behind the camera. */
  fun screenOf(point: Clip, size: Pair<Int, Int>): FloatArray? = if (point.inFront) pixels(point, size) else null

  private fun draw(vertices: List<Float>, rgba: FloatArray) {
    if (vertices.isEmpty()) return
    if (buffer.capacity() < vertices.size) buffer = allocate(vertices.size * 2)
    buffer.clear()
    vertices.forEach { buffer.put(it) }
    buffer.flip()
    GLES20.glUseProgram(program)
    // The camera quad turns the depth test on: the trace sits on top of everything, always (audit 15/11).
    GLES20.glDisable(GLES20.GL_DEPTH_TEST)
    GLES20.glDepthMask(false)
    GLES20.glEnable(GLES20.GL_BLEND)
    GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA)
    GLES20.glUniform4fv(color, 1, rgba, 0)
    GLES20.glEnableVertexAttribArray(position)
    GLES20.glVertexAttribPointer(position, COMPONENTS, GLES20.GL_FLOAT, false, 0, buffer)
    GLES20.glDrawArrays(GLES20.GL_TRIANGLES, 0, vertices.size / COMPONENTS)
    GLES20.glDisableVertexAttribArray(position)
    GLES20.glDisable(GLES20.GL_BLEND)
    GLES20.glDepthMask(true)
    GLES20.glEnable(GLES20.GL_DEPTH_TEST)
  }

  private fun clipped(from: Clip, to: Clip): Pair<Clip, Clip>? {
    if (from.inFront && to.inFront) return from to to
    if (!from.inFront && !to.inFront) return null
    val t = (NEAR_W - from.w) / (to.w - from.w)
    val cut = Clip(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, NEAR_W)
    return if (from.inFront) from to cut else cut to to
  }

  private fun pixels(point: Clip, size: Pair<Int, Int>) = floatArrayOf((point.x / point.w + 1f) / 2f * size.first, (point.y / point.w + 1f) / 2f * size.second)

  private fun band(out: MutableList<Float>, a: FloatArray, b: FloatArray, widthPx: Float, size: Pair<Int, Int>) {
    val dx = b[0] - a[0]
    val dy = b[1] - a[1]
    val length = kotlin.math.hypot(dx, dy)
    if (length < 1f) return
    val nx = -dy / length * widthPx / 2f
    val ny = dx / length * widthPx / 2f
    val corners = listOf(floatArrayOf(a[0] + nx, a[1] + ny), floatArrayOf(a[0] - nx, a[1] - ny), floatArrayOf(b[0] + nx, b[1] + ny), floatArrayOf(b[0] - nx, b[1] - ny))
    listOf(0, 1, 2, 2, 1, 3).forEach { index -> ndc(out, corners[index], size) }
  }

  private fun dashes(a: FloatArray, b: FloatArray, dashPx: Float): List<Pair<FloatArray, FloatArray>> {
    val length = kotlin.math.hypot(b[0] - a[0], b[1] - a[1])
    if (length < 1f) return emptyList()
    // A corner behind the camera is cut far off the screen: a few dashes reach the edge, thousands would stall the frame.
    val reach = minOf(length, MAX_DASHES * dashPx * 2f)
    val pieces = ArrayList<Pair<FloatArray, FloatArray>>()
    var at = 0f
    while (at < reach) {
      val end = minOf(at + dashPx, length)
      pieces.add(lerp(a, b, at / length) to lerp(a, b, end / length))
      at += dashPx * 2f
    }
    return pieces
  }

  private fun lerp(a: FloatArray, b: FloatArray, t: Float) = floatArrayOf(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)

  private fun circle(out: MutableList<Float>, center: FloatArray, radius: Float, size: Pair<Int, Int>) {
    for (step in 0 until CIRCLE_STEPS) {
      val from = step * 2.0 * Math.PI / CIRCLE_STEPS
      val to = (step + 1) * 2.0 * Math.PI / CIRCLE_STEPS
      ndc(out, center, size)
      ndc(out, floatArrayOf(center[0] + radius * kotlin.math.cos(from).toFloat(), center[1] + radius * kotlin.math.sin(from).toFloat()), size)
      ndc(out, floatArrayOf(center[0] + radius * kotlin.math.cos(to).toFloat(), center[1] + radius * kotlin.math.sin(to).toFloat()), size)
    }
  }

  private fun ndc(out: MutableList<Float>, pixel: FloatArray, size: Pair<Int, Int>) {
    out.add(pixel[0] / size.first * 2f - 1f)
    out.add(pixel[1] / size.second * 2f - 1f)
  }

  private fun shader(type: Int, source: String): Int = GLES20.glCreateShader(type).also {
    GLES20.glShaderSource(it, source)
    GLES20.glCompileShader(it)
  }

  private fun allocate(floats: Int): FloatBuffer = ByteBuffer.allocateDirect(floats * FLOAT_BYTES).order(ByteOrder.nativeOrder()).asFloatBuffer()
}
