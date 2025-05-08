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
            const rawData = fs.readFileSync(configPath);
            const loadedConfig = JSON.parse(rawData);
            configCache.targetChannelId = loadedConfig.targetChannelId || null;
            configCache.spotifyRefreshToken = loadedConfig.spotifyRefreshToken || null;

            log.info('Loaded config file.');
            log.info(`Target Channel ID: ${configCache.targetChannelId ? configCache.targetChannelId : 'Not Set'}`);
            log.info(`Spotify Refresh Token: ${configCache.spotifyRefreshToken ? 'Set' : 'Not Set'}`);
        } else {
            log.warn('config.json not found, creating with defaults.');
            saveConfig(); // create file with null values if it doesn't exist
        }
    } catch (error) {
        log.error({ err: error }, 'Error loading config.json');
        // reset cache on error
        configCache.targetChannelId = null;
        configCache.spotifyRefreshToken = null;
    }
    return configCache; // return the loaded/default config
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
