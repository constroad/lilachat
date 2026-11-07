import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WORK_MAP_FAILED } from '@lilachat/shared';
import { signSession } from './sessions.js';
import { buildWorkMapRouter, type PortalFetch } from './workMapRoutes.js';

const token = 'a'.repeat(64);
const serviceId = '6aedcc3a2f5e395dca260f16';
const link = `https://constroad.com/public/test/service-report/${token}`;
const userId = '6adbb02ec9d066b069307eb4';
const auth = () => ({ Authorization: `Bearer ${signSession({ userId, deviceId: 'd-map', email: 'x' })}` });
const line = [{ lat: -12, lng: -77 }, { lat: -12, lng: -76.99 }];
const detail = { workStreets: { streets: [{ _id: 's1', name: 'Av. Los Olivos', geometry: line, lengthM: 1088 }], scopes: [], progress: [], tags: [], stages: [] } };

describe('POST /service-work-map', () => {
  const portal = vi.fn<PortalFetch>();
  const app = express().use(express.json()).use('/service-work-map', buildWorkMapRouter(portal));

  beforeEach(() => {
    portal.mockReset();
  });

  it('needs a session', async () => {
    const answer = await request(app).post('/service-work-map').send({ link, serviceId });
    expect(answer.status).toBe(401);
    expect(portal).not.toHaveBeenCalled();
  });

  it('asks Portal with the token of the link and answers only the map', async () => {
    portal.mockResolvedValue(new Response(JSON.stringify({ detail: { ...detail, contractTotal: 90000 } })));
    const answer = await request(app).post('/service-work-map').set(auth()).send({ link, serviceId });
    expect(answer.status).toBe(200);
    expect(answer.body.map.streets[0].name).toBe('Av. Los Olivos');
    expect(JSON.stringify(answer.body)).not.toContain('90000');
    expect(portal.mock.calls[0]?.[0]).toBe(`https://constroad.com/api/public/client-portal/services/${serviceId}?token=${token}`);
  });

  it('answers no map when the service has no streets', async () => {
    portal.mockResolvedValue(new Response(JSON.stringify({ detail: { workStreets: null } })));
    const answer = await request(app).post('/service-work-map').set(auth()).send({ link, serviceId });
    expect(answer.status).toBe(200);
    expect(answer.body.map).toBeNull();
  });

  it('never asks another address', async () => {
    const answer = await request(app).post('/service-work-map').set(auth()).send({ link: `https://evil.com/public/test/service-report/${token}`, serviceId });
    expect(answer.status).toBe(400);
    expect(portal).not.toHaveBeenCalled();
  });

  it('refuses a body without strings', async () => {
    const answer = await request(app).post('/service-work-map').set(auth()).send({ link: { url: link }, serviceId: 7 });
    expect(answer.status).toBe(400);
  });

  it.each([
    ['a refused link', () => Promise.resolve(new Response('{}', { status: 403 }))],
    ['a cut body', () => Promise.resolve(new Response('{"detail":{"work'))],
    ['no answer', () => Promise.reject(new Error('timeout'))],
  ])('tells the tab to try again on %s, without the token in the log', async (_name, answerOf) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    portal.mockImplementation(answerOf);
    const answer = await request(app).post('/service-work-map').set(auth()).send({ link, serviceId });
    expect(answer.status).toBe(502);
    expect(answer.body.message).toBe(WORK_MAP_FAILED);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(token);
    warn.mockRestore();
  });
});
