const { getLogger } = require('./logger');
const { getSpotifyApiInstance, getCurrentTrack } = require('./spotify');
const { createSongEmbed, createNothingPlayingEmbed, createErrorEmbed } = require('./embeds');
const { updateDiscordMessage } = require('./discordHandler');
const { formatDuration } = require('./utils');

const log = getLogger('POLLING'); // logger for this module
const pollingInterval = 5000; // check spotify every 5s

let pollingIntervalId = null; // interval timer id
let isPollingActive = false; // is polling currently active?
let currentTrackId = null; // track last displayed song id to prevent spam

// check spotify, update discord if needed
async function performPollCheck(targetChannel, client) {
    const spotifyApi = getSpotifyApiInstance();
    if (!spotifyApi.getAccessToken()) {
        log.debug('Skipped: Spotify not authenticated.');
        stopPolling(); // stop if auth lost
        return;
    }
    if (!targetChannel) {
        log.debug('Skipped: Target channel not set.');
        stopPolling(); // stop if channel lost
        return;
    }

    // log.trace('checking spotify status...'); // uncomment for trace logs

    try {
        const playbackState = await getCurrentTrack(); // also handles token refresh

        if (playbackState && playbackState.is_playing && playbackState.item) {
            const track = playbackState.item;
            // only update if track changed
            if (track.id === currentTrackId) {
                // log.trace(`no change: still playing ${track.name}`); // uncomment for trace logs
                return; // no change, skip discord update
            }
            log.info(`Now Playing: ${track.name} by ${track.artists.map(a => a.name).join(', ')}`);
            currentTrackId = track.id;
            const currentTimeFormatted = formatDuration(playbackState.progress_ms);
            const totalTimeFormatted = formatDuration(track.duration_ms);
            const embed = await createSongEmbed(track, currentTimeFormatted, totalTimeFormatted); // now async (color extraction)
            // returns false on critical errors
            const success = await updateDiscordMessage(targetChannel, embed, client, 'Now Playing');
            if (!success) {
                log.warn('Critical error updating Discord message. Stopping polling.');
                stopPolling();
            }

        } else { // nothing playing, or playbackState.item is null/invalid
            if (currentTrackId !== null) { // only update if something *was* playing
                log.info('Playback stopped or paused.');
                currentTrackId = null; // clear last track id
                // returns false on critical errors
                const nothingPlayingPayload = { embeds: [createNothingPlayingEmbed().toJSON()] };
                const success = await updateDiscordMessage(targetChannel, nothingPlayingPayload, client, 'Playback Stopped');
                if (!success) {
                    log.warn('Critical error updating Discord message. Stopping polling.');
                    stopPolling();
                }
            } else { // still nothing playing
                // log.trace('no change: still not playing anything.'); // uncomment for trace logs
            }
        }
    } catch (error) {
        // most errors handled elsewhere
        log.error({ err: error }, 'Unhandled error during poll check cycle');
    }
}

// start polling if conditions met
async function startPollingIfNeeded(targetChannel, client) {
    const spotifyApi = getSpotifyApiInstance();
    if (spotifyApi && spotifyApi.getAccessToken() && targetChannel && !isPollingActive) {
        // note: cleanup now happens in updatediscordmessage
        log.info('Conditions met: starting spotify status polling.');
        if (pollingIntervalId) { // clear old interval just in case
            log.debug('Clearing existing interval id before starting new one.');
            clearInterval(pollingIntervalId);
        }
        // run initial check immediately
        log.debug('Running initial poll check...');
        await performPollCheck(targetChannel, client); // await first check

        // set interval only if initial check didn't stop polling
        // (e.g., due to a critical error like lost permissions)
        if (isPollingActive || !pollingIntervalId) { // check flag again as check might stop polling
             pollingIntervalId = setInterval(() => performPollCheck(targetChannel, client), pollingInterval);
             isPollingActive = true; // set flag now
             log.info(`Polling interval set (${pollingInterval / 1000}s). Interval ID: ${pollingIntervalId}.`);
        } else {
             log.warn("Polling was stopped during the initial check, so not setting the interval.");
        }

    } else {
        log.debug('Conditions not (yet) met for polling:', { hasToken: !!spotifyApi?.getAccessToken(), hasChannel: !!targetChannel, isPollingActive });
    }
}

// stop the interval timer
function stopPolling() {
    if (pollingIntervalId) {
        log.warn('Stopping Spotify status polling.');
        clearInterval(pollingIntervalId);
        pollingIntervalId = null;
        isPollingActive = false;
        currentTrackId = null; // reset track id so next play updates
    }
}

// check if polling is active
function isPolling() {
    return isPollingActive;
}

module.exports = {
    startPollingIfNeeded,
    stopPolling,
    isPolling,
};
