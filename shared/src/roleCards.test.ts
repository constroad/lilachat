import { describe, expect, it } from 'vitest';
import { formFields, type FormSchema } from './appForms';
import { compactSectionSchema } from './compactReportForms';
import { openRoleOf, roleCardsNote, roleCardsOf, ROLE_EMPTY_LINE } from './roleCards';

/** CTL-IMP's «firmas» as Portal sends it (imprimacionFields.ts): every field optional. */
const roleFields = (prefix: string, role: string) => ({
  [`${prefix}Nombre`]: { type: 'string', title: `${role} · nombre`, maxLength: 200 },
  [`${prefix}Cargo`]: { type: 'string', title: `${role} · cargo`, maxLength: 200 },
  [`${prefix}Empresa`]: { type: 'string', title: `${role} · empresa`, maxLength: 200 },
  [`${prefix}Cip`]: { type: 'string', title: `${role} · CIP`, maxLength: 200 },
});
const signersSchema: FormSchema = { type: 'object', properties: { ...roleFields('responsable', 'Responsable'), ...roleFields('supervisadoPor', 'Supervisado por'), ...roleFields('cliente', 'Cliente') } };

const signerFields = () => formFields({ id: 'f', title: 'Responsables y firmas', schema: compactSectionSchema('CTL-IMP', 'firmas', signersSchema) });

describe('roleCardsOf (design imp-04, José 20/11)', () => {
  it('one card per role in Portal\'s order, its fields named without the role', () => {
    // Act
    const cards = roleCardsOf(signerFields(), {});
    // Assert
    expect(cards.map((card) => card.label)).toEqual(['Responsable', 'Supervisado por', 'Cliente']);
    expect(cards[0]!.fields.map((field) => [field.name, field.label])).toEqual([['responsableNombre', 'Nombre'], ['responsableCargo', 'Cargo'], ['responsableEmpresa', 'Empresa'], ['responsableCip', 'CIP']]);
  });

  it('the folded row says the name and position, or that there is nothing', () => {
    const cards = roleCardsOf(signerFields(), { supervisadoPorNombre: '  Ana   Torres ', supervisadoPorCargo: 'Supervisora', clienteEmpresa: 'MML' });
    expect(cards[0]).toMatchObject({ line: ROLE_EMPTY_LINE, filled: false, initials: 'R' });
    expect(cards[1]).toMatchObject({ line: 'Ana Torres · Supervisora', filled: true, initials: 'AT' });
    expect(cards[2]).toMatchObject({ line: ROLE_EMPTY_LINE, filled: true, initials: 'C' });
  });

  it('initials come from letters only: «Ing. Luis Mendoza» → «IL», «123» falls back to the role', () => {
    const cards = roleCardsOf(signerFields(), { responsableNombre: '123', clienteNombre: 'ing. luis mendoza' });
    expect(cards[0]!.initials).toBe('R');
    expect(cards[2]!.initials).toBe('IL');
  });

  it('plain fields are no card', () => {
    const plain = formFields({ id: 'f', title: 'x', schema: { type: 'object', properties: { nota: { type: 'string', title: 'Nota' } } } });
    expect(roleCardsOf(plain, {})).toEqual([]);
  });
});

describe('openRoleOf', () => {
  const cards = roleCardsOf(signerFields(), {});

  it('the first card opens until the person picks another', () => {
    expect(openRoleOf(cards, {}, undefined)).toBe('Responsable');
    expect(openRoleOf(cards, {}, 'Cliente')).toBe('Cliente');
  });

  it('the person can fold them all', () => {
    expect(openRoleOf(cards, {}, null)).toBeNull();
  });

  it('a refused field opens its card over the person\'s pick', () => {
    expect(openRoleOf(cards, { clienteCip: 'Muy largo' }, 'Responsable')).toBe('Cliente');
    expect(openRoleOf(cards, { clienteCip: 'Muy largo' }, null)).toBe('Cliente');
  });

  it('a pick that is no card falls back to the first', () => {
    expect(openRoleOf(cards, {}, 'Otro')).toBe('Responsable');
    expect(openRoleOf([], {}, undefined)).toBeNull();
  });
});

describe('roleCardsNote', () => {
  it('one «opcional» for the whole form when nothing is required', () => {
    expect(roleCardsNote(roleCardsOf(signerFields(), {}))).toBe('Todo es opcional · toca una tarjeta para editar');
  });

  it('a required field: only the hint', () => {
    const fields = formFields({ id: 'f', title: 'x', schema: { ...compactSectionSchema('CTL-IMP', 'firmas', signersSchema), required: ['responsableNombre'] } });
    expect(roleCardsNote(roleCardsOf(fields, {}))).toBe('Toca una tarjeta para editar');
  });
});
