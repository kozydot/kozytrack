const pino = require('pino');
const chalk = require('chalk'); // Re-import chalk for context coloring

// base logger configuration - no context prefix here
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      levelFirst: true,
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname,context', // ignore context binding here
      // messageFormat: '[{context}] {msg}', // remove default context formatting
    },
  },
});

// define colors for different contexts
const contextColors = {
    'Main': chalk.bold.white,
    'Config': chalk.blue,
    'Discord': chalk.magenta,
    'Spotify': chalk.green,
    'AuthServer': chalk.cyan,
    'Polling': chalk.yellow,
    'Cmd:ChannelSet': chalk.bold.magenta,
    'Cmd:FetchLyrics': chalk.bold.cyan,
    'Lyrics': chalk.italic.gray, // context for lyrics specific logs inside fetchlyrics
    'DEFAULT': chalk.gray, // fallback color
};

// helper function to create contextual loggers
function getLogger(context = 'App') {
    const color = contextColors[context] || contextColors['DEFAULT'];
    const prefix = color(`[${context}]`);

    // return a wrapper object with logging methods
    return {
        info: (obj, msg) => {
            if (typeof obj === 'string') { // handle case where only message is passed
                logger.info(`${prefix} ${obj}`);
            } else { // handle case where object and message are passed
                logger.info(obj, `${prefix} ${msg}`);
            }
        },
        warn: (obj, msg) => {
             if (typeof obj === 'string') {
                logger.warn(`${prefix} ${obj}`);
            } else {
                logger.warn(obj, `${prefix} ${msg}`);
            }
        },
        error: (obj, msg) => {
             if (typeof obj === 'string') { // often error is passed as first arg
                 logger.error(`${prefix} ${obj}`);
             } else if (obj instanceof Error) { // handle error object passed first
                 logger.error({ err: obj }, `${prefix} ${msg || obj.message}`);
             }
              else { // handle structured object + message
                 logger.error(obj, `${prefix} ${msg}`);
             }
        },
        debug: (obj, msg) => {
             if (typeof obj === 'string') {
                logger.debug(`${prefix} ${obj}`);
            } else {
                logger.debug(obj, `${prefix} ${msg}`);
            }
        },
        trace: (obj, msg) => {
             if (typeof obj === 'string') {
                logger.trace(`${prefix} ${obj}`);
            } else {
                logger.trace(obj, `${prefix} ${msg}`);
            }
        },
        fatal: (obj, msg) => {
             if (typeof obj === 'string') {
                 logger.fatal(`${prefix} ${obj}`);
             } else if (obj instanceof Error) {
                 logger.fatal({ err: obj }, `${prefix} ${msg || obj.message}`);
             }
              else {
                 logger.fatal(obj, `${prefix} ${msg}`);
             }
        },
        // allow direct access if needed, though less common now
        child: (bindings) => logger.child(bindings),
    };
}

module.exports = {
    // logger, // maybe don't export base logger directly anymore
    getLogger,
};
