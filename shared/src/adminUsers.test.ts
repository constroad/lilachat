import { describe, expect, it } from 'vitest';
import { adminDevicesLabel, adminJoinedLabel, adminLastSeenLabel, adminUsersQuery, adminUsersRange } from './adminUsers.js';

describe('users panel query', () => {
  it('a page from 1 and a trimmed search', () => {
    expect(adminUsersQuery({ q: '  Ana ', page: '3' })).toEqual({ q: 'Ana', page: 3 });
  });

  it('a wrong page or search falls back instead of failing', () => {
    expect(adminUsersQuery({ q: ['x'], page: '-2' })).toEqual({ q: '', page: 1 });
    expect(adminUsersQuery({ page: '1.5' })).toEqual({ q: '', page: 1 });
    expect(adminUsersQuery({ q: 'x'.repeat(200) }).q).toHaveLength(60);
  });
});

describe('users panel labels', () => {
  it('the footer range, including the last short page and none', () => {
    expect(adminUsersRange({ page: 1, pageSize: 50, total: 148 })).toBe('Mostrando 1–50 de 148');
    expect(adminUsersRange({ page: 3, pageSize: 50, total: 148 })).toBe('Mostrando 101–148 de 148');
    expect(adminUsersRange({ page: 1, pageSize: 50, total: 0 })).toBe('Sin resultados');
  });

  it('the devices, by platform', () => {
    expect(adminDevicesLabel({ android: 2, web: 1 })).toBe('2\u00a0Android · 1\u00a0web');
    expect(adminDevicesLabel({ android: 0, web: 1 })).toBe('1\u00a0web');
    expect(adminDevicesLabel({ android: 0, web: 0 })).toBe('Sin dispositivos');
  });
});

describe('users panel dates', () => {
  const now = new Date(2026, 9, 22, 10, 0);

  it('joined, with the year', () => {
    expect(adminJoinedLabel(new Date(2026, 9, 21, 15, 0).toISOString())).toMatch(/^21 oct\.? 2026$/);
    expect(adminJoinedLabel('nope')).toBe('');
  });

  it('last seen: today and yesterday with the clock, older by day, never', () => {
    expect(adminLastSeenLabel(new Date(2026, 9, 22, 7, 31).toISOString(), now)).toMatch(/^hoy\u00a07:31/);
    expect(adminLastSeenLabel(new Date(2026, 9, 21, 21, 5).toISOString(), now)).toMatch(/^ayer\u00a09:05/);
    expect(adminLastSeenLabel(new Date(2026, 9, 12, 8, 0).toISOString(), now)).toMatch(/^12 oct/);
    expect(adminLastSeenLabel(null, now)).toBe('Nunca');
    // José 14/11 (audit adm-01): «a. m.» never splits across two lines in a narrow column.
    expect(adminLastSeenLabel(new Date(2026, 9, 22, 7, 31).toISOString(), now)).not.toMatch(/ /);
  });
});
