package expo.modules.llamadaentrante

import android.app.Activity
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.WindowManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** El lado JS de la llamada entrante nativa (FL8.1). */
class LlamadaEntranteModule : Module() {
  private val contexto: Context
    get() = requireNotNull(appContext.reactContext) { "Sin contexto de React" }

  override fun definition() = ModuleDefinition {
    Name("LlamadaEntrante")
    Events("onAccion")

    OnCreate {
      Puente.oyente = { chatId, accion -> sendEvent("onAccion", mapOf("chatId" to chatId, "accion" to accion)) }
    }
    OnDestroy { Puente.oyente = null }

    Function("configurar") { servidor: String -> Preferencias.guardarServidor(contexto, servidor) }
    // La app viva pero DE FONDO recibió la oferta por el socket: la dibuja igual
    // que si hubiera llegado por push (sin token: el rechazo va por JS).
    Function("mostrar") { chatId: String, nombre: String, video: Boolean ->
      AvisoDeLlamada.mostrar(contexto, DatosDeLlamada.desdeApp(chatId, nombre, video))
    }
    Function("quitar") { chatId: String -> AvisoDeLlamada.quitar(contexto, chatId) }
    Function("iniciarTono") { Tono.iniciar(contexto) }
    Function("detenerTono") { Tono.detener() }
    Function("accionPendiente") {
      Puente.tomarPendiente()?.let { mapOf("chatId" to it.first, "accion" to it.second) }
    }
    Function("soltarBloqueo") { Bloqueo.soltar(appContext.currentActivity) }
    // FL8.2: el aviso de mensaje tocado, y limpiar el de un chat al abrirlo.
    Function("chatPendiente") { Puente.tomarChatPendiente() }
    Function("limpiarChat") { chatId: String -> AvisoDeMensaje.limpiar(contexto, chatId) }
    Function("puedePantallaCompleta") {
      if (Build.VERSION.SDK_INT < 34) true
      else contexto.getSystemService(NotificationManager::class.java)?.canUseFullScreenIntent() ?: false
    }
    Function("abrirAjustesPantallaCompleta") {
      if (Build.VERSION.SDK_INT >= 34) {
        contexto.startActivity(
          Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
            .setData(Uri.parse("package:${contexto.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
      }
    }
  }
}

/**
 * Mostrar la app SOBRE el bloqueo mientras dura una llamada, y soltarlo al
 * terminar: si quedara puesto, cualquiera con el teléfono bloqueado podría
 * recorrer los chats después de colgar.
 */
object Bloqueo {
  fun mostrar(actividad: Activity) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      actividad.setShowWhenLocked(true)
      actividad.setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      actividad.window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    }
  }

  fun soltar(actividad: Activity?) {
    actividad ?: return
    actividad.runOnUiThread {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        actividad.setShowWhenLocked(false)
        actividad.setTurnScreenOn(false)
      } else {
        @Suppress("DEPRECATION")
        actividad.window.clearFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
      }
    }
  }
}
