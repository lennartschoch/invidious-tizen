// Minimal ambient types for the Tizen TV / Invidious environment.

interface VjsPlayer {
  play(): void;
  pause(): void;
  paused(): boolean;
  currentTime(): number;
  currentTime(seconds: number): void;
  duration?(): number;
  volume(): number;
  volume(fraction: number): void;
  muted(): boolean;
  muted(value: boolean): void;
  userActive?(active?: boolean): boolean;
  controls?(visible?: boolean): void;
  isFullscreen?(): boolean;
  requestFullscreen?(): void;
  exitFullscreen?(): void;
}

interface TizenApplicationInstance {
  exit(): void;
}
interface TizenApplicationManager {
  getCurrentApplication(): TizenApplicationInstance;
}
interface TizenGlobal {
  application: TizenApplicationManager;
}

declare var tizen: TizenGlobal | undefined;

interface Window {
  __invidiousTizen?: boolean;
  __invidiousPicker?: boolean;
  player?: VjsPlayer;
}
