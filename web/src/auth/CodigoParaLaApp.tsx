/**
 * Alguien escaneó el QR de vincular con la CÁMARA del teléfono en vez de con
 * la app (W5): el QR es una URL y esto es lo que abre. No vincula nada; dice
 * dónde se escanea.
 */
export function CodigoParaLaApp() {
  return (
    <main className="grid min-h-full place-items-center px-4 py-8">
      <div data-testid="codigo-para-la-app" className="w-full max-w-sm text-center">
        <img src="/icons/icon-192.png" alt="" className="mx-auto h-14 w-14 rounded-2xl" />
        <h1 className="mt-6 text-xl font-bold tracking-tight">Este código se escanea desde la app</h1>
        <p className="mt-3 text-[15px] leading-6 text-on-surface-variant">
          Abre Lilachat en tu teléfono, toca <b>Ajustes</b> → <b>Dispositivos vinculados</b> → <b>Vincular un dispositivo</b> y apunta la cámara al código de tu computadora.
        </p>
        <a href="/" className="mt-8 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-on-primary">
          Ir a Lilachat
        </a>
      </div>
    </main>
  );
}
