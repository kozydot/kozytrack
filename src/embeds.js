const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, bold, italic, inlineCode } = require('discord.js');
const axios = require('axios');
const Vibrant = require('node-vibrant/node'); // use node-specific import
const { getLogger } = require('./logger');
const log = getLogger('EMBEDS');

const DEFAULT_EMBED_COLOR = 0x1DB954; // default color (spotify green)

// get dominant color from image url
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

        // try getting a nice color, fall back if needed
        const swatch = palette.DarkVibrant || palette.Vibrant || palette.DarkMuted || palette.Muted || palette.LightVibrant || palette.LightMuted;

        if (swatch && swatch.hex) {
            const colorInt = parseInt(swatch.hex.substring(1), 16); // convert hex #rrggbb to decimal int
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

// create the 'now playing' embed
async function createSongEmbed(track, currentTimeFormatted, totalTimeFormatted) {
    const artists = track.artists.map(artist => artist.name).join(', ');
    const albumArt = track.album.images.length > 0 ? track.album.images[0].url : null;
    const kozyTrackIconUrl = 'https://i.imgur.com/S8FRQOb.png'; // kozytrack icon
    const spotifyIconUrl = 'https://i.imgur.com/8DORpdi.gif'; // animated GIF

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
            { name: '\u200B', value: '\u200B', inline: false } // spacer field
        )
        .setFooter({ text: `Spotify | Updated at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, iconURL: spotifyIconUrl });

    if (albumArt) {
        embed.setThumbnail(albumArt);
    }

    // buttons
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

// create 'nothing playing' embed
function createNothingPlayingEmbed() {
    return new EmbedBuilder()
        .setColor(0x4F545C) // discord grey
        .setDescription('*Nothing playing on Spotify currently.*')
        .setFooter({ text: 'Spotify Status' });
}

// create generic error embed
function createErrorEmbed(error, title = 'Error Fetching Spotify Status') {
     return new EmbedBuilder()
        .setColor(0xFF0000) // red
        .setTitle(title)
        .setDescription(`\`\`\`${error.message || 'An unknown error occurred.'}\`\`\``)
        .setTimestamp()
        .setFooter({ text: 'Spotify Status Error' });
}

// create lyrics embed
async function createLyricsEmbed(title, artist, lyrics, trackUrl, albumArtUrl, truncated) { // make async
     const dynamicColor = await getDominantColor(albumArtUrl); // get dynamic color
     log.debug({ dynamicColor }, 'Using dynamic color for lyrics embed'); // log the color being used
     const embed = new EmbedBuilder()
        .setColor(dynamicColor) // use dynamic color
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
