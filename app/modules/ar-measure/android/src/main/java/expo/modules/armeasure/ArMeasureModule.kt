package expo.modules.armeasure

import android.os.Handler
import android.os.Looper
import com.google.ar.core.ArCoreApk
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val CHECK_EVERY_MS = 200L
private const val CHECK_TRIES = 15

/**
 * IAA measured with AR (José 15/11, «AR + wincha»): whether this phone has AR,
 * and the measure view with its four requests. The figures are computed in
 * Lilachat's shared engine (`arArea`), never here.
 */
class ArMeasureModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ArMeasure")

    /** `ready`, `install` (needs Google Play Services for AR) or `unsupported`; `unknown` if it never settles. */
    AsyncFunction("availability") { promise: Promise ->
      val context = appContext.reactContext ?: return@AsyncFunction promise.resolve("unknown")
      val handler = Handler(Looper.getMainLooper())
      fun check(tries: Int) {
        val availability = ArCoreApk.getInstance().checkAvailability(context)
        when {
          availability.isTransient && tries > 0 -> handler.postDelayed({ check(tries - 1) }, CHECK_EVERY_MS)
          availability == ArCoreApk.Availability.SUPPORTED_INSTALLED -> promise.resolve("ready")
          availability.isSupported -> promise.resolve("install")
          availability.isUnsupported -> promise.resolve("unsupported")
          else -> promise.resolve("unknown")
        }
      }
      handler.post { check(CHECK_TRIES) }
    }

    OnActivityEntersForeground { ArMeasureView.live.toList().forEach { it.resumeAr() } }
    OnActivityEntersBackground { ArMeasureView.live.toList().forEach { it.pauseAr() } }

    View(ArMeasureView::class) {
      Events("onArFrame")
      AsyncFunction("addCorner") { view: ArMeasureView, promise: Promise -> view.renderer.post(Command.AddCorner(promise)) }
      AsyncFunction("undoCorner") { view: ArMeasureView, promise: Promise -> view.renderer.post(Command.Undo(promise)) }
      AsyncFunction("readCorners") { view: ArMeasureView, promise: Promise -> view.renderer.post(Command.Read(promise)) }
      AsyncFunction("clearCorners") { view: ArMeasureView, promise: Promise -> view.renderer.post(Command.Clear(promise)) }
    }
  }
}
