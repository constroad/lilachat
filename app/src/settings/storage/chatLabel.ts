import { nombreDeContacto, type StorageChatLabel } from '@lilachat/shared';
import type { agendaPorTelefono } from '../../contacts/agendaEnMemoria';

/** A chat's name in «Almacenamiento»: the group's, or the other person as I saved them, like «Medios». */
export const chatLabelName = (chat: StorageChatLabel | undefined, agenda: ReturnType<typeof agendaPorTelefono>): string =>
  chat?.name ?? (nombreDeContacto({ telefono: chat?.phone, agenda }) || 'Conversación');
