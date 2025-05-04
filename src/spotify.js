const SpotifyWebApi = require('spotify-web-api-node');
const chalk = require('chalk');
const { getConfig, saveConfig } = require('./config');
const { startCallbackServer } = require('./authServer'); // needed to start auth flow

const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const spotifyRedirectUri = 'http://127.0.0.1:8888/callback';
const spotifyScopes = ['user-read-currently-playing', 'user-read-playback-state'];

// basic check for required env vars
if (!spotifyClientId || !spotifyClientSecret) {
    console.error(chalk.red("[SETUP] Error: SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET not found in .env file."));
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
        console.log(chalk.cyan('[SPOTIFY] Found refresh token. Attempting to refresh access token...'));
        spotifyApi.setRefreshToken(spotifyRefreshToken);
        try {
            const data = await spotifyApi.refreshAccessToken();
            spotifyApi.setAccessToken(data.body['access_token']);
            console.log(chalk.green('[SPOTIFY] Access token refreshed successfully.'));

            // spotify might give us a new refresh token
            if (data.body['refresh_token']) {
                console.log(chalk.cyan('[SPOTIFY] Received a new refresh token.'));
                saveConfig({ spotifyRefreshToken: data.body['refresh_token'] });
            }
            return true; // success
        } catch (error) {
            console.error(chalk.red('[SPOTIFY] Could not refresh Spotify access token:'), error.message);
            console.log(chalk.yellow('[SPOTIFY] Refresh token might be invalid. Please re-authorize.'));
            saveConfig({ spotifyRefreshToken: null }); // clear invalid token
            requestSpotifyAuthorization(); // ask user to re-auth
            return false; // needs auth
        }
    } else {
        console.log(chalk.yellow('[SPOTIFY] No Spotify refresh token found.'));
        requestSpotifyAuthorization();
        return false; // needs auth
    }
}

// logs the authorization url and starts the callback server
function requestSpotifyAuthorization() {
    const authorizeURL = spotifyApi.createAuthorizeURL(spotifyScopes, 'kozytrack-state'); // Use new name in state
    console.log(chalk.yellow('\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'));
    console.log(chalk.yellow.bold('!!! SPOTIFY AUTHORIZATION NEEDED !!!'));
    console.log(chalk.yellow('!!! Please visit this URL in your browser to authorize the bot:'));
    console.log(chalk.cyan.underline(`!!! ${authorizeURL}`));
    console.log(chalk.yellow('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n'));
    startCallbackServer(spotifyApi); // start server and pass api instance
}

// fetches the currently playing track, handles token refresh if needed during fetch
async function getCurrentTrack() {
    if (!spotifyApi.getAccessToken()) {
        console.log(chalk.dim('[SPOTIFY] Cannot get track: Not authenticated.'));
        return null;
    }
    try {
        const data = await spotifyApi.getMyCurrentPlayingTrack();
        if (data.body && data.body.item) {
            return data.body; // return full playback state object
        }
        return null; // nothing playing or item is null
    } catch (error) {
         console.error(chalk.red('[SPOTIFY] Error fetching current track:'), error.message || error);
         // handle token expiration during fetch
         if (error.statusCode === 401) {
             console.log(chalk.yellow('[SPOTIFY] Token expired during track fetch. Attempting refresh...'));
             try {
                 const refreshData = await spotifyApi.refreshAccessToken();
                 spotifyApi.setAccessToken(refreshData.body['access_token']);
                 console.log(chalk.green('[SPOTIFY] Access token refreshed successfully during track fetch.'));
                 if (refreshData.body['refresh_token']) {
                     console.log(chalk.cyan('[SPOTIFY] Received a new refresh token during track fetch.'));
                     saveConfig({ spotifyRefreshToken: refreshData.body['refresh_token'] });
                 }
                 // retry fetching track immediately
                 console.log(chalk.dim('[SPOTIFY] Retrying track fetch after token refresh.'));
                 const retryData = await spotifyApi.getMyCurrentPlayingTrack();
                 return retryData.body;
             } catch (refreshError) {
                 console.error(chalk.red('[SPOTIFY] Could not refresh Spotify access token during track fetch:'), refreshError.message);
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
