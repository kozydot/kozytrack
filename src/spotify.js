const SpotifyWebApi = require('spotify-web-api-node');
const { getLogger } = require('./logger');
const { getConfig, saveConfig } = require('./config');
const { startCallbackServer } = require('./authServer'); // needed to start auth flow

const log = getLogger('Spotify'); // contextual logger
const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const spotifyRedirectUri = 'http://127.0.0.1:8888/callback';
const spotifyScopes = ['user-read-currently-playing', 'user-read-playback-state'];

// basic check for required env vars
if (!spotifyClientId || !spotifyClientSecret) {
    log.fatal("[SETUP] Error: SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET not found in .env file.");
    process.exit(1);
}

// initialize the spotify api wrapper
const spotifyApi = new SpotifyWebApi({
    clientId: spotifyClientId,
    clientSecret: spotifyClientSecret,
    redirectUri: spotifyRedirectUri,
});

// simple getter for the api instance
function getSpotifyApiInstance() {
    return spotifyApi;
}

// handles initial auth check and token refresh on startup
async function initializeSpotify() {
    let { spotifyRefreshToken } = getConfig();

    if (spotifyRefreshToken) {
        log.info('Found refresh token. Attempting to refresh access token...');
        spotifyApi.setRefreshToken(spotifyRefreshToken);
        try {
            const data = await spotifyApi.refreshAccessToken();
            spotifyApi.setAccessToken(data.body['access_token']);
            log.info('Access token refreshed successfully.');

            // spotify might give us a new refresh token
            if (data.body['refresh_token']) {
                log.info('Received a new refresh token.');
                saveConfig({ spotifyRefreshToken: data.body['refresh_token'] });
            }
            return true; // success
        } catch (error) {
            log.error({ err: error }, 'Could not refresh Spotify access token');
            log.warn('Refresh token might be invalid. Please re-authorize.');
            saveConfig({ spotifyRefreshToken: null }); // clear invalid token
            requestSpotifyAuthorization(); // ask user to re-auth
            return false; // needs auth
        }
    } else {
        log.warn('No Spotify refresh token found.');
        requestSpotifyAuthorization();
        return false; // needs auth
    }
}

// logs the authorization url and starts the callback server
function requestSpotifyAuthorization() {
    const authorizeURL = spotifyApi.createAuthorizeURL(spotifyScopes, 'kozytrack-state');
    log.warn('\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    log.warn('!!! SPOTIFY AUTHORIZATION NEEDED !!!');
    log.warn('!!! Please visit this URL in your browser to authorize the bot:');
    log.warn(`!!! ${authorizeURL}`);
    log.warn('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');
    startCallbackServer(spotifyApi); // start server and pass api instance
}

// fetches the currently playing track, handles token refresh if needed during fetch
async function getCurrentTrack() {
    if (!spotifyApi.getAccessToken()) {
        log.debug('Cannot get track: Not authenticated.');
        return null;
    }
    try {
        const data = await spotifyApi.getMyCurrentPlayingTrack();
        if (data.body && data.body.item) {
            return data.body; // return full playback state object
        }
        return null; // nothing playing or item is null
    } catch (error) {
         log.error({ err: error }, 'Error fetching current track');
         // handle token expiration during fetch
         if (error.statusCode === 401) {
             log.warn('Token expired during track fetch. Attempting refresh...');
             try {
                 const refreshData = await spotifyApi.refreshAccessToken();
                 spotifyApi.setAccessToken(refreshData.body['access_token']);
                 log.info('Access token refreshed successfully during track fetch.');
                 if (refreshData.body['refresh_token']) {
                     log.info('Received a new refresh token during track fetch.');
                     saveConfig({ spotifyRefreshToken: refreshData.body['refresh_token'] });
                 }
                 // retry fetching track immediately
                 log.debug('Retrying track fetch after token refresh.');
                 const retryData = await spotifyApi.getMyCurrentPlayingTrack();
                 return retryData.body;
             } catch (refreshError) {
                 log.error({ err: refreshError }, 'Could not refresh Spotify access token during track fetch');
                 // stop polling? handled in polling.js now
                 return null; // failed to refresh
             }
         }
         return null; // other error
    }
}


module.exports = {
    initializeSpotify,
    getSpotifyApiInstance,
    getCurrentTrack,
};
