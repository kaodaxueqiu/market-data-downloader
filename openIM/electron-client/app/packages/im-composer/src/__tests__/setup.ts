import '@testing-library/jest-dom';

// Mock window.URL.createObjectURL and revokeObjectURL
const objectURLMap = new Map<File, string>();

Object.defineProperty(window.URL, 'createObjectURL', {
  value: (file: File) => {
    const url = `blob:test/${Math.random().toString(36).substring(7)}`;
    objectURLMap.set(file, url);
    return url;
  },
  configurable: true,
  writable: true,
});

Object.defineProperty(window.URL, 'revokeObjectURL', {
  value: (url: string) => {
    for (const [file, storedUrl] of objectURLMap.entries()) {
      if (storedUrl === url) {
        objectURLMap.delete(file);
        break;
      }
    }
  },
  configurable: true,
  writable: true,
});

// Mock window.prompt for link insertion
Object.defineProperty(window, 'prompt', {
  value: () => null,
  writable: true,
});
