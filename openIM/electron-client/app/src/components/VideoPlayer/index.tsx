import {
  type CSSProperties,
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import ReactPlayer from "react-player";

const VideoPlayer: ForwardRefRenderFunction<
  {
    pausePlay: () => void;
  },
  {
    url: string;
    autoplay?: boolean;
    poster?: string;
  }
> = ({ url, autoplay, poster }, ref) => {
  const [playing, setPlaying] = useState(Boolean(autoplay));
  const [videoSize, setVideoSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const playerRef = useRef<ReactPlayer>(null);

  useEffect(() => {
    setPlaying(Boolean(autoplay));
  }, [autoplay, url]);

  useEffect(() => {
    setVideoSize(null);
  }, [url]);

  const pausePlay = () => {
    setPlaying(false);
  };

  const updateVideoSize = useCallback(() => {
    const internalPlayer = playerRef.current?.getInternalPlayer();
    if (!internalPlayer || typeof internalPlayer !== "object") return;
    if (!("videoWidth" in internalPlayer) || !("videoHeight" in internalPlayer)) return;

    const video = internalPlayer as HTMLVideoElement;
    if (!video.videoWidth || !video.videoHeight) return;

    setVideoSize((prev) => {
      if (prev?.width === video.videoWidth && prev?.height === video.videoHeight) {
        return prev;
      }
      return { width: video.videoWidth, height: video.videoHeight };
    });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      pausePlay,
    }),
    [],
  );

  const fallbackRatio = 16 / 9;
  const ratio =
    videoSize && videoSize.width > 0 && videoSize.height > 0
      ? videoSize.width / videoSize.height
      : fallbackRatio;
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : fallbackRatio;
  const widthValue = videoSize
    ? `min(${videoSize.width}px, 100%, 90vw, calc(70vh * ${safeRatio}))`
    : `min(100%, 90vw, calc(70vh * ${safeRatio}))`;
  const containerStyle: CSSProperties = {
    width: widthValue,
    aspectRatio: safeRatio,
  };

  return (
    <div className="relative mx-auto" style={containerStyle}>
      <ReactPlayer
        ref={playerRef}
        url={url}
        playing={playing}
        controls
        width="100%"
        height="100%"
        light={poster}
        className="absolute inset-0"
        onReady={updateVideoSize}
        onPlay={updateVideoSize}
        onError={(e) => console.error("video play error", e)}
      />
    </div>
  );
};

export default memo(forwardRef(VideoPlayer));
