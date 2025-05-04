const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const configPath = path.join(__dirname, '..', 'config.json'); // path to config file

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

            console.log(chalk.blue('[CONFIG] Loaded config file.'));
            console.log(chalk.blue(`  - Target Channel ID:`), configCache.targetChannelId ? chalk.green(configCache.targetChannelId) : chalk.yellow('Not Set'));
            console.log(chalk.blue(`  - Spotify Refresh Token:`), configCache.spotifyRefreshToken ? chalk.green('Set') : chalk.yellow('Not Set'));
        } else {
            console.log(chalk.yellow('[CONFIG] config.json not found, creating with defaults.'));
            saveConfig(); // create file with null values if it doesn't exist
        }
    } catch (error) {
        console.error(chalk.red('[CONFIG] Error loading config.json:'), error);
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
        fs.writeFileSync(configPath, JSON.stringify(configCache, null, 2));
        console.log(chalk.blue('[CONFIG] Config saved.'));
    } catch (error) {
        console.error(chalk.red('[CONFIG] Error saving config.json:'), error);
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
