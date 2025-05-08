const fs = require('fs');
const path = require('path');
const { getLogger } = require('./logger'); // pino logger

const log = getLogger('CONFIG'); // logger for this module
const dataDir = path.join(__dirname, '..', 'data'); // where config lives
const configPath = path.join(dataDir, 'config.json'); // the config file itself

// in-memory cache of config
let configCache = {
    targetChannelId: null,
    spotifyRefreshToken: null,
};

// load config from file into cache
function loadConfig() {
    try {
        if (fs.existsSync(configPath)) {
            log.debug(`Found config file at: ${configPath}`);
            let rawData = '';
            try {
                rawData = fs.readFileSync(configPath, 'utf8'); // read file content
            } catch (readError) {
                 log.error({ err: readError }, `Failed to read existing config file at ${configPath}. Treating as missing.`);
                 // reset cache, create default below
                 configCache.targetChannelId = null;
                 configCache.spotifyRefreshToken = null;
                 saveConfig(); // try creating default file
                 return configCache;
            }

            if (!rawData || rawData.trim().length === 0) {
                log.warn(`Config file at ${configPath} is empty. Treating as missing and creating defaults.`);
                // reset cache, create default below
                configCache.targetChannelId = null;
                configCache.spotifyRefreshToken = null;
                saveConfig(); // try creating default file
            } else {
                try {
                    const loadedConfig = JSON.parse(rawData);
                    configCache.targetChannelId = loadedConfig.targetChannelId || null;
                    configCache.spotifyRefreshToken = loadedConfig.spotifyRefreshToken || null;
                    log.info(`Successfully loaded and parsed config file from ${configPath}.`);
                    log.info(`Target Channel ID: ${configCache.targetChannelId ? configCache.targetChannelId : 'Not Set'}`);
                    log.info(`Spotify Refresh Token: ${configCache.spotifyRefreshToken ? 'Set' : 'Not Set'}`);
                } catch (parseError) {
                    log.error({ err: parseError }, `Failed to parse JSON from config file at ${configPath}. File content might be corrupt. Treating as missing.`);
                    // reset cache, create default below
                    configCache.targetChannelId = null;
                    configCache.spotifyRefreshToken = null;
                    saveConfig(); // try creating default file (might overwrite bad one)
                }
            }
        } else {
            log.warn(`Config file not found at ${configPath}, creating with defaults.`);
            saveConfig(); // create default file if none exists
        }
    } catch (error) {
        // catch any other unexpected errors
        log.error({ err: error }, `Unexpected error during config load process for ${configPath}. Resetting config cache.`);
        configCache.targetChannelId = null;
        configCache.spotifyRefreshToken = null;
    }
    return configCache;
}

// save current cache to config file
// optionally update cache first
function saveConfig(newConfig = {}) {
    // update cache if new values given
    if (newConfig.targetChannelId !== undefined) {
        configCache.targetChannelId = newConfig.targetChannelId;
    }
    if (newConfig.spotifyRefreshToken !== undefined) {
        configCache.spotifyRefreshToken = newConfig.spotifyRefreshToken;
    }

    try {
        // make sure ./data/ dir exists
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            log.info(`Created data directory at ${dataDir}`);
        }
        fs.writeFileSync(configPath, JSON.stringify(configCache, null, 2));
        log.info(`Config saved to ${configPath}`);
    } catch (error) {
        log.error({ err: error }, 'Error saving config.json');
    }
}

// get the current cached config
function getConfig() {
    return configCache;
}

module.exports = {
    loadConfig,
    saveConfig,
    getConfig,
};
