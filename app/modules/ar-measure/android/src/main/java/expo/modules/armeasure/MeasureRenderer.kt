package expo.modules.armeasure

import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.opengl.Matrix
import com.google.ar.core.Anchor
import com.google.ar.core.Camera
import com.google.ar.core.Frame
import com.google.ar.core.Plane
import com.google.ar.core.Pose
import com.google.ar.core.Session
import com.google.ar.core.TrackingState
import com.google.ar.core.exceptions.CameraNotAvailableException
import expo.modules.kotlin.Promise
import java.util.concurrent.ConcurrentLinkedQueue
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

/** Farther than this the floor is too uncertain to bill from: «Acércate». */
private const val MAX_HIT_METERS = 6f
private const val NEAR_PLANE = 0.05f
private const val FAR_PLANE = 100f
private const val SNAPSHOT_EVERY_MS = 100L
private const val MATRIX = 16

/** A request from JS, answered on the GL thread with ARCore's own frame. */
sealed class Command(val promise: Promise) {
  class AddCorner(promise: Promise) : Command(promise)
  class Undo(promise: Promise) : Command(promise)
  class Read(promise: Promise) : Command(promise)
  class Clear(promise: Promise) : Command(promise)
}

/** Where the floor is under the screen's center, if there is floor there. */
private data class Aim(val pose: Pose, val distance: Float, val hit: com.google.ar.core.HitResult)

/**
 * The measure itself, on the GL thread: the camera behind, the floor under the
 * screen's center, the corners as ARCore anchors (ARCore keeps refining them)
 * and, ten times a second, a snapshot for JS: where each corner shows on the
 * screen and whether tracking ever slipped after the first corner.
 */
class MeasureRenderer(private val sessionOf: () -> Session?, private val onSnapshot: (Map<String, Any?>) -> Unit) : GLSurfaceView.Renderer {
  private val background = BackgroundQuad()
  private val commands = ConcurrentLinkedQueue<Command>()
  private val corners = mutableListOf<Anchor>()
  private var textureBound: Session? = null
  private var width = 1
  private var height = 1
  @Volatile var displayRotation = 0
  private var geometryDirty = true
  private var stable = true
  private var lastSnapshot = 0L
  private var aim: Aim? = null

  /** False while the session is paused: a request then fails at once instead of waiting forever. */
  @Volatile var accepting = false

  fun post(command: Command) {
    if (!accepting) {
      command.promise.reject("paused", "El AR está en pausa.", null)
      return
    }
    commands.add(command)
  }

  /** The session paused or closed: nothing pending may hang the screen. */
  fun failPending(code: String) {
    var pending = commands.poll()
    while (pending != null) {
      pending.promise.reject(code, "El AR se detuvo.", null)
      pending = commands.poll()
    }
  }

  override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
    GLES20.glClearColor(0f, 0f, 0f, 1f)
    background.create()
    textureBound = null
  }

  override fun onSurfaceChanged(gl: GL10?, newWidth: Int, newHeight: Int) {
    GLES20.glViewport(0, 0, newWidth, newHeight)
    width = newWidth.coerceAtLeast(1)
    height = newHeight.coerceAtLeast(1)
    geometryDirty = true
  }

  override fun onDrawFrame(gl: GL10?) {
    GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)
    val session = sessionOf() ?: return
    if (textureBound !== session) {
      session.setCameraTextureName(background.textureId)
      textureBound = session
      geometryDirty = true
    }
    if (geometryDirty) {
      session.setDisplayGeometry(displayRotation, width, height)
      geometryDirty = false
    }
    val frame = try { session.update() } catch (error: CameraNotAvailableException) { return emitState("error", "camera") }
    background.draw(frame)
    val camera = frame.camera
    val tracking = camera.trackingState == TrackingState.TRACKING
    if (!tracking && corners.isNotEmpty()) stable = false
    if (corners.any { it.trackingState == TrackingState.STOPPED }) stable = false
    aim = if (tracking) aimOf(frame, camera) else null
    runCommands(tracking)
    snapshot(camera, tracking)
  }

  fun requestGeometry() { geometryDirty = true }

  /** The first upward floor hit under the screen's center, inside the plane and near enough. */
  private fun aimOf(frame: Frame, camera: Camera): Aim? {
    val hit = frame.hitTest(width / 2f, height / 2f).firstOrNull { result ->
      val plane = result.trackable as? Plane ?: return@firstOrNull false
      plane.type == Plane.Type.HORIZONTAL_UPWARD_FACING && plane.isPoseInPolygon(result.hitPose) && plane.subsumedBy == null
    } ?: return null
    val pose = hit.hitPose
    val distance = distanceBetween(camera.pose, pose)
    return Aim(pose, distance, hit)
  }

  private fun runCommands(tracking: Boolean) {
    while (true) {
      val command = commands.poll() ?: return
      when (command) {
        is Command.AddCorner -> addCorner(command.promise, tracking)
        is Command.Undo -> {
          corners.removeLastOrNull()?.detach()
          if (corners.isEmpty()) stable = true
          command.promise.resolve(corners.size)
        }
        is Command.Read -> command.promise.resolve(reading())
        is Command.Clear -> {
          corners.forEach { it.detach() }
          corners.clear()
          stable = true
          command.promise.resolve(0)
        }
      }
    }
  }

  private fun addCorner(promise: Promise, tracking: Boolean) {
    val target = aim
    when {
      !tracking -> promise.reject("not-tracking", "Mueve el teléfono despacio hasta que el AR reconozca el piso.", null)
      target == null -> promise.reject("no-floor", "Apunta al piso: no hay piso reconocido en el centro.", null)
      target.distance > MAX_HIT_METERS -> promise.reject("far", "Acércate: la esquina está a más de 6 m.", null)
      else -> {
        corners.add(target.hit.createAnchor())
        promise.resolve(corners.size)
      }
    }
  }

  /** The corners in meters (ARCore's world, y up) and whether they can be trusted. */
  private fun reading(): Map<String, Any?> = mapOf(
    "points" to corners.map { anchor -> anchor.pose.let { mapOf("x" to it.tx().toDouble(), "y" to it.ty().toDouble(), "z" to it.tz().toDouble()) } },
    "stable" to (stable && corners.all { it.trackingState == TrackingState.TRACKING })
  )

  private fun snapshot(camera: Camera, tracking: Boolean) {
    val now = System.currentTimeMillis()
    if (now - lastSnapshot < SNAPSHOT_EVERY_MS) return
    lastSnapshot = now
    val viewProjection = viewProjectionOf(camera)
    val target = aim
    onSnapshot(mapOf(
      "state" to if (tracking) "tracking" else "searching",
      "reason" to if (tracking) null else camera.trackingFailureReason.name.lowercase(),
      "floor" to (target != null),
      "distance" to target?.distance?.toDouble(),
      "corners" to corners.map { anchor -> projected(viewProjection, anchor.pose) },
      "aim" to target?.let { projected(viewProjection, it.pose) },
      "stable" to stable,
      "width" to width,
      "height" to height
    ))
  }

  private fun emitState(state: String, reason: String) =
    onSnapshot(mapOf("state" to state, "reason" to reason, "floor" to false, "corners" to emptyList<Any>(), "stable" to stable, "width" to width, "height" to height))

  private fun viewProjectionOf(camera: Camera): FloatArray {
    val projection = FloatArray(MATRIX)
    val view = FloatArray(MATRIX)
    val result = FloatArray(MATRIX)
    camera.getProjectionMatrix(projection, 0, NEAR_PLANE, FAR_PLANE)
    camera.getViewMatrix(view, 0)
    Matrix.multiplyMM(result, 0, projection, 0, view, 0)
    return result
  }

  /** A world point on the view, in the view's pixels; `visible` is false behind the camera or off the screen. */
  private fun projected(viewProjection: FloatArray, pose: Pose): Map<String, Any> {
    val clip = FloatArray(4)
    Matrix.multiplyMV(clip, 0, viewProjection, 0, floatArrayOf(pose.tx(), pose.ty(), pose.tz(), 1f), 0)
    if (clip[3] <= 0f) return mapOf("x" to 0.0, "y" to 0.0, "visible" to false)
    val x = (clip[0] / clip[3] + 1f) / 2f * width
    val y = (1f - clip[1] / clip[3]) / 2f * height
    return mapOf("x" to x.toDouble(), "y" to y.toDouble(), "visible" to (x in 0f..width.toFloat() && y in 0f..height.toFloat()))
  }

  private fun distanceBetween(from: Pose, to: Pose): Float {
    val dx = to.tx() - from.tx()
    val dy = to.ty() - from.ty()
    val dz = to.tz() - from.tz()
    return kotlin.math.sqrt(dx * dx + dy * dy + dz * dz)
  }
}
