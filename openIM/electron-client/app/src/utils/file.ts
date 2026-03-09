export const canSendImageTypeList = ["png", "jpg", "jpeg", "gif", "bmp", "webp"];

export const getLocalFileByPath = async (filePath?: string): Promise<File | null> => {
  if (!filePath || !window.electronAPI?.fileExists(filePath)) {
    return null;
  }
  return window.electronAPI.getFileByPath(filePath);
};
