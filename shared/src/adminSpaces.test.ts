import { describe, expect, it } from 'vitest';
import {
  ADMIN_NO_SPACE,
  adminAlsoInLabel,
  adminNoSpaceLine,
  adminPanelQuery,
  adminPanelSearch,
  adminSpaceLine,
  adminSpacesRange,
  compareAdminRole,
} from './adminSpaces.js';

const SPACE_ID = '65a1b2c3d4e5f60718293a4b';

/** José, 14/11: the superadmin's panel groups people by the space they belong to. */
describe('adminPanelQuery', () => {
  it('opens by space, on page 1, with no search, when the address says nothing', () => {
    // Arrange / Act
    const query = adminPanelQuery({});
    // Assert
    expect(query).toEqual({ view: 'spaces', space: null, q: '', page: 1 });
  });

  it('reads the flat list, a space, «sin espacio», the search and the page', () => {
    expect(adminPanelQuery({ vista: 'personas', q: ' ana ', page: '3' })).toEqual({ view: 'people', space: null, q: 'ana', page: 3 });
    expect(adminPanelQuery({ espacio: SPACE_ID })).toEqual({ view: 'spaces', space: SPACE_ID, q: '', page: 1 });
    expect(adminPanelQuery({ espacio: 'sin' })).toMatchObject({ space: ADMIN_NO_SPACE });
  });

  it('a space that is not an id, or a space in the flat list, falls back to none', () => {
    expect(adminPanelQuery({ espacio: '{"$ne":1}' }).space).toBeNull();
    expect(adminPanelQuery({ espacio: ['a', 'b'] }).space).toBeNull();
    expect(adminPanelQuery({ vista: 'personas', espacio: SPACE_ID }).space).toBeNull();
    expect(adminPanelQuery({ vista: 'otra' }).view).toBe('spaces');
  });
});

describe('adminPanelSearch', () => {
  it('writes only what differs from the default, so the plain panel is /admin', () => {
    expect(adminPanelSearch({ view: 'spaces', space: null, q: '', page: 1 })).toBe('');
    expect(adminPanelSearch({ view: 'people', space: null, q: 'ana', page: 2 })).toBe('?vista=personas&q=ana&page=2');
    expect(adminPanelSearch({ view: 'spaces', space: ADMIN_NO_SPACE, q: '', page: 1 })).toBe('?espacio=sin');
  });

  it('the reports queue (José 19/11) is `?vista=denuncias` and round-trips', () => {
    // Arrange
    const query = { view: 'reports' as const, space: null, q: '', page: 2 };
    // Act
    const search = adminPanelSearch(query);
    // Assert
    expect(search).toBe('?vista=denuncias&page=2');
    expect(adminPanelQuery(Object.fromEntries(new URLSearchParams(search)))).toEqual(query);
  });

  it('round-trips through adminPanelQuery', () => {
    const query = { view: 'spaces' as const, space: SPACE_ID, q: 'José Pérez', page: 4 };
    const params = Object.fromEntries(new URLSearchParams(adminPanelSearch(query)));
    expect(adminPanelQuery(params)).toEqual(query);
  });
});

describe('labels', () => {
  it('«23 miembros · 9 activos hoy», in singular when it is one', () => {
    expect(adminSpaceLine({ members: 23, activeToday: 9 })).toBe('23 miembros · 9 activos hoy');
    expect(adminSpaceLine({ members: 1, activeToday: 1 })).toBe('1 miembro · 1 activo hoy');
    expect(adminSpaceLine({ members: 0, activeToday: 0 })).toBe('0 miembros · 0 activos hoy');
  });

  it('«Sin espacio» says how many are in no space yet', () => {
    expect(adminNoSpaceLine(28)).toBe('28 personas que todavía no están en ningún espacio');
    expect(adminNoSpaceLine(1)).toBe('1 persona que todavía no está en ningún espacio');
  });

  it('«También en» names up to two spaces and counts the rest; nothing when there are none', () => {
    expect(adminAlsoInLabel([])).toBeNull();
    expect(adminAlsoInLabel([{ id: 'a', name: 'ConstRoad' }])).toBe('También en ConstRoad');
    expect(adminAlsoInLabel([{ id: 'a', name: 'ConstRoad' }, { id: 'b', name: 'Test' }])).toBe('También en ConstRoad y Test');
    expect(adminAlsoInLabel(['A', 'B', 'C', 'D'].map((name) => ({ id: name, name })))).toBe('También en A, B y 2 más');
  });

  it('the spaces footer: «Mostrando 4 espacios · 96 personas»; none, «Sin resultados»', () => {
    expect(adminSpacesRange({ spaces: 4, people: 96 })).toBe('Mostrando 4 espacios · 96 personas');
    expect(adminSpacesRange({ spaces: 1, people: 1 })).toBe('Mostrando 1 espacio · 1 persona');
    expect(adminSpacesRange({ spaces: 0, people: 0 })).toBe('Sin resultados');
  });
});

describe('compareAdminRole', () => {
  it('owner, admin, member, guest; no role (no space) goes last', () => {
    const sorted = (['guest', null, 'member', 'owner', 'admin'] as const).slice().sort(compareAdminRole);
    expect(sorted).toEqual(['owner', 'admin', 'member', 'guest', null]);
  });
});
