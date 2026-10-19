import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { Camera, Check, Pencil, Trash2, X } from 'lucide-react-native';
import { MAX_NOMBRE_DE_PERFIL, formatPhoneDisplay, validarNombreDePerfil } from '@lilachat/shared';
import { guardarNombreDePerfil, quitarFotoDePerfil } from '../api/client';
import type { Credential } from '../auth/credentialStore';
import { elegirFotoRedonda } from '../chat/fotoDeGrupo';
import { aplicarPerfil, subirFotoDePerfil, usePerfilPropio } from './perfilPropio';
import { useColores } from '../ui/tema';
import { Avatar } from '../ui/Avatar';
import { VisorDeFoto } from '../ui/VisorDeFoto';

const AVATAR = 64;

/**
 * Mi perfil, arriba de Ajustes (FL9; auditoría §46.2): la foto y el nombre que
 * ven los que no te tienen agendado, como WhatsApp. Tocar la foto la cambia
 * (cámara o galería, recortada en cuadrado); el lápiz edita el nombre. El error
 * va debajo del campo, no en un toast que el teclado tapa.
 */
export function PerfilAjuste({ credential }: { credential: Credential }) {
  const colores = useColores();
  const perfil = usePerfilPropio(credential);
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<'nombre' | 'foto' | null>(null);
  const [viendoFoto, setViendoFoto] = useState(false);

  const empezarEdicion = () => {
    setNombre(perfil.name ?? '');
    setError(null);
    setEditando(true);
  };

  const guardarNombre = async () => {
    const validado = validarNombreDePerfil(nombre);
    if (!validado.ok) return setError(validado.motivo);
    setOcupado('nombre');
    const r = await guardarNombreDePerfil(validado.nombre, credential.jwt);
    setOcupado(null);
    if (!r.ok) return setError(r.message ?? 'No se pudo guardar. Revisa la señal.');
    await aplicarPerfil(credential, r.data.perfil);
    setEditando(false);
  };

  const cambiarFoto = async () => {
    const eleccion = await elegirFotoRedonda({
      titulo: 'Tu foto',
      mensaje: 'La ven tus contactos en Lilachat.',
      nombrePorDefecto: 'perfil.jpg',
    });
    if (eleccion.tipo === 'sin-permiso') return Alert.alert('Sin permiso', 'Lilachat no puede usar la cámara.');
    if (eleccion.tipo !== 'foto') return;
    setOcupado('foto');
    const r = await subirFotoDePerfil(credential.jwt, eleccion.foto);
    setOcupado(null);
    if (!r.ok) return Alert.alert('No se pudo cambiar la foto', r.motivo);
    await aplicarPerfil(credential, r.perfil);
  };

  const quitarFoto = () =>
    Alert.alert('¿Quitar tu foto?', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setOcupado('foto');
            const r = await quitarFotoDePerfil(credential.jwt);
            setOcupado(null);
            if (!r.ok) return Alert.alert('No se pudo quitar la foto', r.message ?? 'Revisa la señal.');
            await aplicarPerfil(credential, r.data.perfil);
          })();
        },
      },
    ]);

  return (
    <View className="flex-row items-center gap-4 rounded-2xl border border-outline/10 bg-surface p-4" testID="ajuste-perfil">
      <View style={{ width: AVATAR, height: AVATAR }}>
        {/* Tocar la foto la MUESTRA, como WhatsApp (José, 18/10); sin foto, elige una. */}
        <Pressable
          testID="btn-foto-perfil"
          accessibilityLabel={perfil.avatarUrl ? 'Ver tu foto' : 'Ponerte una foto'}
          onPress={() => (perfil.avatarUrl ? setViendoFoto(true) : void cambiarFoto())}
          disabled={ocupado !== null}
        >
          <Avatar testID="foto-perfil" nombre={perfil.name?.trim() ?? ''} foto={perfil.avatarUrl} tamano={AVATAR} />
          {ocupado === 'foto' ? (
            <View className="absolute inset-0 items-center justify-center rounded-full bg-black/40">
              <ActivityIndicator color="white" />
            </View>
          ) : null}
        </Pressable>
        <Pressable
          testID="btn-cambiar-foto-perfil"
          accessibilityLabel="Cambiar tu foto"
          onPress={() => void cambiarFoto()}
          disabled={ocupado !== null}
          hitSlop={8}
          className="absolute -bottom-0.5 -right-0.5 h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-primary"
        >
          <Camera size={12} color={colores['on-primary']} />
        </Pressable>
      </View>
      <VisorDeFoto
        foto={viendoFoto ? perfil.avatarUrl : null}
        titulo="Tu foto"
        onCerrar={() => setViendoFoto(false)}
        acciones={[
          {
            testID: 'visor-cambiar-foto',
            texto: 'Cambiar',
            icono: <Camera size={22} color="white" />,
            onPress: () => {
              setViendoFoto(false);
              void cambiarFoto();
            },
          },
          {
            testID: 'visor-quitar-foto',
            texto: 'Quitar',
            icono: <Trash2 size={22} color="white" />,
            onPress: () => {
              setViendoFoto(false);
              quitarFoto();
            },
          },
        ]}
      />

      <View className="min-w-0 flex-1">
        {editando ? (
          <>
            <View className="flex-row items-center gap-1">
              <TextInput
                testID="input-nombre-perfil"
                value={nombre}
                onChangeText={(texto) => {
                  setNombre(texto);
                  setError(null);
                }}
                autoFocus
                maxLength={MAX_NOMBRE_DE_PERFIL * 2}
                placeholder="Tu nombre"
                placeholderTextColor={colores['on-surface-variant']}
                returnKeyType="done"
                onSubmitEditing={() => void guardarNombre()}
                className="min-h-[44px] min-w-0 flex-1 border-b border-primary text-base text-on-surface"
              />
              <Pressable testID="btn-guardar-nombre" accessibilityLabel="Guardar el nombre" onPress={() => void guardarNombre()} disabled={ocupado !== null} className="h-11 w-11 items-center justify-center">
                {ocupado === 'nombre' ? <ActivityIndicator color={colores.primary} /> : <Check size={20} color={colores.primary} />}
              </Pressable>
              <Pressable testID="btn-cancelar-nombre" accessibilityLabel="Cancelar" onPress={() => setEditando(false)} className="h-11 w-11 items-center justify-center">
                <X size={18} color={colores['on-surface-variant']} />
              </Pressable>
            </View>
            {error ? (
              <Text testID="error-nombre-perfil" className="mt-1 text-[12px] text-error">
                {error}
              </Text>
            ) : (
              <Text className="mt-1 text-[13px] text-on-surface-variant">Lo ven quienes no te tienen agendado.</Text>
            )}
          </>
        ) : (
          <Pressable testID="btn-editar-nombre" onPress={empezarEdicion} className="min-h-[44px] flex-row items-center gap-2">
            <Text testID="nombre-perfil" className="min-w-0 flex-shrink text-[17px] font-semibold text-on-surface" numberOfLines={1}>
              {perfil.name?.trim() || 'Ponte un nombre'}
            </Text>
            <Pencil size={14} color={colores['on-surface-variant']} />
          </Pressable>
        )}
        <Text className="text-sm text-on-surface-variant">{formatPhoneDisplay(credential.phone)}</Text>
      </View>
    </View>
  );
}
