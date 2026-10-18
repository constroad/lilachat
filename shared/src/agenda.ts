/**
 * De contactos elegidos a la conversación donde vive un evento o una encuesta.
 *
 * El server exige un `chatId` y saca de ahí a los invitados. La pantalla, en
 * cambio, pregunta por CONTACTOS —pedir «elegí una conversación» para crear un
 * cumpleaños es hacerle pensar al usuario en la estructura de datos—. Esta
 * función es el puente, y es la MISMA para la app y para la web.
 */
export type TargetChatPlan =
  | { kind: 'existing'; chatId: string }
  | { kind: 'create'; chat: { kind: 'direct' | 'group'; memberIds: string[]; name?: string } }
  | { kind: 'invalid'; message: string };

export function planTargetChat(params: {
  /** Cuando se crea desde adentro de un chat, ese chat manda y no se pregunta nada. */
  fixedChatId?: string | null;
  inviteeIds: string[];
  /** El título del evento o la pregunta de la encuesta: es el nombre que llevará el grupo. */
  groupName: string;
  /** Quién crea, y sus grupos: con la MISMA gente se reusa el grupo (FL10). */
  yo?: string;
  grupos?: readonly { id: string; memberIds: readonly string[] }[];
}): TargetChatPlan {
  const fijo = (params.fixedChatId ?? '').trim();
  if (fijo) return { kind: 'existing', chatId: fijo };

  const memberIds = [...new Set(params.inviteeIds.map((id) => id.trim()).filter(Boolean))];
  if (memberIds.length === 0) return { kind: 'invalid', message: 'Elige a quién invitar.' };

  // Con uno solo es el 1:1 que ya existe (el server no lo duplica). Con varios
  // es un grupo nuevo, y el nombre lo hereda de lo que se está creando.
  if (memberIds.length === 1) return { kind: 'create', chat: { kind: 'direct', memberIds } };

  const existente = params.yo ? grupoConLaMismaGente([params.yo, ...memberIds], params.grupos ?? []) : undefined;
  if (existente) return { kind: 'existing', chatId: existente };

  const name = params.groupName.trim();
  if (!name) return { kind: 'invalid', message: 'Ponle un nombre.' };

  return { kind: 'create', chat: { kind: 'group', memberIds, name } };
}

/** El grupo cuyos miembros son EXACTAMENTE esos (sin importar el orden). */
function grupoConLaMismaGente(gente: readonly string[], grupos: readonly { id: string; memberIds: readonly string[] }[]): string | undefined {
  const buscada = new Set(gente);
  return grupos.find((grupo) => {
    const miembros = new Set(grupo.memberIds);
    return miembros.size === buscada.size && [...buscada].every((id) => miembros.has(id));
  })?.id;
}
