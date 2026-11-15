package expo.modules.armeasure

import android.opengl.GLES11Ext
import android.opengl.GLES20
import com.google.ar.core.Coordinates2d
import com.google.ar.core.Frame
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

private const val FLOAT_BYTES = 4
private const val CORNERS = 4
private const val PER_VERTEX = 2

private const val VERTEX_SHADER = """
attribute vec4 a_Position;
attribute vec2 a_TexCoord;
varying vec2 v_TexCoord;
void main() {
  gl_Position = a_Position;
  v_TexCoord = a_TexCoord;
}
"""

private const val FRAGMENT_SHADER = """
#extension GL_OES_EGL_image_external : require
precision mediump float;
varying vec2 v_TexCoord;
uniform samplerExternalOES sTexture;
void main() {
  gl_FragColor = texture2D(sTexture, v_TexCoord);
}
"""

private fun floats(count: Int): FloatBuffer =
  ByteBuffer.allocateDirect(count * FLOAT_BYTES).order(ByteOrder.nativeOrder()).asFloatBuffer()

/**
 * The camera image behind the measure: ARCore writes each frame into an
 * external texture and this draws it over the whole view, turned the way the
 * phone is held (`transformCoordinates2d`).
 */
class BackgroundQuad {
  var textureId = -1
    private set
  private var program = 0
  private var positionAttribute = 0
  private var texCoordAttribute = 0
  private val quad = floats(CORNERS * PER_VERTEX).apply { put(floatArrayOf(-1f, -1f, 1f, -1f, -1f, 1f, 1f, 1f)); position(0) }
  private val texCoords = floats(CORNERS * PER_VERTEX)

  /** Called on the GL thread once the surface exists. */
  fun create() {
    val textures = IntArray(1)
    GLES20.glGenTextures(1, textures, 0)
    textureId = textures[0]
    val target = GLES11Ext.GL_TEXTURE_EXTERNAL_OES
    GLES20.glBindTexture(target, textureId)
    GLES20.glTexParameteri(target, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
    GLES20.glTexParameteri(target, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
    GLES20.glTexParameteri(target, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
    GLES20.glTexParameteri(target, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
    program = linked(compiled(GLES20.GL_VERTEX_SHADER, VERTEX_SHADER), compiled(GLES20.GL_FRAGMENT_SHADER, FRAGMENT_SHADER))
    positionAttribute = GLES20.glGetAttribLocation(program, "a_Position")
    texCoordAttribute = GLES20.glGetAttribLocation(program, "a_TexCoord")
  }

  fun draw(frame: Frame) {
    if (frame.hasDisplayGeometryChanged()) {
      quad.position(0)
      texCoords.position(0)
      frame.transformCoordinates2d(Coordinates2d.OPENGL_NORMALIZED_DEVICE_COORDINATES, quad, Coordinates2d.TEXTURE_NORMALIZED, texCoords)
    }
    if (frame.timestamp == 0L) return
    quad.position(0)
    texCoords.position(0)
    GLES20.glDisable(GLES20.GL_DEPTH_TEST)
    GLES20.glDepthMask(false)
    GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
    GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureId)
    GLES20.glUseProgram(program)
    GLES20.glVertexAttribPointer(positionAttribute, PER_VERTEX, GLES20.GL_FLOAT, false, 0, quad)
    GLES20.glVertexAttribPointer(texCoordAttribute, PER_VERTEX, GLES20.GL_FLOAT, false, 0, texCoords)
    GLES20.glEnableVertexAttribArray(positionAttribute)
    GLES20.glEnableVertexAttribArray(texCoordAttribute)
    GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, CORNERS)
    GLES20.glDisableVertexAttribArray(positionAttribute)
    GLES20.glDisableVertexAttribArray(texCoordAttribute)
    GLES20.glDepthMask(true)
    GLES20.glEnable(GLES20.GL_DEPTH_TEST)
  }

  private fun compiled(type: Int, source: String): Int {
    val shader = GLES20.glCreateShader(type)
    GLES20.glShaderSource(shader, source)
    GLES20.glCompileShader(shader)
    val status = IntArray(1)
    GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, status, 0)
    check(status[0] != 0) { "Shader: ${GLES20.glGetShaderInfoLog(shader)}" }
    return shader
  }

  private fun linked(vertex: Int, fragment: Int): Int {
    val linkedProgram = GLES20.glCreateProgram()
    GLES20.glAttachShader(linkedProgram, vertex)
    GLES20.glAttachShader(linkedProgram, fragment)
    GLES20.glLinkProgram(linkedProgram)
    val status = IntArray(1)
    GLES20.glGetProgramiv(linkedProgram, GLES20.GL_LINK_STATUS, status, 0)
    check(status[0] != 0) { "Program: ${GLES20.glGetProgramInfoLog(linkedProgram)}" }
    return linkedProgram
  }
}
