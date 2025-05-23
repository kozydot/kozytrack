const { getLogger } = require('../logger');
const { getLyrics } = require('genius-lyrics-api');
const { getSpotifyApiInstance, getCurrentTrack } = require('../spotify'); // spotify helpers
const { createLyricsEmbed } = require('../embeds'); // embed helper

const log = getLogger('CMD:FETCHLYRICS'); // logger for this command

// handle /fetchlyrics or button click
async function handleFetchLyrics(interaction, trackId = null) {
    if (trackId) {
        log.info(`Processing lyrics button for track ID ${trackId} by ${interaction.user.tag}`);
    } else {
        log.info(`Processing /fetchlyrics command by ${interaction.user.tag}`);
    }
    await interaction.deferReply(); // defer reply (lyrics fetch can be slow)

    const spotifyApi = getSpotifyApiInstance();
    // check spotify auth
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
            // get current track (handles refresh)
            const playbackState = await getCurrentTrack();

            if (!playbackState || !playbackState.is_playing || !playbackState.item) {
                log.warn('Failed: No track currently playing (for slash command).');
                await interaction.editReply({ content: 'You are not currently playing any track on Spotify.' });
                return;
            }
            track = playbackState.item;
        }

        if (!track) { // check track obj exists
            log.error('Failed: Track object is undefined after attempting to fetch/get current.');
            await interaction.editReply({ content: 'Could not retrieve track information.' });
            return;
        }
        const artist = track.artists[0]?.name; // use first artist for search
        const title = track.name;

        if (!artist || !title) {
             log.warn('Failed: Could not extract artist/title from current track.');
             await interaction.editReply({ content: 'Could not get track details from Spotify.' });
             return;
        }

        // check genius token
        const geniusApiKey = process.env.GENIUS_API_TOKEN;
        if (!geniusApiKey) {
             log.error('Failed: GENIUS_API_TOKEN not found in .env file.');
             await interaction.editReply({ content: 'Genius API token is missing in the bot configuration.' });
             return;
        }

        log.debug(`Searching Genius lyrics for "${title}" by "${artist}"...`);

        // genius api options
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

        // clean up genius results
        let cleanedLyrics = lyrics.trim();

        // try removing preamble before first [header]
        const commonHeadersRegex = /\[(Verse|Chorus|Intro|Outro|Bridge|Hook|Part|Segment|Pre-Chorus|Post-Chorus|Instrumental|Speaker|Skit|Interlude|Refrain|Section|Verse \d+|Chorus \d+|Intro \d+|Outro \d+)/i;
        const firstHeaderIndex = cleanedLyrics.search(commonHeadersRegex);

        if (firstHeaderIndex > 0) { // if a header is found, and it's not at the very beginning (meaning there's some preamble)
            log.debug(`Found first lyrics header at index ${firstHeaderIndex}. Trimming preamble.`);
            cleanedLyrics = cleanedLyrics.substring(firstHeaderIndex);
        } else if (firstHeaderIndex === -1) {
            // no common headers found
            log.debug('No common lyrics headers found, proceeding with other cleanup methods.');
        }
        // (lyrics starting with header is fine)

        // remove [verse], [chorus] etc.
        cleanedLyrics = cleanedLyrics.replace(/\[.*?\](\r?\n)?/g, ''); // handle headers on same line
         // remove potential metadata first line
        const lines = cleanedLyrics.split('\n');
        if (lines.length > 0 && (lines[0].includes('Contributors') || lines[0].toLowerCase().includes(title.toLowerCase()+' lyrics') || lines[0].match(/^\d+.*Lyrics$/))) {
            log.debug(`Removing potential metadata line: "${lines[0]}"`);
            lines.shift();
            cleanedLyrics = lines.join('\n').trim();
        }
        // remove extra blank lines
        cleanedLyrics = cleanedLyrics.replace(/(\r?\n){2,}/g, '\n\n'); // allow max 1 blank line
        cleanedLyrics = cleanedLyrics.trim(); // final trim

        // prepare embed
        const maxDescLength = 4000; // discord desc limit
        let truncated = false;
        if (cleanedLyrics.length > maxDescLength) {
            cleanedLyrics = cleanedLyrics.substring(0, maxDescLength) + "...";
            truncated = true;
        }

        const albumArtUrl = track.album.images.length > 0 ? track.album.images[0].url : null;
        log.debug({ albumArtUrl }, 'Passing album art URL to createLyricsEmbed'); // added log
        const embed = await createLyricsEmbed(title, artist, cleanedLyrics, track.external_urls.spotify, albumArtUrl, truncated); // added await

        // send lyrics
        log.debug('Lyrics embed created with dynamic color, sending reply...'); // added log
        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        log.error({ err: error }, 'Error during /fetchlyrics (initial editReply likely failed)');
        // try sending a followup error message instead of editing again
        try {
             await interaction.followUp({ content: 'An error occurred while fetching lyrics. Please try again later.', ephemeral: true });
        } catch (followUpError) {
             log.error({ err: followUpError }, "failed sending followup error reply");
        }
    }
}

module.exports = {
    handleFetchLyrics,
};
