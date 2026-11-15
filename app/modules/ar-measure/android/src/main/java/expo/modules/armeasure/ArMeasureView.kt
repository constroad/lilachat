package expo.modules.armeasure

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.display.DisplayManager
import android.opengl.GLSurfaceView
import android.view.Surface
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import com.google.ar.core.ArCoreApk
import com.google.ar.core.Config
import com.google.ar.core.Session
import com.google.ar.core.exceptions.UnavailableDeviceNotCompatibleException
import com.google.ar.core.exceptions.UnavailableException
import com.google.ar.core.exceptions.UnavailableUserDeclinedInstallationException
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.util.Collections
import java.util.WeakHashMap

private const val COLOR_BITS = 8
private const val DEPTH_BITS = 16
private const val GLES_VERSION = 2

/**
 * The AR measure on the screen (la-02): ARCore's session, its camera behind
 * and the renderer that finds the floor, keeps the corners and draws the trace
 * on the camera image. Lilachat's JS draws the labels and the buttons on top.
 */
class ArMeasureView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true
  private val onArFrame by EventDispatcher()
  private var session: Session? = null
  private var installRequested = false
  private var running = false
  val renderer = MeasureRenderer({ session }, context.cacheDir, context.resources.displayMetrics.density) { snapshot -> post { onArFrame(snapshot) } }

  /** The theme's primary as `#rrggbb`; a value that does not parse keeps the last one. */
  fun setAccent(hex: String) {
    val color = runCatching { android.graphics.Color.parseColor(hex) }.getOrNull() ?: return
    renderer.setAccentColor(color)
  }
  private val surface = GLSurfaceView(context).apply {
    preserveEGLContextOnPause = true
    setEGLContextClientVersion(GLES_VERSION)
    setEGLConfigChooser(COLOR_BITS, COLOR_BITS, COLOR_BITS, COLOR_BITS, DEPTH_BITS, 0)
    setRenderer(renderer)
    renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
  }

  /** The phone turned (90° or 180°): the camera image and the corners follow it. */
  private val rotation = object : DisplayManager.DisplayListener {
    override fun onDisplayAdded(displayId: Int) = Unit
    override fun onDisplayRemoved(displayId: Int) = Unit
    override fun onDisplayChanged(displayId: Int) {
      renderer.displayRotation = display?.rotation ?: Surface.ROTATION_0
      renderer.requestGeometry()
    }
  }
  private val displays get() = context.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager

  init {
    addView(surface, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    live.add(this)
    displays.registerDisplayListener(rotation, null)
    resumeAr()
  }

  override fun onDetachedFromWindow() {
    live.remove(this)
    displays.unregisterDisplayListener(rotation)
    pauseAr()
    session?.close()
    session = null
    super.onDetachedFromWindow()
  }

  /** Opens (or reopens) the session; any step that cannot go says why to JS. */
  fun resumeAr() {
    if (running) return
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) return say("no-permission")
    val opened = session ?: openSession() ?: return
    try {
      opened.resume()
    } catch (error: Exception) {
      return say("error", error.javaClass.simpleName)
    }
    renderer.displayRotation = display?.rotation ?: Surface.ROTATION_0
    renderer.requestGeometry()
    surface.onResume()
    running = true
    renderer.accepting = true
  }

  fun pauseAr() {
    if (!running) return
    running = false
    renderer.accepting = false
    renderer.failPending("paused")
    surface.onPause()
    session?.pause()
  }

  private fun openSession(): Session? {
    val activity = appContext.currentActivity ?: return null.also { say("error", "activity") }
    return try {
      if (ArCoreApk.getInstance().requestInstall(activity, !installRequested) == ArCoreApk.InstallStatus.INSTALL_REQUESTED) {
        installRequested = true
        return null.also { say("installing") }
      }
      Session(activity).also { created ->
        created.configure(Config(created).apply {
          planeFindingMode = Config.PlaneFindingMode.HORIZONTAL
          updateMode = Config.UpdateMode.LATEST_CAMERA_IMAGE
          focusMode = Config.FocusMode.AUTO
        })
        session = created
      }
    } catch (error: UnavailableUserDeclinedInstallationException) {
      null.also { say("declined") }
    } catch (error: UnavailableDeviceNotCompatibleException) {
      null.also { say("unsupported") }
    } catch (error: UnavailableException) {
      null.also { say("unsupported", error.javaClass.simpleName) }
    } catch (error: Exception) {
      null.also { say("error", error.javaClass.simpleName) }
    }
  }

  private fun say(state: String, reason: String? = null) {
    post { onArFrame(compact("state" to state, "reason" to reason, "floor" to false, "corners" to emptyList<Any>(), "stable" to true)) }
  }

  companion object {
    /** The views on screen, for the activity going to the background and back. */
    val live: MutableSet<ArMeasureView> = Collections.newSetFromMap(WeakHashMap())
  }
}
