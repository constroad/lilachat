package expo.modules.shareinto

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener
import java.lang.ref.WeakReference

// In its own `*Package.kt` file: expo's autolinking finds packages by the file name.
class ShareIntoPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener?> =
    listOf(ShareIntentListener())
}

/** Reads a SEND or SEND_MULTIPLE that opened or reached MainActivity, once. */
class ShareIntentListener : ReactActivityLifecycleListener {
  private var activity: WeakReference<Activity>? = null

  override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
    this.activity = WeakReference(activity)
    read(activity, activity.intent)
  }

  // A share whose onNewIntent Expo dropped while the app was still loading: MainActivity kept it as its
  // intent (plugin withMainActivityNewIntent), and it is read here.
  override fun onResume(activity: Activity) {
    this.activity = WeakReference(activity)
    read(activity, activity.intent)
  }

  override fun onNewIntent(intent: Intent): Boolean {
    activity?.get()?.let { read(it, intent) }
    return false
  }

  private fun read(activity: Activity, intent: Intent?) {
    val shared = SharedContent.read(activity, intent) ?: return
    // Attended once: rotating the screen or the next onResume must not share it again.
    intent?.action = Intent.ACTION_MAIN
    listOf(Intent.EXTRA_TEXT, Intent.EXTRA_SUBJECT, Intent.EXTRA_STREAM).forEach { intent?.removeExtra(it) }
    intent?.clipData = null
    ShareBridge.deliver(shared)
  }
}
