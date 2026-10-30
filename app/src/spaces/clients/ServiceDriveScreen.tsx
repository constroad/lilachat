import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { ChevronRight, Cloud, ExternalLink, FileText, Folder, Image as ImageIcon, Search } from 'lucide-react-native';
import { driveFolders, filesInFolder, searchServiceFiles, type ServiceFile } from '@lilachat/shared';
import { BASE_URL } from '../../api/client';
import { PantallaEnModal } from '../../ui/PantallaEnModal';
import { useColores } from '../../ui/tema';
import { jsonCall } from '../../api/jsonCall';

const RECENT = 3;
const BYTES_PER_MB = 1_048_576;
type Loaded = { state: 'loading' } | { state: 'ready'; files: ServiceFile[]; driveUrl: string | null } | { state: 'failed'; message: string; driveUrl: string | null };

/** Asked when the Drive opens, never stored (pending 121): agentes asks Portal for the service's files. */
function useServiceFiles(jwt: string, spaceId: string, clientId: string, serviceId: string | null): Loaded {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  useEffect(() => {
    setLoaded({ state: 'loading' });
    if (!serviceId) return undefined;
    let alive = true;
    void jsonCall<{ files?: ServiceFile[]; drive_url?: string | null; message?: string }>(`${BASE_URL}/api/workspaces/${spaceId}/clients/${encodeURIComponent(clientId)}/services/${encodeURIComponent(serviceId)}/files`, jwt).then((response) => {
      if (!alive) return;
      if (response.ok && response.data.files) setLoaded({ state: 'ready', files: response.data.files, driveUrl: response.data.drive_url ?? null });
      else setLoaded({ state: 'failed', message: response.ok ? (response.data.message ?? 'No se pudo traer el Drive') : 'No se pudo traer el Drive', driveUrl: response.ok ? (response.data.drive_url ?? null) : null });
    });
    return () => {
      alive = false;
    };
  }, [jwt, spaceId, clientId, serviceId]);
  return loaded;
}

const detailOf = (file: ServiceFile) => [file.folder, file.sizeBytes !== undefined ? `${(file.sizeBytes / BYTES_PER_MB).toFixed(1)} MB` : '', file.modifiedAt ? new Date(file.modifiedAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) : ''].filter(Boolean).join(' · ');

function FileRow({ file }: { file: ServiceFile }) {
  const colors = useColores();
  const Icon = file.mime.startsWith('image/') ? ImageIcon : FileText;
  return (
    <Pressable testID="archivo-drive" onPress={() => void Linking.openURL(file.url)} className="min-h-[52px] flex-row items-center gap-3 border-b border-outline/10 px-3 py-2">
      <Icon size={18} color={colors.primary} />
      <View className="min-w-0 flex-1">
        <Text className="text-[14px] text-on-surface" numberOfLines={1}>{file.name}</Text>
        <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>{detailOf(file)}</Text>
      </View>
    </Pressable>
  );
}

const Group = ({ children }: { children: React.ReactNode }) => <View className="overflow-hidden rounded-xl border border-outline/15 bg-surface">{children}</View>;

/**
 * «Drive» of one service (pending 121, design f-06): breadcrumb, search, the
 * top folders with their counts, the newest files and, inside a folder, its
 * files. A failure says «No se pudo traer el Drive» with the service's link.
 */
export function ServiceDriveScreen(props: { jwt: string; spaceId: string; clientId: string; service: { id: string; name: string } | null; onClose: () => void }) {
  const colors = useColores();
  const loaded = useServiceFiles(props.jwt, props.spaceId, props.clientId, props.service?.id ?? null);
  const [folder, setFolder] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const files = loaded.state === 'ready' ? loaded.files : [];
  const found = useMemo(() => searchServiceFiles(files, query), [files, query]);
  const folders = driveFolders(files);
  const loose = filesInFolder(files, null);
  return (
    <PantallaEnModal visible={props.service !== null} titulo="Drive del servicio" onCerrar={props.onClose} testIDCerrar="btn-cerrar-drive">
      <View testID="drive-servicio" className="gap-3 pb-6">
        <View className="flex-row items-center gap-1.5">
          <Pressable onPress={() => setFolder(null)} className="flex-row items-center gap-1"><Cloud size={15} color={colors.primary} /><Text className="text-[14px] font-semibold text-primary">Drive</Text></Pressable>
          <ChevronRight size={14} color={colors['on-surface-variant']} />
          <Text className="min-w-0 flex-shrink text-[14px] text-on-surface" numberOfLines={1}>{folder ?? props.service?.name}</Text>
        </View>
        {loaded.state === 'loading' ? <ActivityIndicator className="mt-6" color={colors.primary} /> : null}
        {loaded.state === 'failed' ? (
          <View testID="drive-fallo" className="rounded-xl border border-outline/15 p-4">
            <Text className="text-[15px] font-semibold text-on-surface">{loaded.message}</Text>
            {loaded.driveUrl ? <Pressable onPress={() => loaded.driveUrl && void Linking.openURL(loaded.driveUrl)} className="mt-2 min-h-[40px] flex-row items-center gap-1.5"><ExternalLink size={15} color={colors.primary} /><Text className="text-[14px] font-semibold text-primary">Abrir el servicio en el Portal</Text></Pressable> : null}
          </View>
        ) : null}
        {loaded.state === 'ready' ? (
          <>
            <View className="h-11 flex-row items-center gap-2 rounded-xl border border-outline/15 px-3">
              <Search size={16} color={colors['on-surface-variant']} />
              <TextInput testID="buscar-drive" value={query} onChangeText={setQuery} placeholder="Buscar en el Drive del servicio…" className="flex-1 text-[14px] text-on-surface" />
            </View>
            {files.length === 0 ? <Text className="py-6 text-center text-[14px] text-on-surface-variant">Este servicio todavía no tiene archivos.</Text> : null}
            {query.trim().length >= 2 ? (
              <Group>{found.length ? found.map((file) => <FileRow key={file.url} file={file} />) : <Text className="p-4 text-[14px] text-on-surface-variant">{`Nada coincide con «${query.trim()}».`}</Text>}</Group>
            ) : folder ? (
              <Group>{filesInFolder(files, folder).map((file) => <FileRow key={file.url} file={file} />)}</Group>
            ) : (
              <>
                {folders.length ? <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">Carpetas principales</Text> : null}
                {folders.length ? (
                  <Group>
                    {folders.map((one) => (
                      <Pressable key={one.name} testID={`carpeta-${one.name}`} onPress={() => setFolder(one.name)} className="min-h-[56px] flex-row items-center gap-3 border-b border-outline/10 px-3">
                        <Folder size={20} color={colors.primary} />
                        <Text className="min-w-0 flex-1 text-[15px] font-semibold text-on-surface" numberOfLines={1}>{one.name}</Text>
                        <Text className="text-[14px] font-semibold text-on-surface-variant">{one.count}</Text>
                        <ChevronRight size={16} color={colors['on-surface-variant']} />
                      </Pressable>
                    ))}
                  </Group>
                ) : null}
                {files.length ? <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">Recientes</Text> : null}
                {files.length ? <Group>{files.slice(0, RECENT).map((file) => <FileRow key={file.url} file={file} />)}</Group> : null}
                {loose.length ? <Group>{loose.map((file) => <FileRow key={file.url} file={file} />)}</Group> : null}
              </>
            )}
            {loaded.driveUrl ? <Pressable onPress={() => loaded.driveUrl && void Linking.openURL(loaded.driveUrl)} className="min-h-[44px] flex-row items-center gap-1.5"><ExternalLink size={15} color={colors.primary} /><Text className="text-[14px] font-semibold text-primary">Abrir en Google Drive</Text></Pressable> : null}
          </>
        ) : null}
      </View>
    </PantallaEnModal>
  );
}
