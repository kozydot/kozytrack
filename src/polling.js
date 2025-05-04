const { getLogger } = require('./logger');
const { getSpotifyApiInstance, getCurrentTrack } = require('./spotify');
const { createSongEmbed, createNothingPlayingEmbed, createErrorEmbed } = require('./embeds');
const { updateDiscordMessage } = require('./discordHandler');

const log = getLogger('Polling'); // contextual logger
const pollingInterval = 5000; // check spotify every 5 seconds

let pollingIntervalId = null;
let isPollingActive = false;
let currentTrackId = null; // track the id of the song currently displayed

// performs a single check for spotify status and updates discord
async function performPollCheck(targetChannel, client) {
    const spotifyApi = getSpotifyApiInstance();
    if (!spotifyApi.getAccessToken()) {
        log.debug('Skipped: Spotify not authenticated.');
        stopPolling(); // stop polling if auth is lost
        return;
    }
    if (!targetChannel) {
        log.debug('Skipped: Target channel not set.');
        stopPolling(); // stop polling if channel is lost
        return;
    }

    // log.trace('Checking Spotify status...'); // use trace for very frequent logs

    try {
        const playbackState = await getCurrentTrack(); // fetches track and handles token refresh internally

        if (playbackState && playbackState.is_playing && playbackState.item) {
            const track = playbackState.item;
            // only update if the track id is different
            if (track.id === currentTrackId) {
                // log.trace(`No change: Still playing ${track.name}`);
                return; // no change needed
            }
            log.info(`Now Playing: ${track.name} by ${track.artists.map(a => a.name).join(', ')}`);
            currentTrackId = track.id;
            const embed = createSongEmbed(track);
            // check return value to see if update failed critically (e.g., permissions)
            const success = await updateDiscordMessage(targetChannel, embed, client, 'Now Playing');
            if (!success) {
                log.warn('Critical error updating Discord message. Stopping polling.');
                stopPolling();
            }

        } else { // nothing playing or item is null/invalid
            if (currentTrackId !== null) { // only update if something *was* playing before
                log.info('Playback stopped or paused.');
                currentTrackId = null;
                 // check return value to see if update failed critically (e.g., permissions)
                const success = await updateDiscordMessage(targetChannel, createNothingPlayingEmbed(), client, 'Playback Stopped');
                if (!success) {
                    log.warn('Critical error updating Discord message. Stopping polling.');
                    stopPolling();
                }
            } else {
                // log.trace('No change: Still not playing anything.');
            }
        }
    } catch (error) {
        // errors during spotify fetch or discord update should be handled in their respective functions
        log.error({ err: error }, 'Unhandled error during poll check cycle');
    }
}

// starts the polling interval if spotify is authed and channel is set
async function startPollingIfNeeded(targetChannel, client) {
    const spotifyApi = getSpotifyApiInstance();
    if (spotifyApi && spotifyApi.getAccessToken() && targetChannel && !isPollingActive) {
        // cleanup is now handled within updateDiscordMessage on each update
        log.info('Conditions met: Starting Spotify status polling.');
        if (pollingIntervalId) { // clear any existing interval just in case
            log.debug('Clearing existing interval ID.');
            clearInterval(pollingIntervalId);
        }
        // run initial check immediately
        log.debug('Running initial check.');
        await performPollCheck(targetChannel, client); // await the first check

        // set interval for subsequent checks only if the first check didn't stop polling
        // check isPollingActive as performPollCheck might call stopPolling
        if (isPollingActive || !pollingIntervalId) {
             pollingIntervalId = setInterval(() => performPollCheck(targetChannel, client), pollingInterval);
             isPollingActive = true;
             log.info(`Interval set (${pollingInterval / 1000}s) with ID ${pollingIntervalId}.`);
        } else {
             log.warn("Polling stopped during initial check, not setting interval.");
        }

    } else {
        log.debug('Conditions not met for polling:', { hasToken: !!spotifyApi?.getAccessToken(), hasChannel: !!targetChannel, isPolling: isPollingActive });
    }
}

// stops the polling interval
function stopPolling() {
    if (pollingIntervalId) {
        log.warn('Stopping Spotify status polling.');
        clearInterval(pollingIntervalId);
        pollingIntervalId = null;
        isPollingActive = false;
        currentTrackId = null; // reset track id when polling stops
    }
}

// returns current polling state
function isPolling() {
    return isPollingActive;
}

module.exports = {
    startPollingIfNeeded,
    stopPolling,
    isPolling,
};
