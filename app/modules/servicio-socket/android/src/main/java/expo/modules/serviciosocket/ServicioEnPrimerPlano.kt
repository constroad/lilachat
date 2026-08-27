package expo.modules.serviciosocket

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder

/**
 * El servicio que mantiene vivo el proceso —y con él, el socket— cuando la app
 * queda atrás.
 *
 * **Por qué existe:** con la app en segundo plano Android puede matar el proceso
 * o meterlo en Doze, y ahí el socket se cae; los mensajes recién entran al
 * volver a abrir. WhatsApp evita esto con FCM, que es un canal del sistema
 * operativo. Sin Firebase, la única forma de que un socket propio sobreviva es
 * un servicio en primer plano.
 *
 * **El precio, decidido a conciencia:** Android EXIGE una notificación
 * permanente para dejar correr un servicio así. Es la que se ve en la bandeja, y
 * no se puede ocultar — es el trato: el sistema te deja vivir si la persona
 * puede ver que estás vivo.
 *
 * El servicio no hace nada por sí mismo: no abre sockets ni escucha nada. Su
 * único trabajo es que el proceso no muera. El socket sigue siendo el de JS.
 */
class ServicioEnPrimerPlano : Service() {
  companion object {
    const val CANAL = "lilachat.conexion"
    const val ID_AVISO = 4231
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // Desde Android 14 hay que declarar el TIPO al arrancar, y tiene que
    // coincidir con el del manifiesto: si no, el sistema mata el servicio en el
    // acto y el socket se cae igual que antes.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(
        ID_AVISO,
        construirAviso(),
        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
      )
    } else {
      startForeground(ID_AVISO, construirAviso())
    }
    // START_STICKY: si el sistema lo mata por memoria, que lo vuelva a levantar.
    // Es justamente el caso que este servicio existe para cubrir.
    return START_STICKY
  }

  private fun construirAviso(): Notification {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      // Importancia MÍNIMA: tiene que estar, pero no sonar ni asomarse. La
      // burbuja de un mensaje sí es alta; esta es solo una constancia.
      val canal = NotificationChannel(CANAL, "Conexión", NotificationManager.IMPORTANCE_MIN)
      canal.setShowBadge(false)
      manager.createNotificationChannel(canal)
    }

    // Tocarla abre la app, que es lo único razonable que puede hacer.
    val abrir = packageManager.getLaunchIntentForPackage(packageName)
    val pendiente = if (abrir != null) {
      PendingIntent.getActivity(
        this, 0, abrir,
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      )
    } else null

    val constructor = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CANAL)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }

    return constructor
      .setContentTitle("Lilachat")
      // Se dice para QUÉ está Y cómo sacarla: una notificación permanente sin
      // explicación se lee como una app que se cuelga sola, y termina
      // desinstalada. La segunda mitad es del 27/08/2026 — José la vio como algo
      // «de test» justamente porque no ofrecía ninguna salida.
      .setContentText("Recibiendo mensajes · se apaga en Ajustes")
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      /**
       * **Sin hora, y alertando una sola vez.**
       *
       * Acá estaba el «a cada rato me aparece» de José. Una notificación lleva
       * por defecto la hora en que se publicó, y cada `onStartCommand`
       * —reconexión, reinicio por START_STICKY, volver del segundo plano— la
       * republica con hora nueva. Android la reordena como si fuera un aviso
       * recién llegado y **salta al tope de la bandeja**.
       *
       * O sea: la notificación era siempre la misma, pero se comportaba como
       * una nueva varias veces por día. Sin `when` y con `onlyAlertOnce` se
       * queda quieta abajo, que es lo que uno espera de una constancia.
       */
      .setShowWhen(false)
      .setOnlyAlertOnce(true)
      .apply { if (pendiente != null) setContentIntent(pendiente) }
      .build()
  }
}
