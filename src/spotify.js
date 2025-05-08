const SpotifyWebApi = require('spotify-web-api-node');
const { getLogger } = require('./logger');
const { getConfig, saveConfig } = require('./config');
const { startCallbackServer } = require('./authServer'); // needed to start callback server

const log = getLogger('SPOTIFY'); // logger for this module
const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const spotifyRedirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:8888/callback';
const spotifyScopes = ['user-read-currently-playing', 'user-read-playback-state'];

// check for required spotify creds
if (!spotifyClientId || !spotifyClientSecret) {
    log.fatal("[SETUP] Error: SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET not found in .env file.");
    process.exit(1);
}

// init the spotify api wrapper
const spotifyApi = new SpotifyWebApi({
    clientId: spotifyClientId,
    clientSecret: spotifyClientSecret,
    redirectUri: spotifyRedirectUri,
});

// get the api instance
function getSpotifyApiInstance() {
    return spotifyApi;
}

// check auth, refresh token if needed
async function initializeSpotify() {
    let { spotifyRefreshToken } = getConfig();

    if (spotifyRefreshToken) {
        log.info('Found refresh token. Attempting to refresh access token...');
        spotifyApi.setRefreshToken(spotifyRefreshToken);
        try {
            const data = await spotifyApi.refreshAccessToken();
            spotifyApi.setAccessToken(data.body['access_token']);
            log.info('Access token refreshed successfully.');

            // spotify might give a new refresh token
            if (data.body['refresh_token']) {
                log.info('Received a new refresh token.');
                saveConfig({ spotifyRefreshToken: data.body['refresh_token'] });
            }
            return true; // ok
        } catch (error) {
            log.error({ err: error }, 'Could not refresh Spotify access token');
            log.warn('Refresh token might be invalid. Please re-authorize.');
            saveConfig({ spotifyRefreshToken: null }); // clear invalid token
            requestSpotifyAuthorization(); // ask for re-auth
            return false; // needs auth
        }
    } else {
        log.warn('No Spotify refresh token found.');
        requestSpotifyAuthorization(); // ask for auth
        return false; // needs auth
    }
}

// log auth url, start callback server
function requestSpotifyAuthorization() {
    const authorizeURL = spotifyApi.createAuthorizeURL(spotifyScopes, 'kozytrack-state');
    log.warn('\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    log.warn('!!! SPOTIFY AUTHORIZATION NEEDED !!!');
    log.warn('!!! Please visit this URL in your browser to authorize the bot:');
    log.warn(`!!! ${authorizeURL}`);
    log.warn('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');
    startCallbackServer(spotifyApi); // start server, pass api instance
}

// get current track (handles token refresh)
async function getCurrentTrack() {
    if (!spotifyApi.getAccessToken()) {
        log.debug('Cannot get track: Not authenticated.');
        return null;
    }
    try {
        const data = await spotifyApi.getMyCurrentPlayingTrack();
        if (data.body && data.body.item) {
            return data.body; // return full playback state
        }
        return null; // nothing playing (or ad)
    } catch (error) {
         // log 401s as warn (we try to refresh), others as error
         if (error.statusCode === 401) {
            log.warn({ err: error }, 'Error fetching current track (token expired, attempting refresh)');
         } else {
            log.error({ err: error }, 'Error fetching current track');
         }
         // handle token expiry (401)
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
                 // retry fetch now
                 log.debug('Retrying track fetch after token refresh.');
                 const retryData = await spotifyApi.getMyCurrentPlayingTrack();
                 // log success on retry
                 log.info('Successfully fetched track after token refresh and retry.');
                 return retryData.body;
             } catch (refreshError) {
                 log.error({ err: refreshError }, 'Could not refresh token or fetch track after retry');
                 // polling will stop if refresh fails
                 return null; // failed refresh
             }
         }
         return null; // other fetch error
    }
}


module.exports = {
    initializeSpotify,
    getSpotifyApiInstance,
    getCurrentTrack,
};
