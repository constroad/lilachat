import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, ToastAndroid, View } from 'react-native';
import { ChevronRight, Lock, Monitor, MonitorSmartphone } from 'lucide-react-native';
import { MAXIMO_DE_VINCULADOS } from '@lilachat/shared';
import type { DispositivoVinculado } from '../api/client';
import { FilaDeAjuste } from '../ui/FilaDeAjuste';
import { PantallaEnModal } from '../ui/PantallaEnModal';
import { useColores } from '../ui/tema';
import { EscanerDeVinculacion } from './EscanerDeVinculacion';
import { useDispositivosVinculados } from './useDispositivosVinculados';
import { puedeVincularOtro, textoDeUltimoUso } from './vinculos';

/**
 * «Dispositivos vinculados» (W5, diseño `w5-app-vinculados.png`): usar
 * Lilachat en la computadora escaneando el QR de Lilachat Web, ver qué
 * navegadores tienen tu cuenta y cerrarles la sesión.
 */
export function DispositivosVinculadosAjuste({ jwt }: { jwt: string }) {
  const colores = useColores();
  const [abierto, setAbierto] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  const { estado, recargar, cerrar } = useDispositivosVinculados(jwt, abierto);
  const cantidad = estado.fase === 'listo' ? estado.dispositivos.length : 0;

  // La fila nueva llega con `vinculos.changed`, cuando la web termina de entrar.
  const alVincular = (nombre: string) => {
    setEscaneando(false);
    ToastAndroid.show(`Se vinculó ${nombre}`, ToastAndroid.SHORT);
  };

  const preguntarCierre = (dispositivo: DispositivoVinculado) =>
    Alert.alert(`¿Cerrar la sesión de ${dispositivo.nombre}?`, 'Ese navegador deja de ver tus chats en el acto.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => void cerrar(dispositivo.deviceId) },
    ]);

  return (
    <>
      <FilaDeAjuste
        testID="btn-dispositivos-vinculados"
        icono={MonitorSmartphone}
        titulo="Dispositivos vinculados"
        detalle="Usa Lilachat en tu computadora"
        onPress={() => setAbierto(true)}
      />
      <PantallaEnModal visible={abierto} titulo="Dispositivos vinculados" onCerrar={() => setAbierto(false)} testIDCerrar="btn-cerrar-vinculados">
        <Portada puedeVincular={puedeVincularOtro(cantidad)} onVincular={() => setEscaneando(true)} />
        <ListaDeVinculados estado={estado} onReintentar={() => void recargar()} onTocar={preguntarCierre} />
        <View className="mt-8 flex-row gap-3 border-t border-outline/10 pt-5">
          <Lock size={16} color={colores['on-surface-variant']} />
          <Text className="flex-1 text-[13px] leading-5 text-on-surface-variant">
            Hasta {MAXIMO_DE_VINCULADOS} dispositivos. Tus chats secretos se leen solo en este teléfono.
          </Text>
        </View>
      </PantallaEnModal>
      <EscanerDeVinculacion visible={escaneando} jwt={jwt} onCerrar={() => setEscaneando(false)} onVinculado={alVincular} />
    </>
  );
}

function Portada({ puedeVincular, onVincular }: { puedeVincular: boolean; onVincular: () => void }) {
  const colores = useColores();
  return (
    <View className="items-center pt-2">
      <View className="h-24 w-24 items-center justify-center rounded-full bg-primary/10">
        <MonitorSmartphone size={44} color={colores.primary} />
      </View>
      <Text className="mt-4 text-center text-[15px] leading-6 text-on-surface-variant">Usa Lilachat en tu computadora desde el navegador.</Text>
      <Pressable
        testID="btn-vincular-dispositivo"
        disabled={!puedeVincular}
        onPress={onVincular}
        className={`mt-5 h-12 w-full items-center justify-center rounded-xl bg-primary ${puedeVincular ? '' : 'opacity-40'}`}
      >
        <Text className="text-base font-semibold text-on-primary">Vincular un dispositivo</Text>
      </Pressable>
      {puedeVincular ? null : (
        <Text className="mt-2 text-center text-[13px] text-on-surface-variant">Llegaste al máximo. Cierra la sesión de uno para vincular otro.</Text>
      )}
    </View>
  );
}

function ListaDeVinculados(props: {
  estado: ReturnType<typeof useDispositivosVinculados>['estado'];
  onReintentar: () => void;
  onTocar: (dispositivo: DispositivoVinculado) => void;
}) {
  const { estado } = props;
  if (estado.fase === 'cargando') return <ActivityIndicator className="mt-8" />;
  if (estado.fase === 'error') {
    return (
      <Pressable testID="btn-reintentar-vinculados" onPress={props.onReintentar} className="mt-8 items-center py-3">
        <Text className="text-sm text-on-surface-variant">No se pudo cargar la lista. Toca para reintentar.</Text>
      </Pressable>
    );
  }
  if (estado.dispositivos.length === 0) return null;
  return (
    <View testID="lista-vinculados" className="mt-8">
      <Text className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Estado del dispositivo</Text>
      <Text className="mt-1 text-sm text-on-surface-variant">Toca un dispositivo para cerrar su sesión.</Text>
      <View className="mt-3 border-t border-outline/10">
        {estado.dispositivos.map((dispositivo) => (
          <FilaDeVinculado key={dispositivo.deviceId} dispositivo={dispositivo} onTocar={() => props.onTocar(dispositivo)} />
        ))}
      </View>
    </View>
  );
}

function FilaDeVinculado({ dispositivo, onTocar }: { dispositivo: DispositivoVinculado; onTocar: () => void }) {
  const colores = useColores();
  return (
    <Pressable testID="fila-vinculado" onPress={onTocar} className="min-h-[64px] flex-row items-center gap-4 border-b border-outline/10 py-2">
      <View className="h-11 w-11 items-center justify-center rounded-full bg-primary/10">
        <Monitor size={20} color={colores.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-base text-on-surface">{dispositivo.nombre}</Text>
        <Text className="text-sm text-on-surface-variant">{textoDeUltimoUso(dispositivo.ultimoUso)}</Text>
      </View>
      <ChevronRight size={18} color={colores['on-surface-variant']} />
    </Pressable>
  );
}
