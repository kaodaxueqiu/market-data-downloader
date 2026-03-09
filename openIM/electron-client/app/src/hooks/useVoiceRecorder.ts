import { useCallback, useRef, useState } from "react";

export interface VoiceRecordResult {
  file: File;
  duration: number;
}

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const resolveRef = useRef<((result: VoiceRecordResult | null) => void) | null>(null);

  const startRecording = useCallback(async (): Promise<VoiceRecordResult | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      setDuration(0);
      startTimeRef.current = Date.now();

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      return new Promise<VoiceRecordResult | null>((resolve) => {
        resolveRef.current = resolve;

        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setIsRecording(false);

          const finalDuration = Math.round((Date.now() - startTimeRef.current) / 1000);
          if (finalDuration < 1 || chunksRef.current.length === 0) {
            resolve(null);
            return;
          }

          const blob = new Blob(chunksRef.current, { type: mimeType });
          const file = new File([blob], `voice_${Date.now()}.webm`, { type: mimeType });
          resolve({ file, duration: finalDuration });
        };

        recorder.start(200);
        setIsRecording(true);

        timerRef.current = setInterval(() => {
          setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
        }, 500);
      });
    } catch {
      setIsRecording(false);
      return null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    chunksRef.current = [];
    setIsRecording(false);
    setDuration(0);
    resolveRef.current?.(null);
  }, []);

  return { isRecording, duration, startRecording, stopRecording, cancelRecording };
}
