import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { Download, ExternalLink, X } from 'lucide-react-native';
import { fitVideo, VIDEO_PLAYER_ORIGIN, videoPlayerHtml, videoSaveHint, type VideoEmbed } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';

/** Room for the bar on top, the «Descargar» button and the margin under the video (dp). */
const CHROME_HEIGHT = 204;

/**
 * A YouTube, TikTok, Instagram or Facebook video played inside Lilachat
 * (pending 6), with the site's own player. The page holds only that player;
 * any navigation out of it (the logo, «watch on YouTube») goes to the
 * browser, never inside this WebView.
 */
export function VideoEmbedPlayer(props: { video: VideoEmbed | null; link: string; onClose: () => void }) {
  const screen = useWindowDimensions();
  const margins = useMargenes();
  const video = props.video;
  const size = video ? fitVideo(video.aspect, { width: screen.width, height: screen.height - CHROME_HEIGHT - margins.cabecera }) : null;
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setSaving(false);
  }, [video]);
  const keepInside = (request: WebViewNavigation & { isTopFrame?: boolean }) => {
    if (request.isTopFrame === false || request.url === 'about:blank' || request.url.startsWith(VIDEO_PLAYER_ORIGIN)) return true;
    void Linking.openURL(request.url);
    return false;
  };
  return (
    <Modal visible={video !== null} animationType="fade" onRequestClose={props.onClose} statusBarTranslucent>
      <View testID="reproductor-video" className="flex-1 bg-black" style={{ paddingTop: margins.cabecera }}>
        <View className="flex-row items-center gap-2 px-2 pb-2">
          <Pressable testID="btn-cerrar-video" accessibilityLabel="Cerrar el video" onPress={props.onClose} className="h-11 w-11 items-center justify-center">
            <X size={24} color="white" />
          </Pressable>
          <Text className="flex-1 text-[15px] font-semibold text-white">{video?.label}</Text>
          <Pressable testID="btn-abrir-video-afuera" onPress={() => void Linking.openURL(props.link)} className="h-11 flex-row items-center gap-1.5 rounded-full px-3">
            <ExternalLink size={16} color="white" />
            <Text className="text-[13px] font-semibold text-white">Abrir en {video?.label}</Text>
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center">
          {video && size ? (
            <View style={size}>
              <WebView
                testID="webview-video"
                source={{ html: videoPlayerHtml(video), baseUrl: VIDEO_PLAYER_ORIGIN }}
                originWhitelist={['https://*', 'about:blank']}
                onShouldStartLoadWithRequest={keepInside}
                setSupportMultipleWindows={false}
                allowFileAccess={false}
                allowsFullscreenVideo
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                domStorageEnabled
                style={{ backgroundColor: 'black' }}
              />
            </View>
          ) : null}
        </View>
        {video ? (
          <View className="items-center px-4 pt-2" style={{ paddingBottom: margins.pie + 12 }}>
            <Pressable testID="btn-descargar-video" onPress={() => setSaving(true)} className="h-11 flex-row items-center gap-2 rounded-full bg-white/15 px-5">
              <Download size={18} color="white" />
              <Text className="text-[14px] font-semibold text-white">Descargar</Text>
            </Pressable>
          </View>
        ) : null}
        {video && saving ? <SaveGuide video={video} link={props.link} bottom={margins.pie} onClose={() => setSaving(false)} /> : null}
      </View>
    </Modal>
  );
}

/**
 * José, 01/11: download it, but never from our server (a network could block
 * it). The video is saved in the network's own app; the guide says how, and
 * then it comes back to Lilachat through «Compartir».
 */
function SaveGuide(props: { video: VideoEmbed; link: string; bottom: number; onClose: () => void }) {
  const colores = useColores();
  const hint = videoSaveHint(props.video.provider);
  return (
    <View testID="guia-descargar-video" className="absolute inset-x-0 bottom-0 gap-3 rounded-t-3xl bg-surface px-5 pt-5" style={{ paddingBottom: props.bottom + 16 }}>
      <Text className="text-[17px] font-bold text-on-surface">Descargar de {props.video.label}</Text>
      {hint.steps.map((step) => (
        <Text key={step} className="text-[15px] leading-[21px] text-on-surface-variant">
          {step}
        </Text>
      ))}
      <Pressable testID="btn-abrir-para-descargar" onPress={() => void Linking.openURL(props.link)} className="mt-1 h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary">
        <ExternalLink size={18} color={colores['on-primary']} />
        <Text className="text-[15px] font-semibold text-on-primary">Abrir en {props.video.label}</Text>
      </Pressable>
      <Pressable testID="btn-cerrar-guia-descargar" onPress={props.onClose} className="h-11 items-center justify-center">
        <Text className="text-[15px] font-semibold text-primary">Cerrar</Text>
      </Pressable>
    </View>
  );
}
