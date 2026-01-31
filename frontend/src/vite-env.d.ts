/// <reference types="vite/client" />

interface Window {
  __destroyLoader?: () => void;
}

interface ImportMetaEnv {
    readonly VITE_API_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
