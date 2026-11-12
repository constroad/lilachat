import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Types } from 'mongoose';
import { signSession } from './sessions.js';
import { buildFieldConditionsRouter, createWeatherLookup } from './fieldConditions.js';

/** José 12/11: the street and the weather where the engineer stands fill «Información de control». */
const jwt = `Bearer ${signSession({ userId: String(new Types.ObjectId()), deviceId: 'd-qa', email: 'qa@qa.local' })}`;
const appWith = (deps: Parameters<typeof buildFieldConditionsRouter>[0]) => express().use('/api/field-conditions', buildFieldConditionsRouter(deps));
const point = { lat: -12.0464, lng: -77.0428, precision: 0 };
const skyReply = (code: number, temperature: number) => new Response(JSON.stringify({ current: { weather_code: code, temperature_2m: temperature } }), { status: 200 });

describe('GET /api/field-conditions', () => {
  it('answers the street and the weather of the reading, and asks for a session', async () => {
    // Arrange
    const app = appWith({ street: async () => 'Av. Los Incas, Ate, Lima', weather: async () => 'Nublado · 18 °C' });
    // Act
    const answered = await request(app).get('/api/field-conditions?lat=-12.05&lng=-76.94').set('Authorization', jwt);
    const anonymous = await request(app).get('/api/field-conditions?lat=-12.05&lng=-76.94');
    // Assert
    expect(answered.status).toBe(200);
    expect(answered.body).toEqual({ street: 'Av. Los Incas, Ate, Lima', weather: 'Nublado · 18 °C' });
    expect(anonymous.status).toBe(401);
  });

  it('a reading out of the map is refused, and a provider that fails comes back null', async () => {
    // Arrange
    const app = appWith({ street: async () => null, weather: async () => 'Despejado · 25 °C' });
    // Act
    const bad = await request(app).get('/api/field-conditions?lat=200&lng=x').set('Authorization', jwt);
    const half = await request(app).get('/api/field-conditions?lat=-12.05&lng=-76.94').set('Authorization', jwt);
    // Assert
    expect(bad.status).toBe(400);
    expect(half.body).toEqual({ street: null, weather: 'Despejado · 25 °C' });
  });
});

describe('createWeatherLookup', () => {
  it('says the sky in words, remembers a block for a while and does not remember a failure', async () => {
    // Arrange
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(skyReply(3, 18.4));
    let clock = 0;
    const lookup = createWeatherLookup({ fetcher, now: () => clock });
    // Act
    const failed = await lookup(point);
    const first = await lookup(point);
    const again = await lookup(point);
    clock = 16 * 60_000;
    await lookup(point);
    // Assert
    expect(failed).toBeNull();
    expect(first).toBe('Nublado · 18 °C');
    expect(again).toBe('Nublado · 18 °C');
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(String(fetcher.mock.calls[1]![0])).toContain('current=weather_code%2Ctemperature_2m');
  });
});
