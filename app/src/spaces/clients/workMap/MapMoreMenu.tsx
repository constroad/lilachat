import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { ArchiveRestore, Download, ExternalLink, Layers, Maximize2, MoreVertical, Paintbrush, Plus, Route, Share2, type LucideIcon } from 'lucide-react-native';
import { mapMoreItems, type MapMoreKey, type MapScreenItem } from '@lilachat/shared';
import { Sheet } from '../../../ui/Sheet';
import { useColores } from '../../../ui/tema';
import { KICKER } from './WorkMapPanel';
import { MAP_ROUND, MAP_SHADOW } from './MapFloating';

const ICONS: Record<MapMoreKey, LucideIcon> = { share: Share2, screen: Maximize2, area: Route, draw: Plus, stages: Layers, works: Paintbrush, export: Download, open: ExternalLink, deleted: ArchiveRestore };
/** The test ids the buttons had before they moved under «Más»: the E2E and the tutorials keep them. */
const TEST_IDS: Record<MapMoreKey, string> = { share: 'mapa-compartir', screen: 'mapa-pantalla-completa', area: 'mapa-marcar-calles', draw: 'mapa-nueva-calle', stages: 'mapa-etapas-abrir', works: 'mapa-trabajos-abrir', export: 'mapa-exportar', open: 'mapa-abrir', deleted: 'mapa-borrados-abrir' };

/**
 * «Más» (José 09/11): everything that is not «Registrar avance», in one sheet. José 20/11 (design
 * mapa-v2): a round ⋮ over the map, with «Compartir avance» and «Pantalla completa» first.
 */
export function MapMoreMenu(props: { onPick: (key: MapMoreKey) => void; draws: boolean; edits: boolean; admin: boolean; share?: boolean; screen?: MapScreenItem }) {
  const colors = useColores();
  const [open, setOpen] = useState(false);
  const items = mapMoreItems(props);
  return (
    <>
      <Pressable testID="mapa-mas" accessibilityLabel="Más opciones del mapa" onPress={() => setOpen(true)} className={MAP_ROUND} style={MAP_SHADOW}>
        <MoreVertical size={20} color={colors['on-surface']} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} testID="mapa-mas-menu" className="px-4 pt-2">
        <Text className={`${KICKER} mb-2`}>Mapa de la obra</Text>
        {items.map((item) => {
          const Icon = ICONS[item.key];
          return (
            <Pressable key={item.key} testID={TEST_IDS[item.key]} onPress={() => { setOpen(false); props.onPick(item.key); }} className="min-h-[52px] flex-row items-center gap-3 border-b border-outline/10">
              <Icon size={20} color={colors['on-surface-variant']} />
              <Text className="text-[16px] font-semibold text-on-surface">{item.label}</Text>
            </Pressable>
          );
        })}
      </Sheet>
    </>
  );
}
