// Production-aware logger that silences non-error logs in production
const isProduction = import.meta.env.PROD;
const LOG_LEVEL = import.meta.env.MODE === 'production' ? 'error' : 'debug';

export const logger = {
  debug: (...args: any[]) => {
    if (!isProduction && LOG_LEVEL === 'debug') console.log(...args);
  },
  info: (...args: any[]) => {
    if (!isProduction && ['debug', 'info'].includes(LOG_LEVEL)) console.info(...args);
  },
  warn: (...args: any[]) => {
    if (!isProduction && ['debug', 'info', 'warn'].includes(LOG_LEVEL)) console.warn(...args);
  },
  error: (...args: any[]) => {
    console.error(...args); // Always log errors
  }
};
