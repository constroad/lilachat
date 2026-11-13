package expo.modules.llamadaentrante

import android.app.Activity
import android.app.PictureInPictureParams
import android.os.Build
import android.util.Log
import android.util.Rational

/**
 * The call's small window (José 13/11: «al cambiar de ventana se cuelga la videollamada; debería
 * minimizarse como WhatsApp»). JS arms it while a video call is answered; leaving the app then
 * shrinks the activity instead of sending it to the back, where Android takes the camera away.
 * Android 12+ enters by itself (auto-enter); older ones from MainActivity's onUserLeaveHint.
 */
object Pip {
  @Volatile private var armed = false
  private val PORTRAIT = Rational(9, 16)

  fun arm(activity: Activity?, on: Boolean) {
    armed = on
    if (activity == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    activity.runOnUiThread {
      runCatching { activity.setPictureInPictureParams(params()) }
        .onFailure { Log.w("Pip", "no se pudo preparar la ventana chica", it) }
    }
  }

  /** From onUserLeaveHint: the Home button or another app, with an armed call. */
  fun enterIfArmed(activity: Activity) {
    if (!armed || Build.VERSION.SDK_INT < Build.VERSION_CODES.O || activity.isInPictureInPictureMode) return
    runCatching { activity.enterPictureInPictureMode(params()) }
      .onFailure { Log.w("Pip", "no se pudo achicar la llamada", it) }
  }

  private fun params(): PictureInPictureParams {
    val builder = PictureInPictureParams.Builder().setAspectRatio(PORTRAIT)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) builder.setAutoEnterEnabled(armed)
    return builder.build()
  }
}
