import { Linking, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { ExternalLink, X } from 'lucide-react-native';
import { fitVideo, VIDEO_PLAYER_ORIGIN, videoPlayerHtml, type VideoEmbed } from '@lilachat/shared';
import { Modal } from '../ui/Modal';
import { useMargenes } from '../ui/useMargenes';

/** Room for the bar on top and the margin under the video (dp). */
const CHROME_HEIGHT = 140;

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
      </View>
    </Modal>
  );
}
