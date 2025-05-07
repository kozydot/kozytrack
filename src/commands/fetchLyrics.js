const { getLogger } = require('../logger');
const { getLyrics } = require('genius-lyrics-api');
const { getSpotifyApiInstance, getCurrentTrack } = require('../spotify'); // spotify utils
const { createLyricsEmbed } = require('../embeds'); // embed creation

const log = getLogger('Cmd:FetchLyrics'); // contextual logger

// handles the /fetchlyrics command
async function handleFetchLyrics(interaction, trackId = null) {
    if (trackId) {
        log.info(`Processing lyrics button for track ID ${trackId} by ${interaction.user.tag}`);
    } else {
        log.info(`Processing /fetchlyrics command by ${interaction.user.tag}`);
    }
    await interaction.deferReply(); // needs deferral as lyrics fetching can take time

    const spotifyApi = getSpotifyApiInstance();
    // check if spotify is connected
    if (!spotifyApi || !spotifyApi.getAccessToken()) {
        log.warn('Failed: Spotify not authenticated.');
        await interaction.editReply({ content: 'Spotify is not connected. Please ensure the bot owner has authorized Spotify.' });
        return;
    }

    try {
        let track;
        if (trackId) {
            const trackData = await spotifyApi.getTrack(trackId);
            if (!trackData || !trackData.body) {
                log.warn(`Failed: Could not fetch track details for ID ${trackId}.`);
                await interaction.editReply({ content: 'Could not fetch track details for the specified song.' });
                return;
            }
            track = trackData.body;
        } else {
            // get current track data (includes internal token refresh logic)
            const playbackState = await getCurrentTrack();

            if (!playbackState || !playbackState.is_playing || !playbackState.item) {
                log.warn('Failed: No track currently playing (for slash command).');
                await interaction.editReply({ content: 'You are not currently playing any track on Spotify.' });
                return;
            }
            track = playbackState.item;
        }

        if (!track) { // General check if track object is missing
            log.error('Failed: Track object is undefined after attempting to fetch/get current.');
            await interaction.editReply({ content: 'Could not retrieve track information.' });
            return;
        }
        const artist = track.artists[0]?.name; // use first artist
        const title = track.name;

        if (!artist || !title) {
             log.warn('Failed: Could not extract artist/title from current track.');
             await interaction.editReply({ content: 'Could not get track details from Spotify.' });
             return;
        }

        // check for genius token
        const geniusApiKey = process.env.GENIUS_API_TOKEN;
        if (!geniusApiKey) {
             log.error('Failed: GENIUS_API_TOKEN not found in .env file.');
             await interaction.editReply({ content: 'Genius API token is missing in the bot configuration.' });
             return;
        }

        log.debug(`Searching Genius lyrics for "${title}" by "${artist}"...`);

        // options for genius-lyrics-api
        const options = {
            apiKey: geniusApiKey,
            title: title,
            artist: artist,
            optimizeQuery: true // helps find matches
        };

        // fetch lyrics
        let lyrics = await getLyrics(options);

        if (!lyrics) {
            log.warn(`Genius lyrics not found for "${title}" by "${artist}".`);
            await interaction.editReply({ content: `Sorry, couldn't find lyrics for **${title}** by **${artist}**.` });
            return;
        }

        log.info(`Found lyrics for "${title}" by "${artist}".`);

        // clean up common genius artifacts
        let cleanedLyrics = lyrics.trim();

        // (New) Attempt to find the start of actual lyrics by looking for common headers
        // and discard any preamble text before the first header.
        const commonHeadersRegex = /\[(Verse|Chorus|Intro|Outro|Bridge|Hook|Part|Segment|Pre-Chorus|Post-Chorus|Instrumental|Speaker|Skit|Interlude|Refrain|Section|Verse \d+|Chorus \d+|Intro \d+|Outro \d+)/i;
        const firstHeaderIndex = cleanedLyrics.search(commonHeadersRegex);

        if (firstHeaderIndex > 0) { // If a header is found, and it's not at the very beginning (implying some preamble)
            log.debug(`Found first lyrics header at index ${firstHeaderIndex}. Trimming preamble.`);
            cleanedLyrics = cleanedLyrics.substring(firstHeaderIndex);
        } else if (firstHeaderIndex === -1) {
            // No common headers found, log this, existing cleanup might still help
            log.debug('No common lyrics headers found, proceeding with other cleanup methods.');
        }
        // else if firstHeaderIndex is 0, it means lyrics start with a header, no preamble to trim based on this logic.

        // remove bracketed headers like [Verse 1], [Chorus], etc. (this will also clean the first header if kept by above logic)
        cleanedLyrics = cleanedLyrics.replace(/\[.*?\](\r?\n)?/g, ''); // Made \r?\n optional to remove headers on same line too
         // attempt to remove potential first-line metadata like "NN Contributors..."
        const lines = cleanedLyrics.split('\n');
        if (lines.length > 0 && (lines[0].includes('Contributors') || lines[0].toLowerCase().includes(title.toLowerCase()+' lyrics') || lines[0].match(/^\d+.*Lyrics$/))) {
            log.debug(`Removing potential metadata line: "${lines[0]}"`);
            lines.shift();
            cleanedLyrics = lines.join('\n').trim();
        }
        // consolidate multiple blank lines
        cleanedLyrics = cleanedLyrics.replace(/(\r?\n){2,}/g, '\n\n'); // Changed from 3+ to 2+ for better consolidation
        cleanedLyrics = cleanedLyrics.trim(); // Ensure no leading/trailing whitespace after all cleanup

        // prepare embed
        const maxDescLength = 4000; // discord embed description limit
        let truncated = false;
        if (cleanedLyrics.length > maxDescLength) {
            cleanedLyrics = cleanedLyrics.substring(0, maxDescLength) + "...";
            truncated = true;
        }

        const albumArtUrl = track.album.images.length > 0 ? track.album.images[0].url : null;
        const embed = createLyricsEmbed(title, artist, cleanedLyrics, track.external_urls.spotify, albumArtUrl, truncated);

        // send the lyrics embed
        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        log.error({ err: error }, 'Error during /fetchlyrics');
        // try to send an error message back to the user
        try {
            // Check if we can still edit the reply (if deferral succeeded)
             if (interaction.deferred || interaction.replied) {
                 await interaction.editReply({ content: 'An error occurred while fetching lyrics. Please try again later.' });
             } else {
                 // If deferral failed or something else went wrong, try a new reply
                 await interaction.reply({ content: 'An error occurred while fetching lyrics.', ephemeral: true });
             }
        } catch (replyError) {
             log.error({ err: replyError }, "Failed to send error reply to interaction");
        }
    }
}

module.exports = {
    handleFetchLyrics,
};
