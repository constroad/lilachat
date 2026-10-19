/**
 * Copiar al portapapeles (W2). Primero la API moderna; si el navegador la
 * niega (política del navegador, permisos), el respaldo clásico con un campo
 * oculto y `execCommand('copy')`, que sigue andando en esos casos.
 */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return copiarConRespaldo(texto);
  }
}

function copiarConRespaldo(texto: string): boolean {
  const campo = document.createElement('textarea');
  campo.value = texto;
  campo.setAttribute('readonly', '');
  campo.style.position = 'fixed';
  campo.style.opacity = '0';
  document.body.appendChild(campo);
  campo.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    campo.remove();
  }
}
