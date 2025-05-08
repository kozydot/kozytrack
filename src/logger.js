const pino = require('pino');
const chalk = require('chalk'); // for context coloring

// base pino logger (no context prefix)
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      levelFirst: true,
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname,context', // ignore pino's context, we handle prefix
      // (removed default context format)
    },
  },
});

// colors for context tags
const contextColors = {
    'MAIN': chalk.bold.white,
    'CONFIG': chalk.blue,
    'DISCORD': chalk.magenta,
    'SPOTIFY': chalk.green,
    'AUTHSVR': chalk.cyan,
    'POLLING': chalk.yellow,
    'CMD:CHANNELSET': chalk.bold.magenta,
    'CMD:FETCHLYRICS': chalk.bold.cyan,
    'LYRICS': chalk.italic.gray,
    'EMBEDS': chalk.hex('#FFD700'),
    'DEFAULT': chalk.gray,
};

// get a logger instance with context prefix
function getLogger(context = 'App') {
    // Use uppercase context for lookup and prefix
    const upperContext = context.toUpperCase();
    const color = contextColors[upperContext] || contextColors['DEFAULT'];
    const prefix = color(`[${upperContext}]`);

    // return wrapper for pino methods
    return {
        info: (obj, msg) => {
            if (typeof obj === 'string') { // only msg passed
                logger.info(`${prefix} ${obj}`);
            } else { // obj + msg passed
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
             if (typeof obj === 'string') { // msg string passed first?
                 logger.error(`${prefix} ${obj}`);
             } else if (obj instanceof Error) { // error obj passed first?
                 logger.error({ err: obj }, `${prefix} ${msg || obj.message}`); // log error obj under 'err'
             }
              else { // structured obj + msg?
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
             if (typeof obj === 'string') { // string msg?
                 logger.fatal(`${prefix} ${obj}`);
             } else if (obj instanceof Error) { // error obj?
                 logger.fatal({ err: obj }, `${prefix} ${msg || obj.message}`); // log error obj under 'err'
             }
              else { // structured obj + msg?
                 logger.fatal(obj, `${prefix} ${msg}`);
             }
        },
        // direct child access (rarely needed)
        child: (bindings) => logger.child(bindings),
    };
}

module.exports = {
    // logger, // don't export base logger
    getLogger,
};
