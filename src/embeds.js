const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, bold, italic, inlineCode } = require('discord.js');
const axios = require('axios');
const Vibrant = require('node-vibrant/node'); // corrected import for node.js environment
const { getLogger } = require('./logger');
const log = getLogger('Embeds');

const DEFAULT_EMBED_COLOR = 0x1DB954; // spotify green

// helper to get dominant color from an image url
async function getDominantColor(imageUrl) {
    log.debug(`Attempting to get dominant color for image URL: ${imageUrl}`);
    if (!imageUrl) {
        log.warn('No image URL provided for dominant color extraction, using default.');
        return DEFAULT_EMBED_COLOR;
    }
    try {
        log.trace({ url: imageUrl }, 'Fetching image buffer...');
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data, 'binary');
        log.trace('Image buffer fetched. Extracting palette with Vibrant...');
        const palette = await Vibrant.Vibrant.from(buffer).getPalette();
        log.trace({ palette }, 'Palette extracted.');

        // prefer vibrant, darkvibrant, or muted swatch, fallback to default
        const swatch = palette.DarkVibrant || palette.Vibrant || palette.DarkMuted || palette.Muted || palette.LightVibrant || palette.LightMuted;

        if (swatch && swatch.hex) {
            const colorInt = parseInt(swatch.hex.substring(1), 16); // convert hex string to integer
            log.info(`Dominant color extracted: ${swatch.hex} (Int: ${colorInt})`);
            return colorInt;
        }
        log.warn('Could not find a suitable swatch (DarkVibrant, Vibrant, DarkMuted, Muted, LightVibrant, LightMuted) in the palette. Using default color.');
        return DEFAULT_EMBED_COLOR;
    } catch (error) {
        log.error({ err: error, imageUrl }, 'Error getting dominant color. Using default.');
        return DEFAULT_EMBED_COLOR;
    }
}

// creates the embed for the currently playing song status - "modern & informative" design
async function createSongEmbed(track, currentTimeFormatted, totalTimeFormatted) {
    const artists = track.artists.map(artist => artist.name).join(', ');
    const albumArt = track.album.images.length > 0 ? track.album.images[0].url : null;
    // using spotify icon as a placeholder for kozytrack author icon for now.
    // todo: use a dedicated kozytrack icon url if we get one.
    const kozyTrackIconUrl = 'https://i.imgur.com/S8FRQOb.png'; // updated kozytrack icon
    const spotifyIconUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/100px-Spotify_logo_without_text.svg.png';

    const dynamicColor = await getDominantColor(albumArt);

    const embed = new EmbedBuilder()
        .setColor(dynamicColor)
        .setTitle(track.name)
        .setURL(track.external_urls.spotify)
        .setAuthor({ name: 'Playing on KozyTrack', iconURL: kozyTrackIconUrl })
        .setDescription('Now vibing to:')
        .addFields(
            { name: '🎤 Artist(s)', value: bold(artists), inline: true },
            { name: '💿 Album', value: italic(track.album.name), inline: true },
            { name: '\u200B', value: '\u200B', inline: false } // blank field for spacing before buttons
        )
        .setFooter({ text: `Spotify | Updated at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, iconURL: spotifyIconUrl });

    if (albumArt) {
        embed.setThumbnail(albumArt);
    }

    // interactive components
    const viewOnSpotifyButton = new ButtonBuilder()
        .setLabel('Open on Spotify')
        .setStyle(ButtonStyle.Link)
        .setURL(track.external_urls.spotify)
        .setEmoji('🔗');

    const searchLyricsButton = new ButtonBuilder()
        .setCustomId(`lyrics_${track.id}`)
        .setLabel('Find Lyrics')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📜');

    const actionRow = new ActionRowBuilder()
        .addComponents(viewOnSpotifyButton, searchLyricsButton);

    return { embeds: [embed.toJSON()], components: [actionRow] };
}

// creates the embed for when nothing is playing
function createNothingPlayingEmbed() {
    return new EmbedBuilder()
        .setColor(0x4F545C) // discord greyple
        .setDescription('*Nothing playing on Spotify currently.*')
        .setFooter({ text: 'Spotify Status' });
}

// creates a generic error embed
function createErrorEmbed(error, title = 'Error Fetching Spotify Status') {
     return new EmbedBuilder()
        .setColor(0xFF0000) // red
        .setTitle(title)
        .setDescription(`\`\`\`${error.message || 'An unknown error occurred.'}\`\`\``)
        .setTimestamp()
        .setFooter({ text: 'Spotify Status Error' });
}

// creates the embed for the /fetchlyrics command
function createLyricsEmbed(title, artist, lyrics, trackUrl, albumArtUrl, truncated) {
     const embed = new EmbedBuilder()
        .setColor(0x1DB954) // spotify green
        .setTitle(title)
        .setURL(trackUrl) // link to song
        .setAuthor({ name: artist })
        .setDescription(lyrics || '*Lyrics found but were empty after cleanup.*')
        .setTimestamp();

    if (albumArtUrl) {
         embed.setThumbnail(albumArtUrl);
    }

    if (truncated) {
        embed.setFooter({ text: 'Lyrics truncated due to length limits.' });
    }
     return embed;
}


module.exports = {
    createSongEmbed,
    createNothingPlayingEmbed,
    createErrorEmbed,
    createLyricsEmbed,
};
