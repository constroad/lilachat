import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { MapPin, Search } from 'lucide-react-native';
import { findPlace, type PlaceAsk, type PlaceResult, type WorkMapPoint } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';

const NO_ASK: PlaceAsk = async () => ({ ok: false, message: 'Escribe las coordenadas o pega el enlace.' });

/**
 * «Busca un lugar o pega el enlace» over the street editor (José 08/11, the same as Portal): a
 * place name, «lat,lng» or the Google Maps link the client sends. A pick takes the map there.
 */
export function PlaceSearch(props: { ask?: PlaceAsk; near?: WorkMapPoint; onPick: (point: WorkMapPoint) => void }) {
  const colors = useColores();
  const [text, setText] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pick = (place: PlaceResult) => { setResults([]); props.onPick({ lat: place.lat, lng: place.lng }); };
  const search = async () => {
    setBusy(true);
    setError(null);
    const answer = await findPlace(text, props.ask ?? NO_ASK, props.near);
    setBusy(false);
    if (!answer.ok) return setError(answer.message);
    if (answer.results.length === 1) return pick(answer.results[0]!);
    setResults(answer.results);
  };
  return (
    <View className="mt-2">
      <View className="flex-row gap-2">
        <TextInput testID="editor-buscar-lugar" value={text} onChangeText={setText} onSubmitEditing={() => void search()} returnKeyType="search" placeholder="Busca un lugar o pega el enlace" placeholderTextColor={colors['on-surface-variant']} className="h-11 flex-1 rounded-xl bg-surface px-3 text-[15px] text-on-surface" />
        <Pressable testID="editor-buscar-ir" accessibilityLabel="Buscar" disabled={busy || !text.trim()} onPress={() => void search()} className={`h-11 w-11 items-center justify-center rounded-xl bg-surface ${busy || !text.trim() ? 'opacity-60' : ''}`}>
          <Search size={18} color={colors.primary} />
        </Pressable>
      </View>
      {error ? <Text testID="editor-buscar-error" className="mt-1 text-[13px] font-semibold text-on-primary">{error}</Text> : null}
      {results.length ? (
        <View className="mt-1 overflow-hidden rounded-xl border border-outline/15 bg-surface">
          {results.map((place, index) => (
            <Pressable key={`${place.lat},${place.lng}`} testID={`editor-lugar-${index}`} onPress={() => pick(place)} className="min-h-[44px] flex-row items-center gap-2 px-3 py-2">
              <MapPin size={14} color={colors.primary} /><Text numberOfLines={2} className="flex-1 text-[14px] text-on-surface">{place.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
