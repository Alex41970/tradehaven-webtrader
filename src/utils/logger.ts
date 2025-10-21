const LOG_LEVEL = import.meta.env.MODE === 'production' ? 'error' : 'debug';

export const logger = {
  debug: (...args: any[]) => {
    if (LOG_LEVEL === 'debug') console.log(...args);
  },
  info: (...args: any[]) => {
    if (['debug', 'info'].includes(LOG_LEVEL)) console.info(...args);
  },
  warn: (...args: any[]) => {
    if (['debug', 'info', 'warn'].includes(LOG_LEVEL)) console.warn(...args);
  },
  error: (...args: any[]) => {
    console.error(...args); // Always log errors
  }
};
