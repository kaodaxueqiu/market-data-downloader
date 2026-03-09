export const getFileType = (name: string) => {
  const idx = name.lastIndexOf(".");
  return name.slice(idx + 1);
};

export const getFileData = (data: Blob): Promise<ArrayBuffer> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function () {
      resolve(reader.result as ArrayBuffer);
    };
    reader.readAsArrayBuffer(data);
  });
};

export const base64toFile = (base64Str: string) => {
  const arr = base64Str.split(","),
    fileType = arr[0].match(/:(.*?);/)![1],
    bstr = atob(arr[1]),
    n = bstr.length,
    u8arr = new Uint8Array(n);

  let idx = n;
  while (idx--) {
    u8arr[idx] = bstr.charCodeAt(idx);
  }

  return new File([u8arr], `screenshot${Date.now()}.png`, {
    type: fileType,
  });
};

export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function (evt) {
      const base64 = evt.target?.result;
      resolve(base64 as string);
    };
    reader.readAsDataURL(file);
  });
