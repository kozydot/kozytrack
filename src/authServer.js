const http = require('http');
const url = require('url');
const { getLogger } = require('./logger');
const { saveConfig, getConfig } = require('./config');

const log = getLogger('AuthServer'); // contextual logger

// simple http server to handle the spotify oauth callback

let server; // module-level server instance

function startCallbackServer(spotifyApiInstance) {
    // prevent multiple servers
    if (server && server.listening) {
        log.debug('Callback server is already running.');
        return;
    }
    log.info('Starting callback server...');

    server = http.createServer(async (req, res) => {
        const requestUrl = url.parse(req.url, true);
        const query = requestUrl.query;
        log.debug(`Received request: ${req.method} ${req.url}`);

        // check if it's the callback path with a code
        if (requestUrl.pathname === '/callback' && query.code) {
            log.info('Received Spotify authorization code. Exchanging for tokens...');
            try {
                // exchange the code for tokens
                const data = await spotifyApiInstance.authorizationCodeGrant(query.code);
                const accessToken = data.body['access_token'];
                const newRefreshToken = data.body['refresh_token'];

                log.info('Spotify authorization successful!');
                log.debug(`Access Token: ${accessToken.substring(0, 10)}...`);

                let currentConfig = getConfig();
                let configUpdate = { spotifyRefreshToken: currentConfig.spotifyRefreshToken }; // default to existing

                if (newRefreshToken) {
                    log.info('Received Refresh Token.');
                    configUpdate.spotifyRefreshToken = newRefreshToken;
                } else {
                     log.debug('Did not receive a new refresh token (this is normal if re-authorizing). Using previous one if available.');
                }

                // set tokens on the main api instance
                spotifyApiInstance.setAccessToken(accessToken);
                if (configUpdate.spotifyRefreshToken) {
                    spotifyApiInstance.setRefreshToken(configUpdate.spotifyRefreshToken);
                }

                // save the potentially new refresh token
                saveConfig(configUpdate);

                // respond to the browser
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('Authorization successful! You can close this window. The bot will now start updating your status.');
                log.info('Responded to browser.');

                // close this temporary server
                closeCallbackServer();

            } catch (error) {
                log.error({ err: error }, 'Error exchanging Spotify code for tokens');
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Error during Spotify authorization. Check bot console.');
                 closeCallbackServer(); // close server on error too
            }

        } else if (requestUrl.pathname === '/callback' && query.error) {
             // handle explicit errors from spotify redirect
             log.error(`Authorization error from Spotify redirect: ${query.error}`);
             res.writeHead(400, { 'Content-Type': 'text/plain' });
             res.end(`Spotify authorization failed: ${query.error}. Please try again or check bot console.`);
             closeCallbackServer();
        }
        else {
            // handle other requests (like favicon) or root path
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('KozyTrack callback server running. Waiting for Spotify redirect...');
        }
    }).listen(8888, '127.0.0.1', () => { // listen specifically on loopback
        log.info(`Callback server listening on http://127.0.0.1:8888/callback`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            log.error('Error: Port 8888 is already in use. Please ensure no other process is using it.');
        } else {
            log.error({ err: err }, 'Callback server error');
        }
         server = null; // ensure server isn't marked as listening on error
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
