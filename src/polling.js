const { getLogger } = require('./logger');
const { getSpotifyApiInstance, getCurrentTrack } = require('./spotify');
const { createSongEmbed, createNothingPlayingEmbed, createErrorEmbed } = require('./embeds');
const { updateDiscordMessage } = require('./discordHandler');
const { formatDuration } = require('./utils');

const log = getLogger('Polling'); // contextual logger
const pollingInterval = 5000; // how often to check spotify (in ms)

let pollingIntervalId = null; // stores the id from setInterval
let isPollingActive = false; // flag to indicate if polling is running
let currentTrackId = null; // track the id of the song currently displayed to avoid spamming updates for the same song

// performs a single check for spotify status and updates discord if needed
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

    // log.trace('checking spotify status...'); // uncomment for super verbose logging

    try {
        const playbackState = await getCurrentTrack(); // this also handles token refresh if needed

        if (playbackState && playbackState.is_playing && playbackState.item) {
            const track = playbackState.item;
            // only update if the track id is different from the last one we showed
            if (track.id === currentTrackId) {
                // log.trace(`no change: still playing ${track.name}`); // uncomment for verbose
                return; // no change, so no discord update needed
            }
            log.info(`Now Playing: ${track.name} by ${track.artists.map(a => a.name).join(', ')}`);
            currentTrackId = track.id;
            const currentTimeFormatted = formatDuration(playbackState.progress_ms);
            const totalTimeFormatted = formatDuration(track.duration_ms);
            const embed = await createSongEmbed(track, currentTimeFormatted, totalTimeFormatted); // async now due to color extraction
            // updateDiscordMessage returns false on critical errors (like missing permissions)
            const success = await updateDiscordMessage(targetChannel, embed, client, 'Now Playing');
            if (!success) {
                log.warn('Critical error updating Discord message. Stopping polling.');
                stopPolling();
            }

        } else { // nothing playing, or playbackState.item is null/invalid
            if (currentTrackId !== null) { // only send "nothing playing" if something *was* playing before
                log.info('Playback stopped or paused.');
                currentTrackId = null; // clear the current track id
                // updateDiscordMessage returns false on critical errors
                const nothingPlayingPayload = { embeds: [createNothingPlayingEmbed().toJSON()] };
                const success = await updateDiscordMessage(targetChannel, nothingPlayingPayload, client, 'Playback Stopped');
                if (!success) {
                    log.warn('Critical error updating Discord message. Stopping polling.');
                    stopPolling();
                }
            } else { // nothing was playing, and still nothing is playing
                // log.trace('no change: still not playing anything.'); // uncomment for verbose
            }
        }
    } catch (error) {
        // most errors during spotify fetch or discord update should be handled within those functions
        log.error({ err: error }, 'Unhandled error during poll check cycle');
    }
}

// starts the polling interval if spotify is authed and channel is set
async function startPollingIfNeeded(targetChannel, client) {
    const spotifyApi = getSpotifyApiInstance();
    if (spotifyApi && spotifyApi.getAccessToken() && targetChannel && !isPollingActive) {
        // note: old message cleanup is now handled within updateDiscordMessage on each update, not just at start
        log.info('Conditions met: starting spotify status polling.');
        if (pollingIntervalId) { // clear any existing interval just in case (shouldn't happen if logic is correct)
            log.debug('Clearing existing interval id before starting new one.');
            clearInterval(pollingIntervalId);
        }
        // run an initial check immediately so the user sees the status update quickly
        log.debug('Running initial poll check...');
        await performPollCheck(targetChannel, client); // make sure to await the first check

        // set interval for subsequent checks, but only if the first check didn't cause polling to stop
        // (e.g., due to a critical error like lost permissions)
        if (isPollingActive || !pollingIntervalId) { // check isPollingActive as performPollCheck might call stopPolling
             pollingIntervalId = setInterval(() => performPollCheck(targetChannel, client), pollingInterval);
             isPollingActive = true; // set flag after interval is successfully created
             log.info(`Polling interval set (${pollingInterval / 1000}s). Interval ID: ${pollingIntervalId}.`);
        } else {
             log.warn("Polling was stopped during the initial check, so not setting the interval.");
        }

    } else {
        log.debug('Conditions not (yet) met for polling:', { hasToken: !!spotifyApi?.getAccessToken(), hasChannel: !!targetChannel, isPollingActive });
    }
}

// stops the polling interval
function stopPolling() {
    if (pollingIntervalId) {
        log.warn('Stopping Spotify status polling.');
        clearInterval(pollingIntervalId);
        pollingIntervalId = null;
        isPollingActive = false;
        currentTrackId = null; // reset track id when polling stops so next "now playing" is fresh
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
