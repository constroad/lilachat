import { Fragment } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { LEGAL_FOOTER_LINKS, legalPageUrl, type LegalPageId } from '@lilachat/shared';

const openLegalPage = (id: LegalPageId) => {
  Linking.openURL(legalPageUrl(id)).catch(() => undefined);
};

/** «Privacidad · Seguridad infantil» under the sign-in (Google Play, spec PLAY-STORE): the public pages, in the browser. */
export function LegalLinks() {
  return (
    <View testID="pie-legal" className="flex-row items-center justify-center gap-2">
      {LEGAL_FOOTER_LINKS.map((link, index) => (
        <Fragment key={link.id}>
          {index > 0 ? <Text className="text-xs text-on-surface-variant">·</Text> : null}
          <Pressable testID={`enlace-legal-${link.id}`} accessibilityRole="link" onPress={() => openLegalPage(link.id)} className="min-h-[44px] justify-center px-1">
            <Text className="text-xs text-on-surface-variant">{link.label}</Text>
          </Pressable>
        </Fragment>
      ))}
    </View>
  );
}
