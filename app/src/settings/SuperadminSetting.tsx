import { useState } from 'react';
import { EyeOff } from 'lucide-react-native';
import { FilaDeAjuste, GrupoDeAjustes } from '../ui/FilaDeAjuste';
import { Rotulo } from '../ui/Rotulo';
import { IncognitoScreen } from './IncognitoScreen';
import { useIsSuperadmin } from './useIsSuperadmin';

/**
 * Ajustes → Superadmin (José 13/11): «Ver incógnitos» lives here, not in the space switcher.
 * Nothing shows for anyone else.
 */
export function SuperadminSetting(props: { jwt: string; onEnter: (spaceId: string) => void }) {
  const isSuperadmin = useIsSuperadmin(props.jwt);
  const [listing, setListing] = useState(false);
  if (!isSuperadmin) return null;
  return (
    <>
      <Rotulo>Superadmin</Rotulo>
      <GrupoDeAjustes>
        <FilaDeAjuste testID="btn-incognitos" icono={EyeOff} titulo="Ver incógnitos" detalle="Los espacios donde estás oculto · solo lees" onPress={() => setListing(true)} />
      </GrupoDeAjustes>
      <IncognitoScreen
        visible={listing}
        jwt={props.jwt}
        onEnter={(spaceId) => {
          setListing(false);
          props.onEnter(spaceId);
        }}
        onClose={() => setListing(false)}
      />
    </>
  );
}
