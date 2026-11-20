import { Alert } from 'react-native';
import { ACCOUNT_DELETION_TEXTS } from '@lilachat/shared';
import type { SignedIn } from './machine';

/** A sign-in inside the 30 days cancelled «Borrar mi cuenta» (`authRoutes.ts`): the person hears it once. */
export function tellIfDeletionCancelled(signedIn: Pick<SignedIn, 'accountDeletionCancelled'>): void {
  if (signedIn.accountDeletionCancelled) Alert.alert(ACCOUNT_DELETION_TEXTS.cancelledTitle, ACCOUNT_DELETION_TEXTS.cancelledBody);
}
