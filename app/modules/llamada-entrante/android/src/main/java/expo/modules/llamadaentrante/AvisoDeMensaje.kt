package expo.modules.llamadaentrante

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import org.json.JSONArray
import org.json.JSONObject

/** Lo que trae el push solo-datos de un mensaje (`pushService.notifyOffline`). */
data class MensajeRecibido(
  val chatId: String,
  val seq: Int,
  val autor: String,
  /** El nombre del grupo; vacío en un 1:1. */
  val chat: String,
  val cuerpo: String,
  /** Chat silenciado: se acusa la entrega pero no se dibuja ni suena. */
  val silencioso: Boolean,
  /** Token corto para confirmar la entrega sin el JWT. */
  val entrega: String?
) {
  companion object {
    fun desdePush(data: Map<String, String>): MensajeRecibido? {
      val chatId = data["chatId"] ?: return null
      return MensajeRecibido(
        chatId = chatId,
        seq = data["seq"]?.toIntOrNull() ?: 0,
        autor = data["autor"]?.takeIf { it.isNotBlank() } ?: "Lilachat",
        chat = data["chat"] ?: "",
        cuerpo = data["cuerpo"] ?: "",
        silencioso = data["silencioso"] == "1",
        entrega = data["entrega"]?.takeIf { it.isNotBlank() }
      )
    }
  }
}

/**
 * El aviso de un mensaje con la app cerrada (FL8.2), y el doble check.
 *
 * Antes lo dibujaba Android solo (notificación común) sin ejecutar nada de la
 * app, y por eso el server nunca se enteraba de la entrega: el otro veía un
 * solo check aunque el mensaje ya estuviera en el teléfono. Ahora llega
 * solo-datos: se confirma la entrega por HTTP con el token del push y se
 * dibuja como WhatsApp, una notificación por chat con sus últimos mensajes.
 */
object AvisoDeMensaje {
  /** El MISMO canal que crea la app (`CANAL_MENSAJES`): si no existe aún, igual. */
  const val CANAL = "mensajes-v2"
  const val EXTRA_CHAT_MENSAJE = "lilachat.mensaje.chatId"
  private const val ARCHIVO = "avisos-de-mensajes"
  /** Cuántos mensajes muestra el aviso de un chat, como WhatsApp. */
  private const val MAXIMO_DE_LINEAS = 7

  fun idDe(chatId: String): Int = 0x2B00 xor chatId.hashCode()

  /**
   * Corre en el hilo de trabajo del servicio de FCM, así que el HTTP va directo.
   * Primero se acusa (es lo que pone el doble check); dibujar es lo segundo.
   */
  fun recibir(contexto: Context, mensaje: MensajeRecibido, appAdelante: Boolean) {
    mensaje.entrega?.let { token ->
      Preferencias.servidor(contexto)?.let { servidor ->
        try {
          Http.postearToken("${servidor.trimEnd('/')}/api/push/entregado", token)
        } catch (_: Exception) {
          // Sin red no llega el acuse: la app lo manda al sincronizar.
        }
      }
    }
    // Con la app adelante el mensaje lo muestra la app (llegó por el socket).
    if (mensaje.silencioso || appAdelante) return
    mostrar(contexto, mensaje)
  }

  private fun mostrar(contexto: Context, mensaje: MensajeRecibido) {
    crearCanal(contexto)
    val lineas = sumarLinea(contexto, mensaje) ?: return
    val yo = Person.Builder().setName("Tú").build()
    val estilo = NotificationCompat.MessagingStyle(yo)
    if (mensaje.chat.isNotBlank()) {
      estilo.conversationTitle = mensaje.chat
      estilo.isGroupConversation = true
    }
    for (linea in lineas) {
      estilo.addMessage(linea.cuerpo, linea.at, Person.Builder().setName(linea.autor).build())
    }
    val aviso = NotificationCompat.Builder(contexto, CANAL)
      .setSmallIcon(AvisoDeLlamada.iconoChico(contexto))
      .setContentTitle(mensaje.chat.ifBlank { mensaje.autor })
      .setContentText(mensaje.cuerpo)
      .setStyle(estilo)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
      .setAutoCancel(true)
      .setNumber(lineas.size)
      .setContentIntent(abrirChat(contexto, mensaje.chatId))
      .build()
    try {
      NotificationManagerCompat.from(contexto).notify(idDe(mensaje.chatId), aviso)
    } catch (_: SecurityException) {
      // Sin permiso de notificaciones: el mensaje igual está, se ve al abrir.
    }
  }

  /** Al abrir el chat en la app: se va su aviso y se olvidan sus líneas. */
  fun limpiar(contexto: Context, chatId: String) {
    NotificationManagerCompat.from(contexto).cancel(idDe(chatId))
    contexto.getSharedPreferences(ARCHIVO, Context.MODE_PRIVATE).edit().remove(chatId).apply()
  }

  private data class Linea(val seq: Int, val autor: String, val cuerpo: String, val at: Long)

  /** Suma el mensaje a las líneas del chat; null si ya estaba (push repetido). */
  private fun sumarLinea(contexto: Context, mensaje: MensajeRecibido): List<Linea>? {
    val preferencias = contexto.getSharedPreferences(ARCHIVO, Context.MODE_PRIVATE)
    val guardadas = leerLineas(preferencias.getString(mensaje.chatId, null))
    if (mensaje.seq > 0 && guardadas.any { it.seq == mensaje.seq }) return null
    val todas = (guardadas + Linea(mensaje.seq, mensaje.autor, mensaje.cuerpo, System.currentTimeMillis()))
      .takeLast(MAXIMO_DE_LINEAS)
    val json = JSONArray()
    for (linea in todas) {
      json.put(JSONObject().put("seq", linea.seq).put("autor", linea.autor).put("cuerpo", linea.cuerpo).put("at", linea.at))
    }
    preferencias.edit().putString(mensaje.chatId, json.toString()).apply()
    return todas
  }

  private fun leerLineas(crudo: String?): List<Linea> {
    if (crudo.isNullOrEmpty()) return emptyList()
    return try {
      val json = JSONArray(crudo)
      (0 until json.length()).map { indice ->
        val linea = json.getJSONObject(indice)
        Linea(linea.optInt("seq"), linea.optString("autor"), linea.optString("cuerpo"), linea.optLong("at"))
      }
    } catch (_: Exception) {
      emptyList()
    }
  }

  private fun abrirChat(contexto: Context, chatId: String): PendingIntent {
    val intent = (contexto.packageManager.getLaunchIntentForPackage(contexto.packageName) ?: Intent())
      .putExtra(EXTRA_CHAT_MENSAJE, chatId)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(
      contexto,
      idDe(chatId),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  /** Igual que el de la app: tono de notificación del teléfono, vibración corta. */
  private fun crearCanal(contexto: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val gestor = contexto.getSystemService(NotificationManager::class.java) ?: return
    if (gestor.getNotificationChannel(CANAL) != null) return
    val canal = NotificationChannel(CANAL, "Mensajes", NotificationManager.IMPORTANCE_HIGH).apply {
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 250, 250, 250)
      lockscreenVisibility = android.app.Notification.VISIBILITY_PRIVATE
    }
    gestor.createNotificationChannel(canal)
  }
}
