package expo.modules.instaladorapk

import android.Manifest
import android.app.Activity
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.IntentSender
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Updates Lilachat through a PackageInstaller session of its own instead of
 * handing the APK to the system installer (José, 22/10: full-screen calls came
 * back off after every update on his Samsung). Only an installer's session can
 * say how USE_FULL_SCREEN_INTENT stays, and since Android 14 any installer may
 * set that one permission (`SessionParams.setPermissionState`). The session
 * keeps what the phone had: granted if calls could take the screen, the
 * device's default if not. Android still asks the person to confirm.
 */
class InstaladorApkModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "No React context" }

  override fun definition() = ModuleDefinition {
    Name("InstaladorApk")

    AsyncFunction("install") { fileUri: String, promise: Promise ->
      SessionInstall.start(context, fileUri, promise) { appContext.currentActivity }
    }
    // Who installed this copy: tells, in the diagnostics, which path an update took.
    Function("installedBy") { installerOf(context) }
  }
}

internal object SessionInstall {
  private const val STATUS_ACTION = "expo.modules.instaladorapk.STATUS"

  fun start(context: Context, fileUri: String, promise: Promise, activity: () -> Activity?) {
    // Not yet allowed to install: Android would send the person to Settings and
    // abort the session on the way back. The system installer resumes instead.
    if (!context.packageManager.canRequestPackageInstalls()) {
      promise.resolve(mapOf("status" to "not-allowed"))
      return
    }
    val file = File(requireNotNull(Uri.parse(fileUri).path) { "Not a file uri" })
    val installer = context.packageManager.packageInstaller
    val sessionId = installer.createSession(paramsFor(context, file))
    try {
      installer.openSession(sessionId).use { session ->
        session.openWrite("base.apk", 0, file.length()).use { output ->
          file.inputStream().use { input -> input.copyTo(output) }
          session.fsync(output)
        }
        listen(context, sessionId, promise, activity)
        session.commit(statusSender(context, sessionId))
      }
    } catch (error: Exception) {
      runCatching { installer.abandonSession(sessionId) }
      throw error
    }
  }

  private fun paramsFor(context: Context, file: File): PackageInstaller.SessionParams {
    val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
    // A file that is not Lilachat fails here, before anything is replaced.
    params.setAppPackageName(context.packageName)
    params.setSize(file.length())
    if (Build.VERSION.SDK_INT >= 31) {
      // Never silent: the person taps «Actualizar» on Android's own dialog.
      params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED)
    }
    if (Build.VERSION.SDK_INT >= 34 && canUseFullScreen(context)) {
      params.setPermissionState(Manifest.permission.USE_FULL_SCREEN_INTENT, PackageInstaller.SessionParams.PERMISSION_STATE_GRANTED)
    }
    return params
  }

  private fun canUseFullScreen(context: Context): Boolean =
    context.getSystemService(NotificationManager::class.java)?.canUseFullScreenIntent() == true

  /** Android answers the commit here: first «ask the person», then the outcome. */
  private fun listen(context: Context, sessionId: Int, promise: Promise, activity: () -> Activity?) {
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(received: Context, intent: Intent) {
        if (intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, -1) != sessionId) return
        val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
          confirmIntent(intent)?.let { confirm -> askPerson(received, confirm, activity()) }
          return
        }
        runCatching { received.applicationContext.unregisterReceiver(this) }
        promise.resolve(outcomeOf(status, intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)))
      }
    }
    val filter = IntentFilter(STATUS_ACTION)
    if (Build.VERSION.SDK_INT >= 33) {
      context.applicationContext.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      context.applicationContext.registerReceiver(receiver, filter)
    }
  }

  @Suppress("DEPRECATION")
  private fun confirmIntent(intent: Intent): Intent? =
    if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
    else intent.getParcelableExtra(Intent.EXTRA_INTENT)

  /** From the open screen when there is one: a start from the background can be refused. */
  private fun askPerson(context: Context, confirm: Intent, activity: Activity?) {
    if (activity != null) activity.startActivity(confirm)
    else context.startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }

  private fun outcomeOf(status: Int, message: String?): Map<String, String?> = when (status) {
    PackageInstaller.STATUS_SUCCESS -> mapOf("status" to "installed")
    PackageInstaller.STATUS_FAILURE_ABORTED -> mapOf("status" to "cancelled")
    else -> mapOf("status" to "failed", "code" to failureCode(status), "message" to message)
  }

  private fun failureCode(status: Int): String = when (status) {
    PackageInstaller.STATUS_FAILURE_STORAGE -> "storage"
    PackageInstaller.STATUS_FAILURE_CONFLICT -> "conflict"
    PackageInstaller.STATUS_FAILURE_INCOMPATIBLE -> "incompatible"
    PackageInstaller.STATUS_FAILURE_INVALID -> "invalid"
    PackageInstaller.STATUS_FAILURE_BLOCKED -> "blocked"
    else -> "failure"
  }

  private fun statusSender(context: Context, sessionId: Int): IntentSender {
    // Explicit (our package) and mutable: Android writes the status into it.
    val intent = Intent(STATUS_ACTION).setPackage(context.packageName)
    val mutable = if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0
    return PendingIntent.getBroadcast(context, sessionId, intent, PendingIntent.FLAG_UPDATE_CURRENT or mutable).intentSender
  }
}

private fun installerOf(context: Context): String? = runCatching {
  if (Build.VERSION.SDK_INT >= 30) context.packageManager.getInstallSourceInfo(context.packageName).installingPackageName
  else @Suppress("DEPRECATION") context.packageManager.getInstallerPackageName(context.packageName)
}.getOrNull()
