const http = require('http');
const url = require('url');
const { getLogger } = require('./logger');
const { saveConfig, getConfig } = require('./config');

const log = getLogger('AUTHSVR'); // logger for this module

// handles the spotify oauth callback

let server; // keep track of the server instance

function startCallbackServer(spotifyApiInstance) {
    // don't start if already running
    if (server && server.listening) {
        log.debug('Callback server is already running.');
        return;
    }
    log.info('Starting callback server...');

    server = http.createServer(async (req, res) => {
        const requestUrl = url.parse(req.url, true);
        const query = requestUrl.query;
        log.debug(`Received request: ${req.method} ${req.url}`);

        // spotify redirect should hit this path with a code
        if (requestUrl.pathname === '/callback' && query.code) {
            log.info('Received Spotify authorization code. Exchanging for tokens...');
            try {
                // swap the code for access/refresh tokens
                const data = await spotifyApiInstance.authorizationCodeGrant(query.code);
                const accessToken = data.body['access_token'];
                const newRefreshToken = data.body['refresh_token'];

                log.info('Spotify authorization successful!');
                log.debug(`Access Token: ${accessToken.substring(0, 10)}...`);

                let currentConfig = getConfig();
                let configUpdate = { spotifyRefreshToken: currentConfig.spotifyRefreshToken }; // start with current refresh token (if any)

                if (newRefreshToken) {
                    log.info('Received Refresh Token.');
                    configUpdate.spotifyRefreshToken = newRefreshToken;
                } else {
                     log.debug('Did not receive a new refresh token (this is normal if re-authorizing). Using previous one if available.');
                }

                // update the main spotify api instance
                spotifyApiInstance.setAccessToken(accessToken);
                if (configUpdate.spotifyRefreshToken) {
                    spotifyApiInstance.setRefreshToken(configUpdate.spotifyRefreshToken);
                }

                // save the new refresh token (if we got one)
                saveConfig(configUpdate);

                // tell the user's browser it worked
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('Authorization successful! You can close this window. The bot will now start updating your status.');
                log.info('Responded to browser.');

                // we're done, close the callback server
                closeCallbackServer();

            } catch (error) {
                log.error({ err: error }, 'Error exchanging Spotify code for tokens');
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Error during Spotify authorization. Check bot console.');
                 closeCallbackServer(); // close server on error too
            }

        } else if (requestUrl.pathname === '/callback' && query.error) {
             // spotify returned an error param
             log.error(`Authorization error from Spotify redirect: ${query.error}`);
             res.writeHead(400, { 'Content-Type': 'text/plain' });
             res.end(`Spotify authorization failed: ${query.error}. Please try again or check bot console.`);
             closeCallbackServer();
        }
        else {
            // ignore other requests (e.g. favicon.ico)
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('KozyTrack callback server running. Waiting for Spotify redirect...');
        }
    }).listen(process.env.PORT || 8888, '0.0.0.0', () => {
        const port = process.env.PORT || 8888;
        log.info(`Callback server listening on host 0.0.0.0, port ${port}. Waiting for /callback`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            log.error('Error: Port 8888 is already in use. Please ensure no other process is using it.');
        } else {
            log.error({ err: err }, 'Callback server error');
        }
         server = null; // clear server state on error
    });
}

function closeCallbackServer() {
     if (server && server.listening) {
        server.close(() => {
            log.info('Callback server closed.');
            server = null; // clear server instance
        });
    }
}

module.exports = {
    startCallbackServer,
    closeCallbackServer,
};
