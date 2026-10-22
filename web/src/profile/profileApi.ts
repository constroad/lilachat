import type { Birthday, MyProfile } from '@lilachat/shared';
import { api } from '../api';

/** The profile Lilachat requires (backlog 17), the same `/api/me` the phone uses. */
export const getProfile = (jwt: string) => api<{ profile: MyProfile }>('/me/profile', { jwt });
export const saveProfile = (jwt: string, change: { name?: string; birthday?: Birthday; birthdayVisible?: boolean }) => api<{ profile: MyProfile }>('/me/profile', { jwt, method: 'PUT', body: change });
export const requestEmailCode = (jwt: string, email: string) => api<{ sent: boolean }>('/me/email/code', { jwt, body: { email } });
export const verifyEmailCode = (jwt: string, email: string, code: string) => api<{ profile: MyProfile }>('/me/email/verify', { jwt, body: { email, code } });
