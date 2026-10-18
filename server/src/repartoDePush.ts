/**
 * Un token, un envío (FL11, José 18/10: avisos duplicados en dos formatos y uno
 * por mensaje). El mismo teléfono puede figurar en varios devices con el mismo
 * token de FCM (una reinstalación, un alta repetida). Sin esto recibía el push
 * de datos (que dibuja el aviso agrupado por chat) Y el común (uno por mensaje),
 * y un token repetido en N devices recibía N copias.
 *
 * Gana el nativo: si un token es de un device que dibuja el aviso, el común no
 * se manda a ese token.
 */
export function repartirPorToken<D extends { pushToken?: string }>(
  dispositivos: readonly D[],
  esNativo: (dispositivo: D) => boolean
): { nativos: D[]; comunes: D[] } {
  const conToken = dispositivos.filter((dispositivo) => Boolean(dispositivo.pushToken));
  const tokensNativos = new Set(conToken.filter(esNativo).map((dispositivo) => dispositivo.pushToken));
  const unoPorToken = (lista: D[]) => {
    const vistos = new Set<string>();
    return lista.filter((dispositivo) => {
      const token = dispositivo.pushToken!;
      if (vistos.has(token)) return false;
      vistos.add(token);
      return true;
    });
  };
  return {
    nativos: unoPorToken(conToken.filter(esNativo)),
    comunes: unoPorToken(conToken.filter((dispositivo) => !esNativo(dispositivo) && !tokensNativos.has(dispositivo.pushToken))),
  };
}
