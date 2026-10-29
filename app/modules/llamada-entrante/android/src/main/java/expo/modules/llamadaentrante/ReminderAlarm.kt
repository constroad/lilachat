package expo.modules.llamadaentrante

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/** A reminder that rang: what the full-screen notice and the app's big screen show. */
data class ReminderAlarmData(val id: String, val title: String, val note: String, val chat: String, val chatId: String) {
  fun into(intent: Intent): Intent = intent
    .putExtra(ReminderAlarm.EXTRA_ID, id)
    .putExtra(ReminderAlarm.EXTRA_TITLE, title)
    .putExtra(ReminderAlarm.EXTRA_NOTE, note)
    .putExtra(ReminderAlarm.EXTRA_CHAT, chat)
    .putExtra(ReminderAlarm.EXTRA_CHAT_ID, chatId)

  fun asMap(): Map<String, String> = mapOf("id" to id, "title" to title, "note" to note, "chat" to chat, "chatId" to chatId)

  companion object {
    /** The data push of a reminder (`reminderCron`, pending 63). */
    fun fromPush(data: Map<String, String>): ReminderAlarmData? {
      val id = data["recordatorioId"]?.takeIf { it.isNotBlank() } ?: return null
      return ReminderAlarmData(id, data["titulo"]?.takeIf { it.isNotBlank() } ?: "Recordatorio", data["nota"] ?: "", data["chat"] ?: "", data["chatId"] ?: "")
    }

    fun fromIntent(intent: Intent?): ReminderAlarmData? {
      val id = intent?.getStringExtra(ReminderAlarm.EXTRA_ID) ?: return null
      return ReminderAlarmData(id, intent.getStringExtra(ReminderAlarm.EXTRA_TITLE) ?: "Recordatorio", intent.getStringExtra(ReminderAlarm.EXTRA_NOTE) ?: "", intent.getStringExtra(ReminderAlarm.EXTRA_CHAT) ?: "", intent.getStringExtra(ReminderAlarm.EXTRA_CHAT_ID) ?: "")
    }

    fun fromMap(map: Map<String, Any?>): ReminderAlarmData? {
      val id = map["id"] as? String ?: return null
      return ReminderAlarmData(id, map["title"] as? String ?: "Recordatorio", map["note"] as? String ?: "", map["chat"] as? String ?: "", map["chatId"] as? String ?: "")
    }
  }
}

/**
 * A reminder that turns the screen on and shows itself big, like Google
 * Calendar (pending 63, José 22/10): a full-screen notice (the same permission
 * as calls) that opens the app on its reminder screen, with «Listo» and
 * «Posponer 10 min». Snoozing needs no server: the phone shows it again with
 * AlarmManager.
 */
object ReminderAlarm {
  const val CHANNEL = "recordatorios-v1"
  const val EXTRA_ID = "lilachat.recordatorio.id"
  const val EXTRA_TITLE = "lilachat.recordatorio.titulo"
  const val EXTRA_NOTE = "lilachat.recordatorio.nota"
  const val EXTRA_CHAT = "lilachat.recordatorio.chat"
  const val EXTRA_CHAT_ID = "lilachat.recordatorio.chatId"
  const val ACTION_DONE = "lilachat.recordatorio.LISTO"
  const val ACTION_SNOOZE = "lilachat.recordatorio.POSPONER"
  const val ACTION_RING = "lilachat.recordatorio.SONAR"
  private const val SNOOZE_MS = 10 * 60_000L
  private val VIBRATION = longArrayOf(0, 600, 400, 600)

  fun idOf(reminderId: String): Int = 0x3C00 xor reminderId.hashCode()

  fun show(context: Context, alarm: ReminderAlarmData) {
    createChannel(context)
    val id = idOf(alarm.id)
    val launch = (context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent())
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    val open = PendingIntent.getActivity(context, id, alarm.into(launch), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val notice = NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(AvisoDeLlamada.iconoChico(context))
      .apply { AvisoDeLlamada.brandColor(context)?.let { setColor(it) } }
      .setContentTitle(alarm.title)
      .setContentText(alarm.note.ifBlank { if (alarm.chat.isBlank()) "Recordatorio" else alarm.chat })
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setAutoCancel(true)
      .setContentIntent(open)
      .setFullScreenIntent(open, true)
      .addAction(0, "Posponer 10 min", broadcast(context, ACTION_SNOOZE, alarm, id + 1))
      .addAction(0, "Listo", broadcast(context, ACTION_DONE, alarm, id + 2))
      .setVibrate(VIBRATION)
      .build()
    try {
      NotificationManagerCompat.from(context).notify(id, notice)
    } catch (_: SecurityException) {
      // Without notification permission there is no way to ring: the reminder is still in the app.
    }
  }

  fun dismiss(context: Context, reminderId: String) {
    NotificationManagerCompat.from(context).cancel(idOf(reminderId))
  }

  /**
   * Again in 10 minutes, from the phone itself. Exact when the phone allows
   * exact alarms; otherwise Android may move it a few minutes (still while idle).
   */
  fun snooze(context: Context, alarm: ReminderAlarmData) {
    dismiss(context, alarm.id)
    val manager = context.getSystemService(AlarmManager::class.java) ?: return
    val ring = broadcast(context, ACTION_RING, alarm, idOf(alarm.id) + 3)
    val at = System.currentTimeMillis() + SNOOZE_MS
    val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager.canScheduleExactAlarms()
    when {
      Build.VERSION.SDK_INT < Build.VERSION_CODES.M -> manager.set(AlarmManager.RTC_WAKEUP, at, ring)
      exact -> manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, ring)
      else -> manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, ring)
    }
  }

  private fun broadcast(context: Context, action: String, alarm: ReminderAlarmData, code: Int): PendingIntent =
    PendingIntent.getBroadcast(context, code, alarm.into(Intent(context, ReminderAlarmReceiver::class.java).setAction(action)), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

  private fun createChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(CHANNEL) != null) return
    val channel = NotificationChannel(CHANNEL, "Recordatorios", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Recordatorios que suenan a pantalla completa"
      setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
      enableVibration(true)
      vibrationPattern = VIBRATION
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    }
    manager.createNotificationChannel(channel)
  }
}

/** «Listo», «Posponer 10 min» and the snoozed ring coming back. */
class ReminderAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val alarm = ReminderAlarmData.fromIntent(intent) ?: return
    when (intent.action) {
      ReminderAlarm.ACTION_DONE -> ReminderAlarm.dismiss(context, alarm.id)
      ReminderAlarm.ACTION_SNOOZE -> ReminderAlarm.snooze(context, alarm)
      ReminderAlarm.ACTION_RING -> ReminderAlarm.show(context, alarm)
    }
  }
}
