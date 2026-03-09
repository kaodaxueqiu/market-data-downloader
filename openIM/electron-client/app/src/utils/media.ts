import excelIcon from "@/assets/images/messageItem/excel_icon.png";
import pdfIcon from "@/assets/images/messageItem/pdf_icon.png";
import pptIcon from "@/assets/images/messageItem/ppt_icon.png";
import unknownIcon from "@/assets/images/messageItem/unknown_icon.png";
import wordIcon from "@/assets/images/messageItem/word_icon.png";
import zipIcon from "@/assets/images/messageItem/file_icon.png";

export const avatarList = [
  {
    src: new URL("@/assets/avatar/ic_avatar_01.png", import.meta.url).href,
    name: "ic_avatar_01",
  },
  {
    src: new URL("@/assets/avatar/ic_avatar_02.png", import.meta.url).href,
    name: "ic_avatar_02",
  },
  {
    src: new URL("@/assets/avatar/ic_avatar_03.png", import.meta.url).href,
    name: "ic_avatar_03",
  },
  {
    src: new URL("@/assets/avatar/ic_avatar_04.png", import.meta.url).href,
    name: "ic_avatar_04",
  },
  {
    src: new URL("@/assets/avatar/ic_avatar_05.png", import.meta.url).href,
    name: "ic_avatar_05",
  },
  {
    src: new URL("@/assets/avatar/ic_avatar_06.png", import.meta.url).href,
    name: "ic_avatar_06",
  },
];

export const getDefaultAvatar = (name: string) => {
  return avatarList.find((avatar) => avatar.name === name)?.src;
};

const extensionIconMap: Record<string, string> = {
  // word
  doc: wordIcon,
  docx: wordIcon,
  docm: wordIcon,
  dot: wordIcon,
  dotx: wordIcon,
  wps: wordIcon,
  // ppt
  ppt: pptIcon,
  pptx: pptIcon,
  pps: pptIcon,
  ppsx: pptIcon,
  pot: pptIcon,
  potx: pptIcon,
  // excel
  xls: excelIcon,
  xlsx: excelIcon,
  xlsm: excelIcon,
  xlsb: excelIcon,
  csv: excelIcon,
  // pdf
  pdf: pdfIcon,
  // zip/archives
  zip: zipIcon,
  rar: zipIcon,
  "7z": zipIcon,
  tar: zipIcon,
  gz: zipIcon,
  bz2: zipIcon,
  xz: zipIcon,
};

const getExtension = (fileName?: string) => {
  if (!fileName) return "";
  const idx = fileName.lastIndexOf(".");
  if (idx < 0 || idx === fileName.length - 1) return "";
  return fileName.slice(idx + 1).toLowerCase();
};

const getIconByMime = (mimeType?: string) => {
  if (!mimeType) return "";
  const lower = mimeType.toLowerCase();
  if (lower.includes("pdf")) return pdfIcon;
  if (lower.includes("word")) return wordIcon;
  if (lower.includes("presentation") || lower.includes("powerpoint")) return pptIcon;
  if (lower.includes("sheet") || lower.includes("excel") || lower.includes("csv"))
    return excelIcon;
  if (lower.includes("zip") || lower.includes("rar") || lower.includes("7z"))
    return zipIcon;
  if (lower.includes("gzip") || lower.includes("tar")) return zipIcon;
  return "";
};

export const getFileIcon = (fileName?: string, mimeType?: string) => {
  const ext = getExtension(fileName);
  if (ext && extensionIconMap[ext]) return extensionIconMap[ext];
  const mimeIcon = getIconByMime(mimeType);
  return mimeIcon || unknownIcon;
};
