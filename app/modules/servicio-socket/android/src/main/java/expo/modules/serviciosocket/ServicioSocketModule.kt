package expo.modules.serviciosocket

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Encender y apagar el servicio desde JavaScript.
 *
 * Deliberadamente mínimo: dos funciones y ningún estado propio. Quién decide
 * cuándo encenderlo —la app pasa a segundo plano, alguien cierra sesión— vive en
 * JS, donde se puede probar.
 */
class ServicioSocketModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ServicioSocket")

    Function("iniciar") {
      val contexto = appContext.reactContext ?: return@Function false
      val intent = Intent(contexto, ServicioEnPrimerPlano::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        contexto.startForegroundService(intent)
      } else {
        contexto.startService(intent)
      }
      true
    }

    Function("detener") {
      val contexto = appContext.reactContext ?: return@Function false
      contexto.stopService(Intent(contexto, ServicioEnPrimerPlano::class.java))
      true
    }
  }
}
