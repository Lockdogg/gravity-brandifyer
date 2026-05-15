import type { LibInfo } from './types';

export type MainToUiMessage =
  | { type: 'lib-info'; info: LibInfo }
  | { type: 'lib-error'; message: string; missingCollections?: string[] };

export type UiToMainMessage =
  | { type: 'close' };
