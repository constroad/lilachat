package expo.modules.llamadaentrante

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.app.RemoteInput
import java.util.UUID
import kotlin.concurrent.thread
import org.json.JSONArray
import org.json.JSONObject

/** Lo que trae el push solo-datos de un mensaje (`pushService.notifyOffline`). */
data class MensajeRecibido(
  val chatId: String,
  val seq: Int,
  val autor: String,
  /** El teléfono de quien escribe, para buscarlo en la agenda (FL11). */
  val telefono: String,
  /** El nombre del grupo; vacío en un 1:1. */
  val chat: String,
  val cuerpo: String,
  /** Chat silenciado: se acusa la entrega pero no se dibuja ni suena. */
  val silencioso: Boolean,
  /** Token corto para confirmar la entrega sin el JWT. */
  val entrega: String?,
  /** Token para «Responder» y «Marcar como leído» (FL11); vacío en un chat secreto. */
  val respuesta: String? = null
) {
  companion object {
    fun desdePush(data: Map<String, String>): MensajeRecibido? {
      val chatId = data["chatId"] ?: return null
      return MensajeRecibido(
        chatId = chatId,
        seq = data["seq"]?.toIntOrNull() ?: 0,
        autor = data["autor"]?.takeIf { it.isNotBlank() } ?: "Lilachat",
        telefono = data["telefono"] ?: "",
        chat = data["chat"] ?: "",
        cuerpo = data["cuerpo"] ?: "",
        silencioso = data["silencioso"] == "1",
        entrega = data["entrega"]?.takeIf { it.isNotBlank() },
        respuesta = data["respuesta"]?.takeIf { it.isNotBlank() }
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
  const val EXTRA_RESPUESTA = "lilachat.mensaje.respuesta"
  const val ACCION_RESPONDER = "lilachat.mensaje.RESPONDER"
  const val ACCION_LEIDO = "lilachat.mensaje.LEIDO"
  const val CLAVE_TEXTO = "lilachat.mensaje.texto"
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

  private fun mostrar(contexto: Context, recibido: MensajeRecibido) {
    crearCanal(contexto)
    // El nombre de la agenda gana, como en la app (FL11).
    val mensaje = recibido.copy(autor = Agenda.nombre(contexto, recibido.telefono) ?: recibido.autor)
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
      // «Responder» y «Marcar como leído», como WhatsApp (FL11). Sin token
      // (server viejo o chat secreto) no se ofrecen.
      .apply { mensaje.respuesta?.let { token -> acciones(contexto, mensaje.chatId, token).forEach { addAction(it) } } }
      .build()
    try {
      NotificationManagerCompat.from(contexto).notify(idDe(mensaje.chatId), aviso)
    } catch (_: SecurityException) {
      // Sin permiso de notificaciones: el mensaje igual está, se ve al abrir.
    }
  }

  private fun acciones(contexto: Context, chatId: String, token: String): List<NotificationCompat.Action> {
    fun intento(accion: String) = Intent(contexto, ReceptorDeMensaje::class.java)
      .setAction(accion)
      .putExtra(EXTRA_CHAT_MENSAJE, chatId)
      .putExtra(EXTRA_RESPUESTA, token)
    // La respuesta en línea necesita un PendingIntent MUTABLE: el sistema le suma el texto.
    val responder = PendingIntent.getBroadcast(
      contexto, idDe(chatId) + 1, intento(ACCION_RESPONDER),
      PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
    )
    val leido = PendingIntent.getBroadcast(
      contexto, idDe(chatId) + 2, intento(ACCION_LEIDO),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    return listOf(
      NotificationCompat.Action.Builder(0, "Responder", responder)
        .addRemoteInput(RemoteInput.Builder(CLAVE_TEXTO).setLabel("Escribe un mensaje").build())
        .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY)
        .setShowsUserInterface(false)
        .build(),
      NotificationCompat.Action.Builder(0, "Marcar como leído", leido)
        .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_MARK_AS_READ)
        .setShowsUserInterface(false)
        .build()
    )
  }

  /**
   * La respuesta no salió: el aviso se cambia por uno que lo dice (si no, Android
   * deja la ruedita de «enviando» para siempre) y abre el chat para reintentar.
   */
  fun avisarFallo(contexto: Context, chatId: String) {
    crearCanal(contexto)
    val aviso = NotificationCompat.Builder(contexto, CANAL)
      .setSmallIcon(AvisoDeLlamada.iconoChico(contexto))
      .setContentTitle("No se envió tu respuesta")
      .setContentText("Toca para abrir el chat y reintentar")
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setOnlyAlertOnce(true)
      .setAutoCancel(true)
      .setContentIntent(abrirChat(contexto, chatId))
      .build()
    try {
      NotificationManagerCompat.from(contexto).notify(idDe(chatId), aviso)
    } catch (_: SecurityException) {
      // Sin permiso de notificaciones no hay a quién decírselo.
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

/**
 * «Responder» y «Marcar como leído» del aviso (FL11), con la app cerrada: lo
 * manda por HTTP con el token del push. Salió bien: el aviso del chat se va,
 * como en WhatsApp al responder. Falló: se dice en el aviso.
 */
class ReceptorDeMensaje : BroadcastReceiver() {
  override fun onReceive(contexto: Context, intent: Intent) {
    val chatId = intent.getStringExtra(AvisoDeMensaje.EXTRA_CHAT_MENSAJE) ?: return
    val token = intent.getStringExtra(AvisoDeMensaje.EXTRA_RESPUESTA) ?: return
    val servidor = Preferencias.servidor(contexto)?.trimEnd('/') ?: return
    val cuerpo = when (intent.action) {
      AvisoDeMensaje.ACCION_RESPONDER -> {
        val texto = RemoteInput.getResultsFromIntent(intent)?.getCharSequence(AvisoDeMensaje.CLAVE_TEXTO)?.toString()?.trim()
        if (texto.isNullOrEmpty()) return
        // La clave del cliente hace idempotente el reintento: el server no la duplica.
        Pair("$servidor/api/push/responder", JSONObject().put("token", token).put("texto", texto).put("clientKey", "aviso-${UUID.randomUUID()}"))
      }
      AvisoDeMensaje.ACCION_LEIDO -> Pair("$servidor/api/push/leido", JSONObject().put("token", token))
      else -> return
    }
    val pendiente = goAsync()
    thread {
      try {
        val codigo = try { Http.postearJson(cuerpo.first, cuerpo.second) } catch (_: Exception) { 0 }
        if (codigo in 200..299) AvisoDeMensaje.limpiar(contexto, chatId)
        else if (intent.action == AvisoDeMensaje.ACCION_RESPONDER) AvisoDeMensaje.avisarFallo(contexto, chatId)
      } finally {
        pendiente.finish()
      }
    }
  }
}
