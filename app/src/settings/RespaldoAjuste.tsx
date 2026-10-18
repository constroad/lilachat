import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { haceCuanto, passphraseValida } from '@lilachat/shared';
import { estadoDeRespaldos, type EstadoDeRespaldos } from '../api/client';
import type { Credential } from '../auth/credentialStore';
import { leerChatsGuardados } from '../chat/chatsGuardados';
import { correrRespaldo } from '../respaldo/correrRespaldo';
import {
  ESTADO_INICIAL,
  guardarEstadoDeRespaldo,
  leerEstadoDeRespaldo,
  type EstadoDeRespaldo,
} from '../respaldo/estadoDeRespaldo';
import { guardarPassphrase, leerPassphrase } from '../respaldo/passphraseDeRespaldo';
import { fraseDeEstado } from '../respaldo/planDeRespaldo';
import { registrarTareaDeFondo } from '../respaldo/tareaDeFondo';
import { useColores } from '../ui/tema';
import { RestaurarRespaldo } from './RestaurarRespaldo';

/**
 * Ajuste «Copia de seguridad» (F12.1; antes «Respaldo en la mini», que solo
 * entendía quien conoce la mini): la copia de tus chats, cifrada en el
 * teléfono con una passphrase que el server nunca ve. Es EL respaldo de
 * Ajustes (FL10); el volcado del server queda para operadores.
 *
 * Tres estados: sin passphrase (crearla, con la advertencia sin letra chica),
 * con passphrase (lo último que pasó + «Respaldar ahora»), y respaldando.
 * Lo que dice sale de `fraseDeEstado` (puro, con test); acá solo se dibuja.
 */
const PRESUPUESTO_A_MANO_MS = 3 * 60_000;

export function RespaldoAjuste({ credential }: { credential: Credential }) {
  const colores = useColores();
  const [hayPassphrase, setHayPassphrase] = useState<boolean | null>(null);
  const [estado, setEstado] = useState<EstadoDeRespaldo>(ESTADO_INICIAL);
  const [enMini, setEnMini] = useState<EstadoDeRespaldos | null>(null);
  const [creando, setCreando] = useState(false);
  const [respaldando, setRespaldando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);

  const recargar = useCallback(async () => {
    const [passphrase, guardado] = await Promise.all([leerPassphrase(), leerEstadoDeRespaldo()]);
    setHayPassphrase(Boolean(passphrase));
    setEstado(guardado);
  }, []);

  useEffect(() => {
    void recargar();
    void estadoDeRespaldos(credential.jwt).then((respuesta) => {
      if (respuesta.ok) setEnMini(respuesta.data);
    });
  }, [credential.jwt, recargar]);

  const respaldarAhora = useCallback(async () => {
    setRespaldando(true);
    const resultado = await correrRespaldo({
      jwt: credential.jwt,
      telefono: credential.phone,
      chats: (await leerChatsGuardados()) ?? [],
      forzado: true,
      presupuestoMs: PRESUPUESTO_A_MANO_MS,
    });
    setEstado(resultado.estado);
    setRespaldando(false);
    const enServer = await estadoDeRespaldos(credential.jwt);
    if (enServer.ok) setEnMini(enServer.data);
  }, [credential.jwt, credential.phone]);

  if (hayPassphrase === null) return null;

  const frase = fraseDeEstado(hayPassphrase ? estado : { ...estado, decision: 'sin_passphrase' }, Date.now());

  return (
    <View className="mt-2 rounded-xl border border-outline/10 bg-surface p-4" testID="ajuste-respaldo">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck size={18} color={frase.alerta ? colores.error : colores.primary} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-on-surface">Copia de seguridad</Text>
          <Text className="text-[11px] text-on-surface-variant" testID="respaldo-titulo">
            {frase.titulo} · {frase.detalle}
          </Text>
          {enMini ? (
            <Text className="text-[11px] text-on-surface-variant" testID="respaldo-copia">
              {fraseDeCopia(enMini)}
            </Text>
          ) : null}
        </View>
      </View>

      {!hayPassphrase || creando ? (
        <CrearPassphrase
          onListo={async () => {
            setCreando(false);
            // Passphrase nueva = respaldo nuevo. Sin olvidar las huellas, la
            // corrida veía el almacén «al día» y en la mini quedaba el archivo
            // que solo abre la passphrase vieja, o se subía el pendiente
            // cifrado con ella. Al rearmar, el pendiente viejo se reemplaza.
            await guardarEstadoDeRespaldo({ huellaRespaldada: null, huellaPendiente: null });
            await registrarTareaDeFondo();
            await recargar();
            void respaldarAhora();
          }}
          onCancelar={hayPassphrase ? () => setCreando(false) : undefined}
        />
      ) : (
        <View className="mt-3 flex-row gap-2">
          <Pressable
            testID="btn-respaldar-ahora"
            disabled={respaldando}
            onPress={() => void respaldarAhora()}
            className="min-h-[44px] flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-primary px-4"
          >
            {respaldando ? <ActivityIndicator color={colores['on-primary']} /> : null}
            <Text className="text-sm font-semibold text-on-primary">
              {respaldando ? 'Respaldando…' : 'Respaldar ahora'}
            </Text>
          </Pressable>
          <Pressable
            testID="btn-cambiar-passphrase"
            onPress={() => setCreando(true)}
            className="min-h-[44px] items-center justify-center rounded-lg border border-outline/20 px-4"
          >
            <Text className="text-sm font-semibold text-on-surface">Cambiar passphrase</Text>
          </Pressable>
        </View>
      )}

      {/* Restaurar a mano (F12.2): en un teléfono con historial no se ofrece
          sola; acá se pide cuando se quiere, con el último de la mini. */}
      {enMini?.ultimo ? (
        <Pressable
          testID="btn-restaurar-desde-mini"
          onPress={() => setRestaurando(true)}
          className="mt-2 min-h-[44px] items-center justify-center rounded-lg border border-outline/20 px-4"
        >
          <Text className="text-sm font-semibold text-on-surface">Restaurar desde la mini</Text>
        </Pressable>
      ) : null}
      {restaurando && enMini?.ultimo ? (
        <RestaurarRespaldo
          jwt={credential.jwt}
          respaldo={enMini.ultimo}
          onCerrar={() => setRestaurando(false)}
          onRestaurado={() => void recargar()}
        />
      ) : null}
    </View>
  );
}

/** «Copia a la mini: ayer ✓» — lo que restic dejó en `.copia-a-la-mini.json`, vía el server. */
function fraseDeCopia(enMini: EstadoDeRespaldos): string {
  if (enMini.disco.estado !== 'montado') return 'El disco de la mini no está';
  if (!enMini.copia?.ultimaEn) return 'Sin copia del disco a la mini registrada';
  const cuando = haceCuanto(new Date(enMini.copia.ultimaEn).getTime(), Date.now());
  return `Copia del disco a la mini: ${cuando} ${enMini.copia.ok === false ? '✗' : '✓'}`;
}

/**
 * Crear (o cambiar) la passphrase. Dos campos iguales, ocho o más caracteres,
 * y la advertencia que no puede faltar: si se pierde, el respaldo no se abre
 * nunca más. No hay «recuperar»: es lo que hace que el server no pueda leer.
 */
function CrearPassphrase({ onListo, onCancelar }: { onListo: () => Promise<void>; onCancelar?: () => void }) {
  const colores = useColores();
  const [una, setUna] = useState('');
  const [otra, setOtra] = useState('');
  const [guardando, setGuardando] = useState(false);
  const valida = passphraseValida(una);
  const coinciden = una.trim() === otra.trim();
  const puede = valida && coinciden && !guardando;

  return (
    <View className="mt-3 gap-2">
      <Text className="text-[11px] text-on-surface-variant">
        Elige una passphrase de 8 caracteres o más. Cifra el respaldo en tu teléfono: ni la mini ni
        nadie más puede abrirlo. <Text className="font-semibold text-error">Si la olvidas, el respaldo no se recupera.</Text>
      </Text>
      <TextInput
        testID="passphrase-1"
        value={una}
        onChangeText={setUna}
        secureTextEntry
        autoCapitalize="none"
        placeholder="Passphrase"
        placeholderTextColor={colores['on-surface-variant']}
        className="min-h-[44px] rounded-lg bg-surface-variant px-3 text-sm text-on-surface"
      />
      <TextInput
        testID="passphrase-2"
        value={otra}
        onChangeText={setOtra}
        secureTextEntry
        autoCapitalize="none"
        placeholder="Repítela"
        placeholderTextColor={colores['on-surface-variant']}
        className="min-h-[44px] rounded-lg bg-surface-variant px-3 text-sm text-on-surface"
      />
      {una.length > 0 && !valida ? (
        <Text className="text-[11px] text-error">Ocho caracteres o más.</Text>
      ) : otra.length > 0 && !coinciden ? (
        <Text className="text-[11px] text-error">No coinciden.</Text>
      ) : null}
      <View className="flex-row gap-2">
        <Pressable
          testID="btn-guardar-passphrase"
          disabled={!puede}
          onPress={() => {
            setGuardando(true);
            void guardarPassphrase(una).then(async (ok) => {
              if (ok) await onListo();
              setGuardando(false);
            });
          }}
          className={`min-h-[44px] flex-1 items-center justify-center rounded-lg px-4 ${puede ? 'bg-primary' : 'bg-primary/40'}`}
        >
          <Text className="text-sm font-semibold text-on-primary">Guardar y respaldar</Text>
        </Pressable>
        {onCancelar ? (
          <Pressable onPress={onCancelar} className="min-h-[44px] items-center justify-center rounded-lg border border-outline/20 px-4">
            <Text className="text-sm font-semibold text-on-surface">Cancelar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
