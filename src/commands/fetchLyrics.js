const { getLogger } = require('../logger');
const { getLyrics } = require('genius-lyrics-api');
const { getSpotifyApiInstance, getCurrentTrack } = require('../spotify'); // spotify utils
const { createLyricsEmbed } = require('../embeds'); // embed creation

const log = getLogger('Cmd:FetchLyrics'); // contextual logger

// handles the /fetchlyrics command
async function handleFetchLyrics(interaction) {
    log.info(`Processing /fetchlyrics command by ${interaction.user.tag}`);
    await interaction.deferReply(); // needs deferral as lyrics fetching can take time

    const spotifyApi = getSpotifyApiInstance();
    // check if spotify is connected
    if (!spotifyApi || !spotifyApi.getAccessToken()) {
        log.warn('Failed: Spotify not authenticated.');
        await interaction.editReply({ content: 'Spotify is not connected. Please ensure the bot owner has authorized Spotify.' });
        return;
    }

    try {
        // get current track data (includes internal token refresh logic)
        const playbackState = await getCurrentTrack();

        if (!playbackState || !playbackState.is_playing || !playbackState.item) {
            log.warn('Failed: No track currently playing.');
            await interaction.editReply({ content: 'You are not currently playing any track on Spotify.' });
            return;
        }

        const track = playbackState.item;
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
        // remove bracketed headers like [Verse 1], [Chorus], etc.
        cleanedLyrics = cleanedLyrics.replace(/\[.*?\]\r?\n/g, '');
         // attempt to remove potential first-line metadata like "NN Contributors..."
        const lines = cleanedLyrics.split('\n');
        if (lines.length > 0 && (lines[0].includes('Contributors') || lines[0].toLowerCase().includes(title.toLowerCase()+' lyrics'))) {
            log.debug(`Removing potential metadata line: "${lines[0]}"`);
            lines.shift();
            cleanedLyrics = lines.join('\n').trim();
        }
        // consolidate multiple blank lines
        cleanedLyrics = cleanedLyrics.replace(/(\r?\n){3,}/g, '\n\n');

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
