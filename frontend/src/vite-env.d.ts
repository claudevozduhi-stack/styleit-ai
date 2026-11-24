/// <reference types="vite/client" />

/** Переменные окружения фронтенда, доступные при сборке. */
interface ImportMetaEnv {
  /** Адрес API бэкенда, например https://styleit-api.onrender.com */
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
