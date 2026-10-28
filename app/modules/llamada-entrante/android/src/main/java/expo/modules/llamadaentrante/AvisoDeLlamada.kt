package expo.modules.llamadaentrante

import android.app.KeyguardManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person

/** Lo que hace falta para dibujar una llamada entrante. */
data class DatosDeLlamada(
  val chatId: String,
  val nombre: String,
  val video: Boolean,
  /** Hasta cuándo suena (ms). Después la notificación se va sola. */
  val expira: Long,
  /** Token corto para rechazar sin abrir la app; null si la app está viva. */
  val rechazo: String?
) {
  companion object {
    private const val TIMBRE_MS = 30_000L

    /** Del push solo-datos que manda el server (`pushService.avisarLlamada`). */
    fun desdePush(data: Map<String, String>, contexto: Context? = null): DatosDeLlamada? {
      val chatId = data["chatId"] ?: return null
      return DatosDeLlamada(
        chatId = chatId,
        // El nombre de la agenda gana (FL11); sin él, el del server.
        nombre = contexto?.let { Agenda.nombre(it, data["telefono"]) } ?: data["nombre"]?.takeIf { it.isNotBlank() } ?: "Llamada",
        video = data["video"] == "1",
        // Relativo a cuando llegó: el reloj del teléfono puede no ser el del
        // server. Si llega tarde, el «llamada-fin» del server la apaga igual.
        expira = System.currentTimeMillis() + (data["queda"]?.toLongOrNull() ?: TIMBRE_MS),
        rechazo = data["rechazo"]?.takeIf { it.isNotBlank() }
      )
    }

    fun desdeApp(chatId: String, nombre: String, video: Boolean) =
      DatosDeLlamada(chatId, nombre, video, System.currentTimeMillis() + TIMBRE_MS, null)
  }
}

/**
 * La llamada entrante como la dibuja WhatsApp (FL8.1): categoría llamada,
 * pantalla completa sobre el bloqueo, Contestar/Rechazar y el tono del teléfono
 * repitiéndose (`FLAG_INSISTENT`) hasta que se toca algo o vence.
 *
 * El canal tiene su propio sonido (el tono de llamada, no el de mensaje):
 * un canal de Android fija su sonido al crearse, por eso es uno aparte.
 */
object AvisoDeLlamada {
  const val CANAL = "lilachat-llamadas"
  const val EXTRA_CHAT = "lilachat.llamada.chatId"
  const val EXTRA_ACCION = "lilachat.llamada.accion"
  const val EXTRA_RECHAZO = "lilachat.llamada.rechazo"
  const val ACCION_RECHAZAR = "expo.modules.llamadaentrante.RECHAZAR"
  const val ACTION_ANSWER_LOCKED = "expo.modules.llamadaentrante.ANSWER_LOCKED"
  const val EXTRA_NAME = "lilachat.llamada.nombre"
  const val EXTRA_VIDEO = "lilachat.llamada.video"
  /** Without ring: the call already rang, this one only opens the app over the lock. */
  private const val ANSWERING_CHANNEL = "lilachat-llamada-contestando"
  /** As long as the caller waits once «answering» (`CALL_CONNECT_TIMEOUT_MS`). */
  private const val ANSWERING_MS = 45_000L
  private val VIBRACION = longArrayOf(0, 800, 1200)

  fun idDe(chatId: String): Int = 0x11A0 xor chatId.hashCode()

  fun mostrar(contexto: Context, datos: DatosDeLlamada) {
    val restante = datos.expira - System.currentTimeMillis()
    if (restante <= 0) return
    crearCanal(contexto)
    val id = idDe(datos.chatId)
    val abrir = intentDeApp(contexto, datos.chatId, "abrir", id)
    // Backlog 114: on a locked phone an activity button asks for the code first, and the ring
    // ran out on the caller while it was typed. Locked, «Contestar» is a broadcast: no unlock.
    val contestar = if (locked(contexto)) answerLocked(contexto, datos, id + 1) else intentDeApp(contexto, datos.chatId, "contestar", id + 1)
    val rechazar = PendingIntent.getBroadcast(
      contexto,
      id + 2,
      Intent(contexto, ReceptorDeLlamada::class.java)
        .setAction(ACCION_RECHAZAR)
        .putExtra(EXTRA_CHAT, datos.chatId)
        .putExtra(EXTRA_RECHAZO, datos.rechazo),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val persona = Person.Builder().setName(datos.nombre).setImportant(true).build()
    val aviso = NotificationCompat.Builder(contexto, CANAL)
      .setSmallIcon(iconoChico(contexto))
      .setContentTitle(datos.nombre)
      .setContentText(if (datos.video) "Videollamada entrante" else "Llamada entrante")
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(false)
      .setTimeoutAfter(restante)
      .setContentIntent(abrir)
      .setFullScreenIntent(abrir, true)
      .setStyle(NotificationCompat.CallStyle.forIncomingCall(persona, rechazar, contestar))
      .addPerson(persona)
      // Antes de Android 8 no hay canales: el sonido y la vibración van acá.
      .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE))
      .setVibrate(VIBRACION)
      .build()
    aviso.flags = aviso.flags or Notification.FLAG_INSISTENT
    try {
      NotificationManagerCompat.from(contexto).notify(id, aviso)
    } catch (_: SecurityException) {
      // Sin permiso de notificaciones no hay cómo sonar: la llamada igual se
      // ve al abrir la app (el server la guarda mientras suena).
    }
  }

  fun quitar(contexto: Context, chatId: String) {
    NotificationManagerCompat.from(contexto).cancel(idDe(chatId))
    NotificationManagerCompat.from(contexto).cancel(answeringIdOf(chatId))
  }

  private fun answeringIdOf(chatId: String): Int = idDe(chatId) + 3

  private fun locked(context: Context): Boolean =
    context.getSystemService(KeyguardManager::class.java)?.isKeyguardLocked ?: false

  private fun answerLocked(context: Context, call: DatosDeLlamada, code: Int): PendingIntent = PendingIntent.getBroadcast(
    context,
    code,
    Intent(context, ReceptorDeLlamada::class.java)
      .setAction(ACTION_ANSWER_LOCKED)
      .putExtra(EXTRA_CHAT, call.chatId)
      .putExtra(EXTRA_RECHAZO, call.rechazo)
      .putExtra(EXTRA_NAME, call.nombre)
      .putExtra(EXTRA_VIDEO, call.video),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
  )

  /**
   * «Contestar» tapped on the lock screen: the ring stops, and a silent full
   * screen notice opens the app OVER the lock with «contestar», the same way
   * the incoming call does. Without full screen permission it stays as a
   * heads-up «Contestando…» to tap (that one does ask for the code, but the
   * caller already waits). JS, when alive, says «answering» by socket.
   */
  fun showAnswering(context: Context, intent: Intent) {
    val chatId = intent.getStringExtra(EXTRA_CHAT) ?: return
    NotificationManagerCompat.from(context).cancel(idDe(chatId))
    Tono.detener()
    Puente.emitir(chatId, "answering")
    createAnsweringChannel(context)
    val open = intentDeApp(context, chatId, "contestar", answeringIdOf(chatId))
    val video = intent.getBooleanExtra(EXTRA_VIDEO, false)
    val notice = NotificationCompat.Builder(context, ANSWERING_CHANNEL)
      .setSmallIcon(iconoChico(context))
      .setContentTitle(intent.getStringExtra(EXTRA_NAME) ?: "Llamada")
      .setContentText(if (video) "Contestando la videollamada…" else "Contestando…")
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setTimeoutAfter(ANSWERING_MS)
      .setContentIntent(open)
      .setFullScreenIntent(open, true)
      .build()
    try {
      NotificationManagerCompat.from(context).notify(answeringIdOf(chatId), notice)
    } catch (_: SecurityException) {
      // Without notification permission the app still opens from its icon; the caller waits.
    }
  }

  private fun createAnsweringChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(ANSWERING_CHANNEL) != null) return
    val channel = NotificationChannel(ANSWERING_CHANNEL, "Llamada contestada", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Abre la llamada que contestaste con el teléfono bloqueado"
      setSound(null, null)
      enableVibration(false)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    }
    manager.createNotificationChannel(channel)
  }

  private fun crearCanal(contexto: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val gestor = contexto.getSystemService(NotificationManager::class.java) ?: return
    if (gestor.getNotificationChannel(CANAL) != null) return
    val canal = NotificationChannel(CANAL, "Llamadas", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Llamadas entrantes"
      setSound(
        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
      )
      enableVibration(true)
      vibrationPattern = VIBRACION
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    }
    gestor.createNotificationChannel(canal)
  }

  /** La app con el chat y lo que se tocó; la Activity lo lee al crearse. */
  private fun intentDeApp(contexto: Context, chatId: String, accion: String, codigo: Int): PendingIntent {
    val intent = (contexto.packageManager.getLaunchIntentForPackage(contexto.packageName) ?: Intent())
      .putExtra(EXTRA_CHAT, chatId)
      .putExtra(EXTRA_ACCION, accion)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(
      contexto,
      codigo,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  /** The brand color the small icon is tinted with (`notification_icon_color`, from the expo-notifications plugin). */
  fun brandColor(context: Context): Int? {
    val id = context.resources.getIdentifier("notification_icon_color", "color", context.packageName)
    return if (id != 0) androidx.core.content.ContextCompat.getColor(context, id) else null
  }

  /** El ícono de notificación si la app tiene uno; si no, el de la app. */
  fun iconoChico(contexto: Context): Int {
    val propio = contexto.resources.getIdentifier("notification_icon", "drawable", contexto.packageName)
    return if (propio != 0) propio else contexto.applicationInfo.icon
  }
}
