package expo.modules.llamadaentrante

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.Person

/**
 * La llamada EN CURSO (FL11, José y Wilson en teléfonos reales, 18/10/2026):
 * al cambiar de app en plena llamada se dejaba de oír y al volver sonaba otra
 * vez. Android congela una app de fondo que no tiene un servicio en primer
 * plano, y con ella el audio. WhatsApp sostiene la llamada con un servicio así y
 * su notificación fija «Llamada en curso · Colgar»; esto es lo mismo.
 *
 * Tipo `microphone`: la llamada usa el micrófono, y desde Android 14 el tipo es
 * obligatorio y tiene que coincidir con el del manifiesto. Se arranca con la app
 * adelante (al llamar o al contestar), que es cuando Android lo permite.
 */
class ServicioDeLlamada : Service() {
  companion object {
    /**
     * Importancia por defecto pero SIN sonido: con la baja quedaba plegada en
     * «Silenciosas» y «Colgar» no se veía (E2E del 18/10).
     */
    const val CANAL = "lilachat-en-llamada"
    const val ID_AVISO = 4232
    const val EXTRA_NOMBRE = "lilachat.encurso.nombre"
    const val EXTRA_VIDEO = "lilachat.encurso.video"
    /** Desde cuándo está conectada (ms); 0 = todavía llamando. */
    const val EXTRA_DESDE = "lilachat.encurso.desde"
    const val ACCION_COLGAR = "lilachat.llamada.COLGAR"

    /** Si el servicio ya corre: actualizar el aviso no necesita arrancarlo otra vez. */
    @Volatile private var corriendo = false

    fun iniciar(contexto: Context, chatId: String, nombre: String, video: Boolean, desde: Long) {
      // Contestada con la app atrás: Android 12+ no deja arrancar un servicio
      // desde el fondo, pero sí cambiar el aviso del que ya está corriendo.
      if (corriendo) {
        val manager = contexto.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(ID_AVISO, construirAviso(contexto, chatId, nombre, video, desde))
        return
      }
      val intent = Intent(contexto, ServicioDeLlamada::class.java)
        .putExtra(AvisoDeLlamada.EXTRA_CHAT, chatId)
        .putExtra(EXTRA_NOMBRE, nombre)
        .putExtra(EXTRA_VIDEO, video)
        .putExtra(EXTRA_DESDE, desde)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) contexto.startForegroundService(intent)
      else contexto.startService(intent)
    }

    fun detener(contexto: Context) {
      contexto.stopService(Intent(contexto, ServicioDeLlamada::class.java))
    }

    fun construirAviso(contexto: Context, chatId: String, nombre: String, video: Boolean, desde: Long): Notification {
      val manager = contexto.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        // Sin sonido ni vibración: es una constancia de la llamada, no un aviso nuevo.
        val canal = NotificationChannel(CANAL, "Llamada en curso", NotificationManager.IMPORTANCE_DEFAULT).apply {
          setSound(null, null)
          enableVibration(false)
        }
        manager.createNotificationChannel(canal)
      }
      val abrir = contexto.packageManager.getLaunchIntentForPackage(contexto.packageName)?.let {
        PendingIntent.getActivity(contexto, 1, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
      }
      val colgar = PendingIntent.getBroadcast(
        contexto, 2,
        Intent(contexto, ReceptorDeLlamada::class.java).setAction(ACCION_COLGAR).putExtra(AvisoDeLlamada.EXTRA_CHAT, chatId),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      )
      val tipo = if (video) "Videollamada" else "Llamada"
      val persona = Person.Builder().setName(nombre).setImportant(true).build()
      return NotificationCompat.Builder(contexto, CANAL)
        .setSmallIcon(AvisoDeLlamada.iconoChico(contexto))
        .setContentTitle(nombre)
        .setContentText(if (desde > 0) "$tipo en curso" else "Llamando…")
        .setCategory(NotificationCompat.CATEGORY_CALL)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        // El reloj de la llamada, como WhatsApp: corre solo desde que conectó.
        .apply { if (desde > 0) setWhen(desde).setUsesChronometer(true).setShowWhen(true) else setShowWhen(false) }
        .apply { if (abrir != null) setContentIntent(abrir) }
        // El estilo de llamada del sistema, como WhatsApp: arriba de la bandeja
        // y con «Colgar» a la vista (permitido porque lo sostiene el servicio).
        .setStyle(NotificationCompat.CallStyle.forOngoingCall(persona, colgar))
        .addPerson(persona)
        .build()
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    corriendo = true
    val aviso = construirAviso(
      this,
      chatId = intent?.getStringExtra(AvisoDeLlamada.EXTRA_CHAT) ?: "",
      nombre = intent?.getStringExtra(EXTRA_NOMBRE) ?: "Llamada",
      video = intent?.getBooleanExtra(EXTRA_VIDEO, false) ?: false,
      desde = intent?.getLongExtra(EXTRA_DESDE, 0L) ?: 0L
    )
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      startForeground(ID_AVISO, aviso, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
    } else {
      startForeground(ID_AVISO, aviso)
    }
    // Si el sistema lo mata, NO se levanta solo: sin la app no hay llamada que sostener.
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    corriendo = false
    super.onDestroy()
  }
}
