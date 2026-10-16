import { describe, expect, it } from 'vitest';
import { crearColaSerial } from './colaSerial.js';

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('crearColaSerial', () => {
  it('corre las tareas de a una, en el orden en que llegaron', async () => {
    // Arrange
    const enCola = crearColaSerial();
    const registro: string[] = [];
    const tarea = (nombre: string, ms: number) => async () => {
      registro.push(`empieza ${nombre}`);
      await esperar(ms);
      registro.push(`termina ${nombre}`);
    };

    // Act
    await Promise.all([enCola(tarea('lenta', 20)), enCola(tarea('rapida', 1))]);

    // Assert
    expect(registro).toEqual(['empieza lenta', 'termina lenta', 'empieza rapida', 'termina rapida']);
  });

  it('devuelve el resultado de cada tarea', async () => {
    const enCola = crearColaSerial();
    await expect(enCola(async () => 42)).resolves.toBe(42);
  });

  it('una tarea que falla rechaza la suya y NO traba a las siguientes', async () => {
    // Arrange
    const enCola = crearColaSerial();

    // Act
    const fallida = enCola(async () => {
      throw new Error('disco lleno');
    });
    const siguiente = enCola(async () => 'sigue');

    // Assert
    await expect(fallida).rejects.toThrow('disco lleno');
    await expect(siguiente).resolves.toBe('sigue');
  });

  it('colas distintas no se esperan entre sí', async () => {
    // Arrange
    const a = crearColaSerial();
    const b = crearColaSerial();
    const registro: string[] = [];

    // Act
    await Promise.all([
      a(async () => {
        await esperar(20);
        registro.push('a');
      }),
      b(async () => {
        registro.push('b');
      }),
    ]);

    // Assert
    expect(registro).toEqual(['b', 'a']);
  });
});
