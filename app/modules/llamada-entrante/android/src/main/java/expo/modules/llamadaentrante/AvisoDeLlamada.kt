package expo.modules.llamadaentrante

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
  private val VIBRACION = longArrayOf(0, 800, 1200)

  fun idDe(chatId: String): Int = 0x11A0 xor chatId.hashCode()

  fun mostrar(contexto: Context, datos: DatosDeLlamada) {
    val restante = datos.expira - System.currentTimeMillis()
    if (restante <= 0) return
    crearCanal(contexto)
    val id = idDe(datos.chatId)
    val abrir = intentDeApp(contexto, datos.chatId, "abrir", id)
    val contestar = intentDeApp(contexto, datos.chatId, "contestar", id + 1)
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
