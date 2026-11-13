import { useVideoPlayer, VideoView } from 'expo-video';

/**
 * A recorded video playing in a loop, muted until touched: the camera's review (design cam-06)
 * and the «Enviar» screen of the chat, which showed only an icon for a video.
 */
export function VideoPreview(props: { uri: string; fit: 'cover' | 'contain'; controls?: boolean }) {
  const player = useVideoPlayer(props.uri, (created) => {
    created.loop = true;
    created.play();
  });
  return <VideoView testID="vista-video" player={player} style={{ flex: 1, alignSelf: 'stretch' }} contentFit={props.fit} nativeControls={Boolean(props.controls)} />;
}
