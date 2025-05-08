const fs = require('fs');
const path = require('path');
const { getLogger } = require('./logger'); // use pino logger

const log = getLogger('Config'); // create contextual logger
const dataDir = path.join(__dirname, '..', 'data'); // path to data directory
const configPath = path.join(dataDir, 'config.json'); // path to config file

// holds the latest config in memory
let configCache = {
    targetChannelId: null,
    spotifyRefreshToken: null,
};

// loads config from config.json into memory cache
function loadConfig() {
    try {
        if (fs.existsSync(configPath)) {
            log.debug(`Found config file at: ${configPath}`);
            let rawData = '';
            try {
                rawData = fs.readFileSync(configPath, 'utf8'); // Read as utf8 string
            } catch (readError) {
                 log.error({ err: readError }, `Failed to read existing config file at ${configPath}. Treating as missing.`);
                 // Reset cache and proceed to create default
                 configCache.targetChannelId = null;
                 configCache.spotifyRefreshToken = null;
                 saveConfig(); // Attempt to create a default file
                 return configCache;
            }

            if (!rawData || rawData.trim().length === 0) {
                log.warn(`Config file at ${configPath} is empty. Treating as missing and creating defaults.`);
                // Reset cache and proceed to create default
                configCache.targetChannelId = null;
                configCache.spotifyRefreshToken = null;
                saveConfig(); // Attempt to create a default file
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
                    // Reset cache and proceed to create default
                    configCache.targetChannelId = null;
                    configCache.spotifyRefreshToken = null;
                    saveConfig(); // Attempt to create a default file (overwriting potentially corrupt one)
                }
            }
        } else {
            log.warn(`Config file not found at ${configPath}, creating with defaults.`);
            saveConfig(); // create file with null values if it doesn't exist
        }
    } catch (error) {
        // Catch any other unexpected errors during the process
        log.error({ err: error }, `Unexpected error during config load process for ${configPath}. Resetting config cache.`);
        configCache.targetChannelId = null;
        configCache.spotifyRefreshToken = null;
    }
    return configCache;
}

// saves current config cache to config.json
// optionally updates cache with new values before saving
function saveConfig(newConfig = {}) {
    // update cache with any new values provided
    if (newConfig.targetChannelId !== undefined) {
        configCache.targetChannelId = newConfig.targetChannelId;
    }
    if (newConfig.spotifyRefreshToken !== undefined) {
        configCache.spotifyRefreshToken = newConfig.spotifyRefreshToken;
    }

    try {
        // Ensure the data directory exists
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

// returns the current cached config
function getConfig() {
    return configCache;
}

module.exports = {
    loadConfig,
    saveConfig,
    getConfig,
};
