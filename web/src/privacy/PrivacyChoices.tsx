import { BlockedContactsChoice } from './BlockedContactsChoice';
import { ReadReceiptsChoice } from './ReadReceiptsChoice';
import { ScreenLockChoice } from './ScreenLockChoice';

/** The privacy rows of the settings panel: the screen lock and read receipts (R31/10) and the blocked contacts (pending 9). */
export function PrivacyChoices(props: { jwt: string; userId: string; onNotice: (text: string) => void }) {
  return (
    <>
      <ScreenLockChoice userId={props.userId} />
      <ReadReceiptsChoice jwt={props.jwt} onNotice={props.onNotice} />
      <BlockedContactsChoice jwt={props.jwt} onNotice={props.onNotice} />
    </>
  );
}
