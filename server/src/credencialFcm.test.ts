import { describe, expect, it } from 'vitest';
import { leerCredencialFcm, urlDeEnvio } from './credencialFcm.js';

const cuenta = {
  type: 'service_account',
  project_id: 'constroad-c1825',
  client_email: 'firebase-adminsdk@constroad-c1825.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----\n',
};
const enBase64 = Buffer.from(JSON.stringify(cuenta)).toString('base64');

describe('leerCredencialFcm', () => {
  it('lee la cuenta de servicio en base64', () => {
    const { credencial } = leerCredencialFcm(enBase64);

    expect(credencial).toMatchObject({
      projectId: 'constroad-c1825',
      clientEmail: cuenta.client_email,
    });
  });

  /** Pegar el JSON tal cual es el error más probable al configurarlo a mano. */
  it('también acepta el JSON pegado sin codificar', () => {
    expect(leerCredencialFcm(JSON.stringify(cuenta)).credencial?.projectId).toBe(
      'constroad-c1825'
    );
  });

  it('sin variable: no hay credencial y tampoco problema', () => {
    expect(leerCredencialFcm(undefined)).toEqual({ credencial: null });
    expect(leerCredencialFcm('   ')).toEqual({ credencial: null });
  });

  /**
   * **«No está» y «está rota» NO son lo mismo.** Tratar una credencial mal
   * pegada como ausente deja a alguien creyendo que solo le falta ponerla,
   * cuando en realidad ya la puso y está mal.
   */
  it('una credencial rota se distingue de una ausente', () => {
    expect(leerCredencialFcm('esto-no-es-json').problema).toBeTruthy();
    expect(leerCredencialFcm(Buffer.from('{"a":1}').toString('base64')).problema).toContain(
      'project_id'
    );
  });

  it('dice exactamente qué campo falta', () => {
    const sinClave = { ...cuenta, private_key: '' };
    const { problema } = leerCredencialFcm(
      Buffer.from(JSON.stringify(sinClave)).toString('base64')
    );

    expect(problema).toContain('private_key');
  });

  /**
   * **La trampa clásica.** Al pasar por un `.env` o por un panel web, los saltos
   * de línea de la clave PEM quedan como `\n` de dos caracteres. La firma falla
   * después con un error de OpenSSL que no menciona el formato en ningún lado.
   */
  it('convierte los \\n literales en saltos reales', () => {
    const escapada = { ...cuenta, private_key: '-----BEGIN-----\\nMIIE\\n-----END-----' };
    const { credencial } = leerCredencialFcm(
      Buffer.from(JSON.stringify(escapada)).toString('base64')
    );

    expect(credencial?.privateKey).toContain('\n');
    expect(credencial?.privateKey).not.toContain('\\n');
  });
});

describe('urlDeEnvio', () => {
  /**
   * HTTP v1, no la API legacy: `fcm.googleapis.com/fcm/send` lo apagó Google en
   * junio de 2024. Con el endpoint viejo el push no sale y nadie se entera.
   */
  it('apunta a HTTP v1 con el proyecto', () => {
    expect(urlDeEnvio('constroad-c1825')).toBe(
      'https://fcm.googleapis.com/v1/projects/constroad-c1825/messages:send'
    );
  });
});
