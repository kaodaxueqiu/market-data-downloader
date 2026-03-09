export const bytesToSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024,
    sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
    i = Math.floor(Math.log(bytes) / Math.log(k));

  const size = bytes / Math.pow(k, i);
  return `${size % 1 === 0 ? size : size.toFixed(2)} ${sizes[i]}`;
};

export const secondsToMS = (duration: number) => {
  let minutes = Math.floor(duration / 60) % 60;
  let seconds = (duration % 60).toString();
  minutes = minutes.toString().padStart(2, "0") as unknown as number;
  seconds = seconds.length === 1 ? "0" + seconds : seconds;
  return `${minutes}:${seconds}`;
};

export const formatBr = (str: string) => str.replace(/\n/g, "<br>");