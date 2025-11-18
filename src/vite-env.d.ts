/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TEAM_MEMBERS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}