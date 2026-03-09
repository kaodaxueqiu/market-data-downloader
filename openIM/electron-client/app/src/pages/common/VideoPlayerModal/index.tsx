import { CloseOutlined } from "@ant-design/icons";
import { App } from "antd";
import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import ReactPlayer from "react-player";

const VideoPlayerContent = ({
  url,
  fromElectonMoment,
  onClose,
}: {
  url: string;
  fromElectonMoment: boolean;
  onClose: () => void;
}) => {
  const playerRef = useRef<ReactPlayer>(null);
  const [videoSize, setVideoSize] = useState<{ width: number; height: number } | null>(
    null,
  );

  useEffect(() => {
    setVideoSize(null);
  }, [url]);

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

  const fallbackRatio = 16 / 9;
  const ratio =
    videoSize && videoSize.width > 0 && videoSize.height > 0
      ? videoSize.width / videoSize.height
      : fallbackRatio;
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : fallbackRatio;
  const widthValue = videoSize
    ? `min(${videoSize.width}px, 90vw, ${
        fromElectonMoment ? "960px" : "600px"
      }, calc(70vh * ${safeRatio}))`
    : `min(90vw, ${fromElectonMoment ? "960px" : "600px"}, calc(70vh * ${safeRatio}))`;
  const containerStyle: CSSProperties = {
    width: widthValue,
    aspectRatio: safeRatio,
  };

  return (
    <div className="relative mx-auto" style={containerStyle}>
      <div
        className="app-no-drag absolute top-4 right-4 z-20 flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg bg-[rgba(0,0,0,0.15)]"
        onClick={onClose}
      >
        <CloseOutlined className="text-(--sub-text)" rev={undefined} />
      </div>
      <ReactPlayer
        ref={playerRef}
        url={url}
        playing
        controls
        width="100%"
        height="100%"
        className="absolute inset-0 z-0"
        onReady={updateVideoSize}
        onPlay={updateVideoSize}
      />
    </div>
  );
};

export const useVideoPlayer = () => {
  const { modal } = App.useApp();

  const showVideoPlayer = (url: string, fromElectonMoment = false) => {
    const current = modal.confirm({
      title: null,
      icon: null,
      footer: null,
      centered: true,
      width: "auto",
      maskTransitionName: "",
      className: "no-padding-modal",
      maskStyle: {
        opacity: 0,
        transition: "none",
      },
      content: (
        <VideoPlayerContent
          url={url}
          fromElectonMoment={fromElectonMoment}
          onClose={() => current.destroy()}
        />
      ),
    });
  };

  return { showVideoPlayer };
};
