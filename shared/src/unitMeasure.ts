import type { FormSchemaProperty, FormValues } from './appForms.js';
import type { EphemeralAnswer } from './botCommands.js';
import type { FieldDocument, RepeatItem, RepeatSection, SectionPath } from './fieldDocument.js';

/**
 * The measure a unit's photo carries (José 20/11, design pv2-02): the temperature and the
 * gauge depth are typed on the photo's preview, right after taking it, not in a data section.
 * The photo's tool takes no measure, so it rides as the unit's data save (`guardar_seccion_de_informe`,
 * section `unidad`), with the values the unit already had: Portal blanks what a save leaves out.
 * PURE: the APK and the web draw from here.
 */
export type UnitMeasure = { field: string; unit: string; title: string };
export type MeasureSplit = { photoValues: FormValues; data: { path: SectionPath; values: FormValues } | null };

/** The form's own field: never sent to Portal under this name. */
export const MEASURE_FIELD = 'medidaDeLaFoto';
const UNIT_REPORT_TYPE = 'CTL-PIS';
const ARRIVAL_FIELD = 'horaLlegada';
const PHOTO_INPUT = 'photo';

export const UNIT_MEASURES: Record<string, UnitMeasure> = {
  temperatura: { field: 'tempLlegada', unit: '°C', title: 'Temperatura (°C)' },
  escantillon: { field: 'escantillonCm', unit: 'cm', title: 'Escantillón (cm)' },
};

type Found = { measure: UnitMeasure; property: FormSchemaProperty; item: RepeatItem; dataPath: SectionPath; current: unknown };

function unitAt(document: FieldDocument, path: SectionPath): { section: RepeatSection; item: RepeatItem } | null {
  const section = document.sections.find((one) => one.id === path.sectionId);
  if (document.type !== UNIT_REPORT_TYPE || section?.kind !== 'repeat' || !path.itemId) return null;
  const item = section.items.find((one) => one.id === path.itemId);
  return item ? { section, item } : null;
}

/** The measure of the photo at `path`, when its unit's data form has that field. */
export function photoMeasureOf(document: FieldDocument, path: SectionPath): Found | null {
  const unit = unitAt(document, path);
  const entry = unit?.section.template.find((one) => one.id === path.key);
  const measure = UNIT_MEASURES[entry?.photoKind ?? ''];
  const data = unit?.section.template.find((one) => !one.tool);
  const property = data ? document.forms[data.form]?.properties?.[measure?.field ?? ''] : undefined;
  if (!unit || !measure || !data || !property) return null;
  const current = unit.item.sections.find((one) => one.id === data.id)?.values[measure.field];
  return { measure, property, item: unit.item, dataPath: { sectionId: path.sectionId, itemId: unit.item.id, key: data.id }, current };
}

const isBlank = (value: unknown): boolean => value === undefined || value === null || String(value).trim() === '';

/** The photo's form with the measure right under the photo, numeric, with what the unit already has. */
export function withPhotoMeasure(answer: EphemeralAnswer | null, document: FieldDocument, path: SectionPath): EphemeralAnswer | null {
  const form = answer?.response?.form;
  const found = photoMeasureOf(document, path);
  if (!answer || !form || !found) return answer;
  const { measure, property, current } = found;
  const field: FormSchemaProperty = {
    type: 'number', title: measure.title, 'x-unit': measure.unit,
    ...(property.minimum !== undefined ? { minimum: property.minimum } : {}),
    ...(property.maximum !== undefined ? { maximum: property.maximum } : {}),
    ...(isBlank(current) ? {} : { default: Number(String(current).replace(',', '.')) }),
  };
  const entries = Object.entries(form.schema.properties ?? {});
  const after = entries.findIndex(([, one]) => one['x-input'] === PHOTO_INPUT) + 1;
  const properties = Object.fromEntries([...entries.slice(0, after), [MEASURE_FIELD, field] as const, ...entries.slice(after)]);
  return { ...answer, response: { ...answer.response!, form: { ...form, schema: { ...form.schema, properties } } } };
}

const numberOf = (value: unknown): number | null => {
  if (isBlank(value)) return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * What «Guardar foto» queues: the photo without the measure, and the unit's data with it. The
 * arrival hour fills in when the data had none (`arrivalHourAt`: the ingreso photo's, or now).
 */
export function splitPhotoMeasure(document: FieldDocument, path: SectionPath, values: FormValues, arrivalHourAt: (dataPath: SectionPath) => string | undefined): MeasureSplit {
  const { [MEASURE_FIELD]: typed, ...photoValues } = values;
  const found = photoMeasureOf(document, path);
  const value = numberOf(typed);
  if (!found || value === null) return { photoValues, data: null };
  const saved = found.item.sections.find((one) => one.id === found.dataPath.key)?.values ?? {};
  const arrivalHour = isBlank(saved[ARRIVAL_FIELD]) ? arrivalHourAt(found.dataPath) : undefined;
  const arrival = arrivalHour ? { [ARRIVAL_FIELD]: arrivalHour } : {};
  return { photoValues, data: { path: found.dataPath, values: { ...saved, ...arrival, [found.measure.field]: value } } };
}
