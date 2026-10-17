package expo.modules.llamadaentrante

import android.app.ActivityManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/**
 * El servicio de FCM de la app (FL8.1). EXTIENDE al de expo-notifications: la
 * llamada (`tipo: llamada`) y su fin se atienden acá, aun con la app cerrada;
 * todo lo demás sigue al delegado de expo como siempre.
 */
class ServicioDeAvisos : ExpoFirebaseMessagingService() {
  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    val data = remoteMessage.data
    when (data["tipo"]) {
      // Con la app adelante la llamada la dibuja la app (llega por el socket).
      "llamada" -> if (!appAdelante()) DatosDeLlamada.desdePush(data)?.let { AvisoDeLlamada.mostrar(this, it) }
      "llamada-fin" -> data["chatId"]?.let { AvisoDeLlamada.quitar(this, it) }
      else -> super.onMessageReceived(remoteMessage)
    }
  }

  private fun appAdelante(): Boolean {
    val info = ActivityManager.RunningAppProcessInfo()
    ActivityManager.getMyMemoryState(info)
    return info.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
  }
}

/**
 * «Rechazar» en la notificación. Con el token del push se rechaza por HTTP,
 * sin abrir la app; si la app está viva, además se le avisa a JS para que
 * cierre su pantalla de llamada.
 */
class ReceptorDeLlamada : BroadcastReceiver() {
  override fun onReceive(contexto: Context, intent: Intent) {
    if (intent.action != AvisoDeLlamada.ACCION_RECHAZAR) return
    val chatId = intent.getStringExtra(AvisoDeLlamada.EXTRA_CHAT) ?: return
    AvisoDeLlamada.quitar(contexto, chatId)
    Tono.detener()
    Puente.emitir(chatId, "rechazar")
    val token = intent.getStringExtra(AvisoDeLlamada.EXTRA_RECHAZO)
    val servidor = Preferencias.servidor(contexto)
    if (token.isNullOrEmpty() || servidor.isNullOrEmpty()) return
    val pendiente = goAsync()
    thread {
      try {
        rechazarPorHttp(servidor, token)
      } catch (_: Exception) {
        // Sin red el rechazo no llega: a quien llama le vence el timbre igual.
      } finally {
        pendiente.finish()
      }
    }
  }

  private fun rechazarPorHttp(servidor: String, token: String) {
    val conexion = URL("${servidor.trimEnd('/')}/api/calls/rechazar").openConnection() as HttpURLConnection
    try {
      conexion.requestMethod = "POST"
      conexion.connectTimeout = 8_000
      conexion.readTimeout = 8_000
      conexion.doOutput = true
      conexion.setRequestProperty("Content-Type", "application/json")
      val cuerpo = "{\"token\":\"${token.replace("\"", "")}\"}"
      conexion.outputStream.use { it.write(cuerpo.toByteArray()) }
      conexion.responseCode
    } finally {
      conexion.disconnect()
    }
  }
}

/** Lo que se tocó en la notificación, de la parte nativa a JS. */
object Puente {
  private const val VIGENCIA_MS = 40_000L

  @Volatile var oyente: ((String, String) -> Unit)? = null
  @Volatile private var pendiente: Triple<String, String, Long>? = null

  /** Se guarda SIEMPRE: JS puede no estar escuchando todavía (arranque en frío). */
  fun emitir(chatId: String, accion: String) {
    pendiente = Triple(chatId, accion, System.currentTimeMillis())
    oyente?.invoke(chatId, accion)
  }

  fun tomarPendiente(): Pair<String, String>? {
    val actual = pendiente ?: return null
    pendiente = null
    return if (System.currentTimeMillis() - actual.third <= VIGENCIA_MS) Pair(actual.first, actual.second) else null
  }
}

/** El tono de llamada con la app adelante: el del teléfono, repitiéndose. */
object Tono {
  private var actual: Ringtone? = null

  fun iniciar(contexto: Context) {
    detener()
    val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE) ?: return
    val tono = RingtoneManager.getRingtone(contexto, uri) ?: return
    // Uso «tono de llamada»: respeta el modo silencio y el volumen de timbre.
    tono.audioAttributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) tono.isLooping = true
    tono.play()
    actual = tono
  }

  fun detener() {
    actual?.stop()
    actual = null
  }
}

/**
 * La URL del server, para rechazar con la app cerrada. La pone JS al
 * arrancar (`configurar`): `EXPO_PUBLIC_API_URL` solo existe del lado JS.
 */
object Preferencias {
  private const val ARCHIVO = "llamada-entrante"
  private const val SERVIDOR = "servidor"

  fun guardarServidor(contexto: Context, servidor: String) {
    contexto.getSharedPreferences(ARCHIVO, Context.MODE_PRIVATE).edit().putString(SERVIDOR, servidor).apply()
  }

  fun servidor(contexto: Context): String? =
    contexto.getSharedPreferences(ARCHIVO, Context.MODE_PRIVATE).getString(SERVIDOR, null)
}
