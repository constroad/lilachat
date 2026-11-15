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
import java.io.File
import java.util.Locale
import java.util.concurrent.ConcurrentLinkedQueue
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

/** Farther than this the floor is too uncertain to bill from: «Acércate». */
private const val MAX_HIT_METERS = 6f
// The ray must point at least ~8° below the horizon to land on the floor's height: grazing it, a pixel is meters.
private const val MIN_RAY_DOWN = 0.14f
private const val RETICLE_M = 0.09f
private const val RETICLE_SEGMENTS = 28
private const val NEAR_PLANE = 0.05f
private const val FAR_PLANE = 100f
private const val SNAPSHOT_EVERY_MS = 50L
/** The aim this close to the first corner snaps to it: the next tap closes the zone (José 15/11). */
private const val SNAP_METERS = 0.15f
/** How much of each new floor hit the aim takes: the reticle stops shaking without lagging. */
private const val AIM_SMOOTHING = 0.35f
private const val LINE_DP = 4f
private const val DOT_DP = 7f
private const val DASH_DP = 9f
private const val MIN_CORNERS = 3
/** The corner is the mean of the last steady hits under the reticle, not one frame's (José 15/11: 1,90 against 1,99). */
private const val STEADY_HITS = 10
private const val STEADY_METERS = 0.04f
/** The floor to see before the first corner: the engine's `AR_SCAN_AREA_M2`. */
private const val SCAN_AREA_M2 = 1.0
/** The scan's dotted floor: a dot every 25 cm, up to 4 m away, at most 500, recomputed every 15 frames. */
private const val FLOOR_DOT_STEP = 0.25f
private const val FLOOR_DOT_REACH = 4f
private const val FLOOR_DOT_MAX = 500
private const val FLOOR_DOT_EVERY = 15
private val PERU = Locale.forLanguageTag("es-PE")
private const val MATRIX = 16

/** A request from JS, answered on the GL thread with ARCore's own frame. */
sealed class Command(val promise: Promise) {
  class AddCorner(promise: Promise) : Command(promise)
  class Undo(promise: Promise) : Command(promise)
  class Read(promise: Promise) : Command(promise)
  class Clear(promise: Promise) : Command(promise)
  /** Closes the zone in the AR itself, filled with its area; the person then confirms with «Listo». */
  class Close(promise: Promise) : Command(promise)
  class Reopen(promise: Promise) : Command(promise)
}

/** Expo's events take no nulls: an absent value is left out. */
fun compact(vararg pairs: Pair<String, Any?>): Map<String, Any> = pairs.mapNotNull { (key, value) -> value?.let { key to it } }.toMap()

/** A corner: ARCore's anchor and the height of the floor plane it landed on (a curb top is another level). */
private class Corner(val anchor: Anchor, val floorY: Float)

/** Where the floor is under the screen's center, if there is floor there. */
/** Where the reticle lands: on the plane ARCore drew (`plane`), or on that floor's height beyond it (null). */
private data class Aim(val pose: Pose, val distance: Float, val plane: Plane?, val floorY: Float)

/**
 * The measure itself, on the GL thread: the camera behind, the floor under the
 * screen's center, the corners as ARCore anchors (ARCore keeps refining them)
 * and, ten times a second, a snapshot for JS: where each corner shows on the
 * screen and whether tracking ever slipped after the first corner.
 */
class MeasureRenderer(private val sessionOf: () -> Session?, private val shotFolder: File, private val density: Float, private val onSnapshot: (Map<String, Any>) -> Unit) : GLSurfaceView.Renderer {
  private val background = BackgroundQuad()
  private val trace = TraceOverlay()
  private val labels = LabelOverlay(density)
  /** The app's accent (its theme's primary), as GL's red, green, blue and alpha. */
  @Volatile var accent = floatArrayOf(0.42f, 0.22f, 0.83f, 1f)
  private var closed = false
  private var floorDots: List<FloatArray> = emptyList()
  private var frames = 0

  fun setAccentColor(color: Int) {
    accent = floatArrayOf(android.graphics.Color.red(color) / 255f, android.graphics.Color.green(color) / 255f, android.graphics.Color.blue(color) / 255f, 1f)
    labels.accent = color
  }
  private var smoothed: FloatArray? = null
  private val steady = ArrayDeque<FloatArray>()
  private var closing = false
  private val commands = ConcurrentLinkedQueue<Command>()
  private val corners = mutableListOf<Corner>()
  private var textureBound: Session? = null
  private var width = 1
  private var height = 1
  @Volatile var displayRotation = 0
  @Volatile private var geometryDirty = true
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
    // A pause between the check and the add would leave this request waiting until the next resume.
    if (!accepting) failPending("paused")
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
    trace.create()
    labels.create()
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
    val frame = try {
      session.update()
    } catch (error: CameraNotAvailableException) {
      return emitState("error", "camera")
    } catch (error: Exception) {
      return emitState("error", error.javaClass.simpleName)
    }
    background.draw(frame)
    val camera = frame.camera
    val tracking = camera.trackingState == TrackingState.TRACKING
    if (!tracking && corners.isNotEmpty()) stable = false
    if (corners.any { it.anchor.trackingState == TrackingState.STOPPED }) stable = false
    aim = if (tracking) aimOf(frame, camera, session) else null
    smoothed = aim?.let { smooth(it.pose) }
    keepSteady(aim?.pose)
    closing = isClosing()
    val viewProjection = viewProjectionOf(camera)
    // One list per frame: the shot and its answer see the same requests (audit 15/11).
    val pending = generateSequence { commands.poll() }.toList()
    val shooting = pending.any { it is Command.Read }
    if (shooting && !closed) dropCornerOnFirst()
    if (frames++ % FLOOR_DOT_EVERY == 0) floorDots = floorDotsOf(session, camera.pose)
    drawTrace(viewProjection, shooting)
    runCommands(pending, tracking, session)
    closing = isClosing()
    snapshot(camera, tracking, viewProjection, session)
  }

  /** The hits of a still phone: a jump past 4 cm (the aim moved) starts the run again. */
  private fun keepSteady(pose: Pose?) {
    if (pose == null) return steady.clear()
    val hit = floatArrayOf(pose.tx(), pose.ty(), pose.tz())
    val mean = steadyMean()
    if (mean != null && length(mean, hit) > STEADY_METERS) steady.clear()
    steady.addLast(hit)
    while (steady.size > STEADY_HITS) steady.removeFirst()
  }

  private fun steadyMean(): FloatArray? = if (steady.isEmpty()) null else FloatArray(3) { axis -> steady.sumOf { it[axis].toDouble() }.toFloat() / steady.size }

  /** A last corner marked on the first one is the close, not a side: out before the shot and the reading. */
  private fun dropCornerOnFirst() {
    if (corners.size <= MIN_CORNERS) return
    val first = corners.first().anchor.pose
    val last = corners.last().anchor.pose
    if (kotlin.math.hypot(last.tx() - first.tx(), last.tz() - first.tz()) < SNAP_METERS) corners.removeAt(corners.size - 1).anchor.detach()
  }

  /** Near the first corner by the smoothed aim OR the raw hit: a tap while moving must not add a sliver (audit 15/11). */
  private fun nearFirst(x: Float, z: Float): Boolean {
    val first = corners.firstOrNull()?.anchor?.pose ?: return false
    return corners.size >= MIN_CORNERS && kotlin.math.hypot(x - first.tx(), z - first.tz()) < SNAP_METERS
  }

  /** The reticle's point, eased toward each new hit; a jump of a meter or more is taken whole. */
  private fun smooth(pose: Pose): FloatArray {
    val hit = floatArrayOf(pose.tx(), pose.ty(), pose.tz())
    val before = smoothed ?: return hit
    if (length(before, hit) > 1f) return hit
    return FloatArray(3) { before[it] + (hit[it] - before[it]) * AIM_SMOOTHING }
  }

  private fun isClosing(): Boolean {
    if (closed) return false
    val target = smoothed ?: return false
    return nearFirst(target[0], target[2])
  }

  /**
   * Like José's reference app: the floor ARCore found shows dotted while measuring; each side
   * carries its meters on the line; the side growing to the reticle shows its meters live; a
   * closed zone is filled with its area in the middle. All drawn in the camera's own frame.
   */
  private fun drawTrace(viewProjection: FloatArray, shooting: Boolean) {
    val size = width to height
    val ring = closed || shooting
    if (!ring) trace.squares(floorDots.map { clipOf(viewProjection, it[0], it[1], it[2]) }, 1.6f * density, floatArrayOf(1f, 1f, 1f, 0.45f), size)
    val points = corners.map { clipOf(viewProjection, it.anchor.pose.tx(), it.anchor.pose.ty(), it.anchor.pose.tz()) }
    if (ring && points.size >= MIN_CORNERS) trace.fill(points, floatArrayOf(accent[0], accent[1], accent[2], 0.28f), size)
    val sides = points.zipWithNext().toMutableList()
    if ((ring || closing) && points.size >= MIN_CORNERS) sides.add(points.last() to points.first())
    trace.lines(sides, LINE_DP * density, accent, size)
    val target = smoothed
    val live = if (!ring && !closing && target != null && points.isNotEmpty()) clipOf(viewProjection, target[0], target[1], target[2]) else null
    if (live != null) trace.lines(listOf(points.last() to live), LINE_DP * density * 0.75f, floatArrayOf(1f, 1f, 1f, 0.9f), size, DASH_DP * density)
    trace.dots(points, DOT_DP * density, floatArrayOf(1f, 1f, 1f, 1f), size)
    trace.dots(points, (DOT_DP - 2.5f) * density, accent, size)
    if (!shooting && !closed) drawReticle(viewProjection, size)
    labels.draw(if (shooting) shotLabelsOf(points, size) else labelsOf(points, ring || closing, live, target, size), size)
  }

  /** The reticle lies on the floor like the reference app's disc; it fills when it snaps to the first corner. */
  private fun drawReticle(viewProjection: FloatArray, size: Pair<Int, Int>) {
    val center = smoothed ?: return
    if (aim == null) return
    val ring = (0 until RETICLE_SEGMENTS).map { step ->
      val angle = 2.0 * Math.PI * step / RETICLE_SEGMENTS
      clipOf(viewProjection, center[0] + RETICLE_M * kotlin.math.cos(angle).toFloat(), center[1], center[2] + RETICLE_M * kotlin.math.sin(angle).toFloat())
    }
    trace.fill(ring, floatArrayOf(accent[0], accent[1], accent[2], if (closing) 0.55f else 0.22f), size)
    trace.lines(ring.zipWithNext() + (ring.last() to ring.first()), 2.5f * density, floatArrayOf(1f, 1f, 1f, 0.95f), size)
    trace.dots(listOf(clipOf(viewProjection, center[0], center[1], center[2])), 3f * density, floatArrayOf(1f, 1f, 1f, 1f), size)
  }

  /** «1 · 1,90 m» on each side, the growing side's meters, and the area of a closed zone. */
  private fun labelsOf(points: List<Clip>, ring: Boolean, live: Clip?, target: FloatArray?, size: Pair<Int, Int>): List<Label> {
    val out = ArrayList<Label>()
    val count = if (ring && corners.size >= MIN_CORNERS) corners.size else corners.size - 1
    for (index in 0 until count) {
      val next = (index + 1) % corners.size
      val middle = middleOf(points[index], points[next], size) ?: continue
      out.add(Label("${index + 1} · ${meters(distanceBetween(corners[index].anchor.pose, corners[next].anchor.pose))}", middle[0], middle[1]))
    }
    val last = corners.lastOrNull()?.anchor?.pose
    if (live != null && last != null && target != null) {
      middleOf(points.last(), live, size)?.let { out.add(Label(meters(length(floatArrayOf(last.tx(), last.ty(), last.tz()), target)), it[0], it[1], strong = true)) }
    }
    if (closed && corners.size >= MIN_CORNERS) {
      val screen = points.mapNotNull { trace.screenOf(it, size) }
      if (screen.size == points.size) out.add(Label("${"%.2f".format(PERU, areaOf())} m²", screen.map { it[0] }.average().toFloat(), screen.map { it[1] }.average().toFloat(), strong = true))
    }
    return out
  }

  /**
   * The photo that goes to the client carries only each side's number: the meters and the
   * area there are the AR's own, and a tape typed afterwards changes what is billed (audit 15/11).
   */
  private fun shotLabelsOf(points: List<Clip>, size: Pair<Int, Int>): List<Label> {
    if (corners.size < MIN_CORNERS) return emptyList()
    return corners.indices.mapNotNull { index ->
      middleOf(points[index], points[(index + 1) % corners.size], size)?.let { Label("${index + 1}", it[0], it[1]) }
    }
  }

  private fun middleOf(a: Clip, b: Clip, size: Pair<Int, Int>): FloatArray? {
    val from = trace.screenOf(a, size) ?: return null
    val to = trace.screenOf(b, size) ?: return null
    return floatArrayOf((from[0] + to[0]) / 2f, (from[1] + to[1]) / 2f)
  }

  private fun meters(value: Float) = "${"%.2f".format(PERU, value)} m"

  /** The zone's area on its own plane (Newell): the same formula the engine bills with. */
  private fun areaOf(): Double {
    var nx = 0.0
    var ny = 0.0
    var nz = 0.0
    corners.forEachIndexed { index, corner ->
      val a = corner.anchor.pose
      val b = corners[(index + 1) % corners.size].anchor.pose
      nx += (a.ty() - b.ty()) * (a.tz() + b.tz()).toDouble()
      ny += (a.tz() - b.tz()) * (a.tx() + b.tx()).toDouble()
      nz += (a.tx() - b.tx()) * (a.ty() + b.ty()).toDouble()
    }
    return kotlin.math.sqrt(nx * nx + ny * ny + nz * nz) / 2.0
  }

  /** Dots on the tracked floor near the camera, so the person sees what ARCore already knows. */
  private fun floorDotsOf(session: Session, camera: Pose): List<FloatArray> {
    if (closed) return emptyList()
    val dots = ArrayList<FloatArray>()
    for (plane in session.getAllTrackables(Plane::class.java)) {
      if (plane.type != Plane.Type.HORIZONTAL_UPWARD_FACING || plane.trackingState != TrackingState.TRACKING || plane.subsumedBy != null) continue
      val center = plane.centerPose
      // The camera in the plane's own axes: only the cells within reach are walked (audit 15/11: a parking lot is ~14,000 cells).
      val local = center.inverse().transformPoint(floatArrayOf(camera.tx(), camera.ty(), camera.tz()))
      val xs = gridOf(plane.extentX, local[0])
      val zs = gridOf(plane.extentZ, local[2])
      var x = xs.first
      while (x <= xs.second && dots.size < FLOOR_DOT_MAX) {
        var z = zs.first
        while (z <= zs.second && dots.size < FLOOR_DOT_MAX) {
          val world = center.transformPoint(floatArrayOf(x, 0f, z))
          val pose = Pose.makeTranslation(world[0], world[1], world[2])
          if (kotlin.math.hypot(world[0] - camera.tx(), world[2] - camera.tz()) < FLOOR_DOT_REACH && plane.isPoseInPolygon(pose)) dots.add(world)
          z += FLOOR_DOT_STEP
        }
        x += FLOOR_DOT_STEP
      }
    }
    return dots
  }

  /** The grid's first and last cell along one axis of the plane, kept on the plane's own grid. */
  private fun gridOf(extent: Float, camera: Float): Pair<Float, Float> {
    val start = -extent / 2f
    val low = maxOf(start, camera - FLOOR_DOT_REACH)
    val first = start + kotlin.math.ceil((low - start) / FLOOR_DOT_STEP) * FLOOR_DOT_STEP
    return first to minOf(extent / 2f, camera + FLOOR_DOT_REACH)
  }

  private fun clipOf(viewProjection: FloatArray, x: Float, y: Float, z: Float): Clip {
    val clip = FloatArray(4)
    Matrix.multiplyMV(clip, 0, viewProjection, 0, floatArrayOf(x, y, z, 1f), 0)
    return Clip(clip[0], clip[1], clip[3])
  }

  fun requestGeometry() { geometryDirty = true }

  /** The first upward floor hit under the screen's center; past the patch ARCore drew, the same floor's height. */
  private fun aimOf(frame: Frame, camera: Camera, session: Session): Aim? {
    val hit = frame.hitTest(width / 2f, height / 2f).firstOrNull { result ->
      val plane = result.trackable as? Plane ?: return@firstOrNull false
      plane.type == Plane.Type.HORIZONTAL_UPWARD_FACING && plane.isPoseInPolygon(result.hitPose) && plane.subsumedBy == null
    } ?: return extendedAim(camera, session)
    val plane = hit.trackable as Plane
    return Aim(hit.hitPose, distanceBetween(camera.pose, hit.hitPose), plane, plane.centerPose.ty())
  }

  /**
   * José 15/11, his reference app: once the floor is known, the reticle lands anywhere on it, not
   * only on the patch ARCore drew (a shiny tile floor gives a small patch: «Apunta al piso»). It is
   * the hit test's own math (the center ray against a level plane) without the patch's outline;
   * the floor's height is the first corner's, or the biggest floor found.
   */
  private fun extendedAim(camera: Camera, session: Session): Aim? {
    val floorY = corners.firstOrNull()?.floorY ?: biggestFloor(session)?.centerPose?.ty() ?: return null
    val ray = centerRayOf(camera) ?: return null
    val (origin, direction) = ray
    if (direction[1] > -MIN_RAY_DOWN) return null
    val t = (floorY - origin[1]) / direction[1]
    if (t <= 0f) return null
    val pose = Pose.makeTranslation(origin[0] + direction[0] * t, floorY, origin[2] + direction[2] * t)
    return Aim(pose, distanceBetween(camera.pose, pose), null, floorY)
  }

  private fun biggestFloor(session: Session): Plane? = session.getAllTrackables(Plane::class.java)
    .filter { it.type == Plane.Type.HORIZONTAL_UPWARD_FACING && it.trackingState == TrackingState.TRACKING && it.subsumedBy == null }
    .maxByOrNull { it.extentX * it.extentZ }

  /** The ray through the screen's center, unprojected from the camera's own matrices (as the hit test does). */
  private fun centerRayOf(camera: Camera): Pair<FloatArray, FloatArray>? {
    val inverse = FloatArray(MATRIX)
    if (!Matrix.invertM(inverse, 0, viewProjectionOf(camera), 0)) return null
    val near = unproject(inverse, -1f)
    val far = unproject(inverse, 1f)
    val direction = FloatArray(3) { far[it] - near[it] }
    val norm = kotlin.math.sqrt(direction[0] * direction[0] + direction[1] * direction[1] + direction[2] * direction[2])
    if (norm == 0f) return null
    return near to FloatArray(3) { direction[it] / norm }
  }

  private fun unproject(inverse: FloatArray, depth: Float): FloatArray {
    val world = FloatArray(4)
    Matrix.multiplyMV(world, 0, inverse, 0, floatArrayOf(0f, 0f, depth, 1f), 0)
    return FloatArray(3) { world[it] / world[3] }
  }

  private fun runCommands(pending: List<Command>, tracking: Boolean, session: Session) {
    for (command in pending) {
      when (command) {
        is Command.AddCorner -> addCorner(command.promise, tracking, session)
        is Command.Undo -> {
          // «Deshacer» on a closed zone opens it again; otherwise it takes the last corner off.
          if (closed) closed = false else corners.removeLastOrNull()?.anchor?.detach()
          if (corners.isEmpty()) stable = true
          command.promise.resolve(corners.size)
        }
        is Command.Close -> {
          if (corners.size < MIN_CORNERS) command.promise.reject("few-corners", "Marca al menos tres esquinas.", null)
          else {
            dropCornerOnFirst()
            closed = true
            command.promise.resolve(areaOf())
          }
        }
        is Command.Reopen -> {
          closed = false
          command.promise.resolve(corners.size)
        }
        is Command.Read -> command.promise.resolve(reading(FrameShot.save(width, height, shotFolder)))
        is Command.Clear -> {
          corners.forEach { it.anchor.detach() }
          corners.clear()
          closed = false
          stable = true
          command.promise.resolve(0)
        }
      }
    }
  }

  private fun addCorner(promise: Promise, tracking: Boolean, session: Session) {
    val target = aim
    when {
      closed -> promise.reject("closed", "La zona ya está cerrada: toca «Listo» o deshaz para corregir.", null)
      !tracking -> promise.reject("not-tracking", "Mueve el teléfono despacio hasta que el AR reconozca el piso.", null)
      corners.isEmpty() && floorArea(session) < SCAN_AREA_M2 -> promise.reject("scanning", "Sigue escaneando el piso antes de marcar la primera esquina.", null)
      target == null -> promise.reject("no-floor", "Apunta al piso: no hay piso reconocido en el centro.", null)
      target.distance > MAX_HIT_METERS -> promise.reject("far", "Acércate: la esquina está a más de 6 m.", null)
      closing || nearFirst(target.pose.tx(), target.pose.tz()) -> promise.reject("closing", "Toca para cerrar la zona.", null)
      else -> placeCorner(promise, target, session)
    }
  }

  /** The corner goes where the steady hits average; if that lands on the first corner, it is the close. */
  private fun placeCorner(promise: Promise, target: Aim, session: Session) {
    val mean = steadyMean()?.takeIf { steady.size >= MIN_CORNERS }
    when {
      mean != null && nearFirst(mean[0], mean[2]) -> promise.reject("closing", "Toca para cerrar la zona.", null)
      else -> {
        val pose = if (mean != null) Pose.makeTranslation(mean[0], mean[1], mean[2]) else target.pose
        val anchor = target.plane?.createAnchor(pose) ?: session.createAnchor(pose)
        corners.add(Corner(anchor, target.floorY))
        promise.resolve(corners.size)
      }
    }
  }

  /** The corners in meters (ARCore's world, y up) and whether they can be trusted. */
  private fun reading(photo: File?): Map<String, Any> = compact(
    "photo" to photo?.let { "file://${it.absolutePath}" },
    "points" to corners.map { corner -> corner.anchor.pose.let { mapOf("x" to it.tx().toDouble(), "y" to it.ty().toDouble(), "z" to it.tz().toDouble(), "floorY" to corner.floorY.toDouble()) } },
    "stable" to (stable && corners.all { it.anchor.trackingState == TrackingState.TRACKING })
  )

  private fun snapshot(camera: Camera, tracking: Boolean, viewProjection: FloatArray, session: Session) {
    val now = System.currentTimeMillis()
    if (now - lastSnapshot < SNAPSHOT_EVERY_MS) return
    lastSnapshot = now
    val target = aim
    val reticle = smoothed
    val last = corners.lastOrNull()?.anchor?.pose
    val toward = if (closing) corners.firstOrNull()?.anchor?.pose?.let { floatArrayOf(it.tx(), it.ty(), it.tz()) } else reticle
    onSnapshot(compact(
      "floorM2" to floorArea(session),
      "closing" to closing,
      "closed" to closed,
      "areaM2" to if (closed) areaOf() else null,
      "live" to if (last != null && toward != null) length(floatArrayOf(last.tx(), last.ty(), last.tz()), toward).toDouble() else null,
      "sides" to corners.zipWithNext { a, b -> distanceBetween(a.anchor.pose, b.anchor.pose).toDouble() },
      "state" to if (tracking) "tracking" else "searching",
      "reason" to if (tracking) null else camera.trackingFailureReason.name.lowercase(),
      "floor" to (target != null),
      "distance" to target?.distance?.toDouble(),
      "corners" to corners.map { corner -> projected(viewProjection, corner.anchor.pose) },
      "aim" to target?.let { projected(viewProjection, it.pose) },
      "stable" to stable,
      "width" to width,
      "height" to height
    ))
  }

  private fun emitState(state: String, reason: String) =
    onSnapshot(compact("state" to state, "reason" to reason, "floor" to false, "corners" to emptyList<Any>(), "stable" to stable, "width" to width, "height" to height))

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

  /** The floor ARCore has seen so far, for the scan before the first corner. */
  private fun floorArea(session: Session): Double = session.getAllTrackables(Plane::class.java)
    .filter { it.type == Plane.Type.HORIZONTAL_UPWARD_FACING && it.trackingState == TrackingState.TRACKING && it.subsumedBy == null }
    .sumOf { (it.extentX * it.extentZ).toDouble() }

  private fun length(a: FloatArray, b: FloatArray): Float = kotlin.math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]) + (b[2] - a[2]) * (b[2] - a[2]))

  private fun distanceBetween(from: Pose, to: Pose): Float {
    val dx = to.tx() - from.tx()
    val dy = to.ty() - from.ty()
    val dz = to.tz() - from.tz()
    return kotlin.math.sqrt(dx * dx + dy * dy + dz * dz)
  }
}
