package expo.modules.llamadaentrante

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.ContactsContract

/**
 * El nombre de la AGENDA del teléfono para un número (FL11, José 18/10: el
 * aviso decía «960397018» y no «Wilson Zamora»). Es lo mismo que hace la app con
 * `nombreDeContacto`, pero acá corre con la app cerrada: la agenda nunca sube al
 * server, así que el nombre se resuelve en el teléfono.
 *
 * Sin permiso de contactos, o sin coincidencia, devuelve null y el aviso usa el
 * nombre que mandó el server.
 */
object Agenda {
  fun nombre(contexto: Context, telefono: String?): String? {
    val numero = telefono?.filter { it.isDigit() || it == '+' }.orEmpty()
    if (numero.length < 6) return null
    if (contexto.checkSelfPermission(Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) return null
    // El server guarda los números de Perú sin el +51; la agenda, casi siempre con él.
    val variantes = if (numero.length == 9 && !numero.startsWith("+")) listOf(numero, "+51$numero") else listOf(numero)
    return variantes.firstNotNullOfOrNull { buscar(contexto, it) }
  }

  private fun buscar(contexto: Context, numero: String): String? = try {
    val uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(numero))
    contexto.contentResolver.query(uri, arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME), null, null, null)?.use { cursor ->
      if (cursor.moveToFirst()) cursor.getString(0)?.takeIf { it.isNotBlank() } else null
    }
  } catch (_: Exception) {
    // Un proveedor de contactos que falla no puede tumbar el aviso.
    null
  }
}
