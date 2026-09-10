const PREFIX = '[invidious-tizen]';

/** Console logging that never throws (some TV consoles are odd). */
export const log = (...args: unknown[]): void => {
  try {
    console.log(PREFIX, ...args);
  } catch {
    /* ignore */
  }
};
