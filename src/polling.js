const chalk = require('chalk');
const { getSpotifyApiInstance, getCurrentTrack } = require('./spotify');
const { createSongEmbed, createNothingPlayingEmbed, createErrorEmbed } = require('./embeds');
const { updateDiscordMessage } = require('./discordHandler');

const pollingInterval = 5000; // check spotify every 5 seconds

let pollingIntervalId = null;
let isPollingActive = false;
let currentTrackId = null; // track the id of the song currently displayed

// performs a single check for spotify status and updates discord
async function performPollCheck(targetChannel, client) {
    const spotifyApi = getSpotifyApiInstance();
    if (!spotifyApi.getAccessToken()) {
        console.log(chalk.dim('[POLL] Skipped: Spotify not authenticated.'));
        stopPolling(); // stop polling if auth is lost
        return;
    }
    if (!targetChannel) {
        console.log(chalk.dim('[POLL] Skipped: Target channel not set.'));
        stopPolling(); // stop polling if channel is lost
        return;
    }

    try {
        const playbackState = await getCurrentTrack(); // fetches track and handles token refresh internally

        if (playbackState && playbackState.is_playing && playbackState.item) {
            const track = playbackState.item;
            // only update if the track id is different
            if (track.id === currentTrackId) {
                return; // no change needed
            }
            console.log(chalk.cyan(`[SPOTIFY] Now Playing: ${chalk.bold(track.name)} by ${track.artists.map(a => a.name).join(', ')}`));
            currentTrackId = track.id;
            const embed = createSongEmbed(track);
            // check return value to see if update failed critically (e.g., permissions)
            const success = await updateDiscordMessage(targetChannel, embed, client, 'Now Playing');
            if (!success) {
                console.log(chalk.yellow('[POLL] Critical error updating Discord message. Stopping polling.'));
                stopPolling();
            }

        } else { // nothing playing or item is null/invalid
            if (currentTrackId !== null) { // only update if something *was* playing before
                console.log(chalk.cyan('[SPOTIFY] Playback stopped or paused.'));
                currentTrackId = null;
                 // check return value to see if update failed critically (e.g., permissions)
                const success = await updateDiscordMessage(targetChannel, createNothingPlayingEmbed(), client, 'Playback Stopped');
                if (!success) {
                    console.log(chalk.yellow('[POLL] Critical error updating Discord message. Stopping polling.'));
                    stopPolling();
                }
            }
        }
    } catch (error) {
        // errors during spotify fetch or discord update are handled in their respective functions
        // log any other unexpected errors here
        console.error(chalk.red('[POLL] Unhandled error during poll check cycle:'), error);
    }
}

// starts the polling interval if spotify is authed and channel is set
async function startPollingIfNeeded(targetChannel, client) {
    const spotifyApi = getSpotifyApiInstance();
    if (spotifyApi && spotifyApi.getAccessToken() && targetChannel && !isPollingActive) {
        // cleanup is now handled within updateDiscordMessage on each update
        console.log(chalk.green('[POLL] Conditions met: Starting Spotify status polling.'));
        if (pollingIntervalId) { // clear any existing interval just in case
            console.log(chalk.dim('[POLL] Clearing existing interval ID.'));
            clearInterval(pollingIntervalId);
        }
        // run initial check immediately
        console.log(chalk.dim(`[POLL] Running initial check.`));
        await performPollCheck(targetChannel, client); // await the first check

        // set interval for subsequent checks only if the first check didn't stop polling
        if (isPollingActive || !pollingIntervalId) { // check if polling wasn't stopped by the initial check
             pollingIntervalId = setInterval(() => performPollCheck(targetChannel, client), pollingInterval);
             isPollingActive = true;
             console.log(chalk.dim(`[POLL] Interval set (${pollingInterval / 1000}s) with ID ${pollingIntervalId}.`));
        }

    } else {
        console.log(chalk.dim('[POLL] Conditions not met for polling:', { hasToken: !!spotifyApi?.getAccessToken(), hasChannel: !!targetChannel, isPolling: isPollingActive }));
    }
}

// stops the polling interval
function stopPolling() {
    if (pollingIntervalId) {
        console.log(chalk.yellow('[POLL] Stopping Spotify status polling.'));
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
