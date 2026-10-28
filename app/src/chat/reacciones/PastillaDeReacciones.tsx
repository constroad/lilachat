import { Pressable, Text, View } from 'react-native';
import { resumenDeReacciones, type Reaccion } from '@lilachat/shared';
import { AVATAR_DE_AUTOR } from '../burbuja';
import { ReactionGlyph } from './ReactionGlyph';

/** El `gap-2` entre el avatar del autor y su burbuja (dp), más el aire hasta el borde de la burbuja. */
const SANGRIA = 8 + 10;
/** Cuántos emojis distintos entran en la pastilla antes de resumir con «+N». */
const EMOJIS_VISIBLES = 3;

/**
 * Las reacciones montadas sobre el borde inferior de la burbuja (20/10; diseño
 * `f1-app-reacciones`): «👍 2 · ❤️ 1». Tocarla abre quién reaccionó.
 */
export function PastillaDeReacciones(props: { id: string; reacciones: readonly Reaccion[] | undefined; yo: string; mia: boolean; conAvatar: boolean; onTocar: () => void; /** Under a highlighted notice, in the middle (21/10). */ centered?: boolean; /** In a flat row (Slack format): on the left, after the avatar, below the text. */ indent?: number }) {
  const grupos = resumenDeReacciones(props.reacciones, props.yo);
  if (grupos.length === 0) return null;
  const total = grupos.reduce((suma, grupo) => suma + grupo.cuantos, 0);
  const visibles = grupos.slice(0, EMOJIS_VISIBLES);
  const etiqueta = grupos.map((grupo) => `${grupo.emoji} ${grupo.cuantos}`).join(', ');
  return (
    <View className={`${props.indent !== undefined ? 'mb-1 mt-1' : '-mt-2.5 mb-1'} flex-row ${props.centered ? 'justify-center' : props.mia && props.indent === undefined ? 'justify-end pr-2.5' : ''}`} style={props.centered ? undefined : { paddingLeft: props.indent ?? (props.mia ? 0 : (props.conAvatar ? AVATAR_DE_AUTOR : 0) + SANGRIA) }}>
      <Pressable
        testID={`pastilla-reacciones-${props.id}`}
        accessibilityRole="button"
        accessibilityLabel={`Reacciones: ${etiqueta}. Ver quién reaccionó`}
        onPress={props.onTocar}
        className={`min-h-[28px] flex-row items-center gap-1 rounded-full border px-2 ${grupos.some((grupo) => grupo.mia) ? 'border-primary/30 bg-surface' : 'border-outline/15 bg-surface'}`}
      >
        {visibles.map((grupo, indice) => (
          <View key={grupo.emoji} className="flex-row items-center gap-0.5">
            {indice > 0 ? <Text className="text-[12px] text-on-surface-variant">·</Text> : null}
            <ReactionGlyph emoji={grupo.emoji} size={16} />
            {grupo.cuantos > 1 || grupos.length > 1 ? <Text className="text-[12px] text-on-surface">{grupo.cuantos}</Text> : null}
          </View>
        ))}
        {grupos.length > EMOJIS_VISIBLES ? <Text className="text-[12px] text-on-surface-variant">+{total - visibles.reduce((suma, grupo) => suma + grupo.cuantos, 0)}</Text> : null}
      </Pressable>
    </View>
  );
}
