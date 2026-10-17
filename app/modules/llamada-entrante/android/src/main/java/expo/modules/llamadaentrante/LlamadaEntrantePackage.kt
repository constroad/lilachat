package expo.modules.llamadaentrante

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener
import java.lang.ref.WeakReference

// En su propio archivo `*Package.kt`: el autolinking de expo encuentra los
// packages por el NOMBRE del archivo, y dentro de otro no lo enlazaba.
/** Engancha la Activity para leer qué se tocó en la notificación de llamada. */
class LlamadaEntrantePackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener?> =
    listOf(OyenteDeActividad())
}

class OyenteDeActividad : ReactActivityLifecycleListener {
  private var actividad: WeakReference<Activity>? = null

  override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
    actividad = WeakReference(activity)
    atender(activity, activity.intent)
  }

  override fun onResume(activity: Activity) {
    actividad = WeakReference(activity)
  }

  override fun onNewIntent(intent: Intent): Boolean {
    actividad?.get()?.let { atender(it, intent) }
    return false
  }

  /**
   * La Activity se abrió desde la notificación (pantalla completa, Contestar o
   * tocarla): se muestra sobre el bloqueo, se apaga la notificación —desde acá
   * suena la app— y JS se entera del chat y de lo que se tocó.
   */
  private fun atender(activity: Activity, intent: Intent?) {
    // Un aviso de MENSAJE: abre ese chat, sin nada de bloqueo (FL8.2).
    intent?.getStringExtra(AvisoDeMensaje.EXTRA_CHAT_MENSAJE)?.let { chatId ->
      intent.removeExtra(AvisoDeMensaje.EXTRA_CHAT_MENSAJE)
      AvisoDeMensaje.limpiar(activity, chatId)
      Puente.emitirChat(chatId)
      return
    }
    val chatId = intent?.getStringExtra(AvisoDeLlamada.EXTRA_CHAT) ?: return
    val accion = intent.getStringExtra(AvisoDeLlamada.EXTRA_ACCION) ?: "abrir"
    // Que una recreación (girar la pantalla) no lo vuelva a atender.
    intent.removeExtra(AvisoDeLlamada.EXTRA_CHAT)
    intent.removeExtra(AvisoDeLlamada.EXTRA_ACCION)
    Bloqueo.mostrar(activity)
    AvisoDeLlamada.quitar(activity, chatId)
    Puente.emitir(chatId, accion)
  }
}
