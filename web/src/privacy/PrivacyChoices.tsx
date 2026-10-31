import { BlockedContactsChoice } from './BlockedContactsChoice';
import { ReadReceiptsChoice } from './ReadReceiptsChoice';
import { NoticePreviewChoice } from './NoticePreviewChoice';
import { ScreenLockChoice } from './ScreenLockChoice';

/** The privacy rows of the settings panel: the screen lock, read receipts and the notices' preview (R31/10) and the blocked contacts (pending 9). */
export function PrivacyChoices(props: { jwt: string; userId: string; onNotice: (text: string) => void }) {
  return (
    <>
      <ScreenLockChoice userId={props.userId} />
      <ReadReceiptsChoice jwt={props.jwt} onNotice={props.onNotice} />
      <NoticePreviewChoice jwt={props.jwt} onNotice={props.onNotice} />
      <BlockedContactsChoice jwt={props.jwt} onNotice={props.onNotice} />
    </>
  );
}
