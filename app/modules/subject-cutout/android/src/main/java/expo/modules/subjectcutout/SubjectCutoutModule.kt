package expo.modules.subjectcutout

import android.net.Uri
import android.os.Handler
import android.os.Looper
import com.google.android.gms.common.moduleinstall.InstallStatusListener
import com.google.android.gms.common.moduleinstall.ModuleInstall
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest
import com.google.android.gms.common.moduleinstall.ModuleInstallStatusUpdate
import com.google.android.gms.common.moduleinstall.ModuleInstallStatusUpdate.InstallState
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/** How long the first model download is awaited before going on without the cutout. */
private const val MODEL_WAIT_MS = 45_000L

/**
 * Removes the background of a photo and builds the sticker (José, 20/10: «I
 * upload a photo, WhatsApp removes the background, I add text and make the
 * sticker»). The cutout is ML Kit Subject Segmentation on the phone; the
 * composition (outline, text, emojis, pencil, 512×512 WebP) is `Composition`.
 */
class SubjectCutoutModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext) { "No Android context" }
  private val segmenter by lazy {
    SubjectSegmentation.getClient(SubjectSegmenterOptions.Builder().enableForegroundConfidenceMask().build())
  }
  /** The mask is built off the main thread: it walks every pixel. */
  private val worker = Executors.newSingleThreadExecutor()

  override fun definition() = ModuleDefinition {
    Name("SubjectCutout")

    /**
     * Is the model there? If not, ask Play services and WAIT for it (with a
     * limit): it used to answer `false` at once and the first cutout always
     * failed even if the model arrived seconds later (E2E, 20/10).
     */
    AsyncFunction("prepare") { promise: Promise ->
      val client = ModuleInstall.getClient(context)
      val settled = AtomicBoolean(false)
      val finish = { ready: Boolean -> if (settled.compareAndSet(false, true)) promise.resolve(ready) }
      client.areModulesAvailable(segmenter)
        .addOnSuccessListener { availability ->
          if (availability.areModulesAvailable()) return@addOnSuccessListener finish(true)
          val listener = object : InstallStatusListener {
            override fun onInstallStatusUpdated(update: ModuleInstallStatusUpdate) {
              val state = update.installState
              if (state != InstallState.STATE_COMPLETED && state != InstallState.STATE_FAILED && state != InstallState.STATE_CANCELED) return
              client.unregisterListener(this)
              finish(state == InstallState.STATE_COMPLETED)
            }
          }
          client.installModules(ModuleInstallRequest.newBuilder().addApi(segmenter).setListener(listener).build())
            .addOnSuccessListener { response -> if (response.areModulesAlreadyInstalled()) finish(true) }
            .addOnFailureListener { finish(false) }
          Handler(Looper.getMainLooper()).postDelayed({ client.unregisterListener(listener); finish(false) }, MODEL_WAIT_MS)
        }
        .addOnFailureListener { finish(false) }
    }

    /** The working copy of the picked photo: oriented and at most 1280 px (see `CutoutMask`). */
    AsyncFunction("preparePhoto") { uri: String, promise: Promise ->
      try {
        val photo = CutoutMask.preparePhoto(context, uri)
        promise.resolve(mapOf("uri" to Uri.fromFile(photo.file).toString(), "width" to photo.width, "height" to photo.height))
      } catch (error: Exception) {
        promise.reject("ERR_PHOTO", "No se pudo leer la foto.", error)
      }
    }

    /** ML Kit's mask over the working copy: soft edges, without loose small pieces (transparent PNG). */
    AsyncFunction("cutout") { photoUri: String, promise: Promise ->
      val image = try {
        InputImage.fromFilePath(context, Uri.parse(photoUri))
      } catch (error: Exception) {
        return@AsyncFunction promise.reject("ERR_PHOTO", "No se pudo leer la foto.", error)
      }
      segmenter.process(image)
        .addOnSuccessListener(worker) { result ->
          val confidence = result.foregroundConfidenceMask
          val mask = confidence?.let { CutoutMask.fromConfidence(it, image.width, image.height) }
            ?: return@addOnSuccessListener promise.reject("ERR_NO_SUBJECT", "No se encontró a nadie ni nada para recortar.", null)
          promise.resolve(mapOf("uri" to Uri.fromFile(CutoutMask.saveMask(context, mask)).toString()))
        }
        .addOnFailureListener(worker) { error ->
          // No model yet (just installed, no Play services): the app goes on without the cutout.
          promise.reject("ERR_MODEL", "El recorte automático no está listo todavía.", error)
        }
    }

    /** The photo through the mask (or whole) with the erase/restore strokes, cropped: `{uri, width, height, box}`. */
    AsyncFunction("refine") { request: String, promise: Promise ->
      try {
        val json = JSONObject(request)
        val mask = if (json.isNull("mask")) null else json.optString("mask").ifEmpty { null }
        val refined = CutoutMask.refine(context, json.getString("photo"), mask, CutoutMask.strokesFrom(json))
          ?: return@AsyncFunction promise.reject("ERR_EMPTY", "Borraste todo: restaura una parte o deshaz.", null)
        val box = mapOf("x" to refined.box.left, "y" to refined.box.top, "width" to refined.box.width(), "height" to refined.box.height())
        promise.resolve(mapOf("uri" to Uri.fromFile(refined.file).toString(), "width" to refined.width, "height" to refined.height, "box" to box))
      } catch (error: Exception) {
        promise.reject("ERR_REFINE", "No se pudo aplicar el borrador.", error)
      }
    }

    /** The final sticker: 512×512 WebP with the optional white outline and the layers. JSON as in `Composition.Request`. */
    AsyncFunction("compose") { request: String, promise: Promise ->
      try {
        val output = Composition.compose(context, Composition.Request.from(request))
        promise.resolve(mapOf("uri" to Uri.fromFile(output).toString(), "bytes" to output.length()))
      } catch (error: Exception) {
        promise.reject("ERR_COMPOSE", "No se pudo armar el sticker.", error)
      }
    }
  }
}
