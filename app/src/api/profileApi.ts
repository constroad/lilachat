import type { Birthday, MyProfile } from '@lilachat/shared';
import { BASE_URL } from './client';
import { jsonCall } from './jsonCall';

/** The profile Lilachat requires (backlog 17): read it, save name and birthday, and prove the email with a code. */
const url = (path: string) => `${BASE_URL}/api/me${path}`;
const send = (method: string, body: Record<string, unknown>) => ({ method, body: JSON.stringify(body) });

export const getProfile = (jwt: string) => jsonCall<{ profile: MyProfile }>(url('/profile'), jwt);
export const saveProfile = (jwt: string, change: { name?: string; birthday?: Birthday; birthdayVisible?: boolean }) => jsonCall<{ profile: MyProfile }>(url('/profile'), jwt, send('PUT', change));
export const requestEmailCode = (jwt: string, email: string) => jsonCall<{ sent: boolean }>(url('/email/code'), jwt, send('POST', { email }));
export const verifyEmailCode = (jwt: string, email: string, code: string) => jsonCall<{ profile: MyProfile }>(url('/email/verify'), jwt, send('POST', { email, code }));
