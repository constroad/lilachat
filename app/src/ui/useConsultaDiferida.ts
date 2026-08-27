import { useEffect, useState } from 'react';

/**
 * Lo que se escribe y lo que se busca, separados.
 *
 * Escribir tiene que responder SIEMPRE en el cuadro siguiente: la letra aparece
 * al instante y la búsqueda —que recorre cientos de contactos— espera a que la
 * persona deje de tipear. Sin esto, cada tecla pagaba el filtro completo y el
 * teclado se sentía trabado.
 *
 * 150 ms: por debajo no ahorra nada en una ráfaga de tipeo normal, y por encima
 * se nota como demora al terminar de escribir.
 */
const ESPERA_MS = 150;

export function useConsultaDiferida(texto: string): string {
  const [diferida, setDiferida] = useState(texto);

  useEffect(() => {
    const id = setTimeout(() => setDiferida(texto), ESPERA_MS);
    return () => clearTimeout(id);
  }, [texto]);

  return diferida;
}
