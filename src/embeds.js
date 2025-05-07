const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, bold, italic, inlineCode } = require('discord.js');

// creates the embed for the currently playing song status based on "Modern & Informative" design
function createSongEmbed(track, currentTimeFormatted, totalTimeFormatted) {
    const artists = track.artists.map(artist => artist.name).join(', ');
    const albumArt = track.album.images.length > 0 ? track.album.images[0].url : null;
    // Using Spotify icon as a placeholder for KozyTrack author icon as per thought process.
    // A dedicated KozyTrack icon URL should be used if available.
    const kozyTrackIconUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/100px-Spotify_logo_without_text.svg.png'; // Placeholder
    const spotifyIconUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/100px-Spotify_logo_without_text.svg.png';

    const embed = new EmbedBuilder()
        .setColor(0x1DB954) // Spotify Green
        .setTitle(track.name)
        .setURL(track.external_urls.spotify)
        .setAuthor({ name: 'Playing on KozyTrack', iconURL: kozyTrackIconUrl })
        .setDescription('Now vibing to:')
        .addFields(
            { name: '🎤 Artist(s)', value: bold(artists), inline: true },
            { name: '💿 Album', value: italic(track.album.name), inline: true },
            { name: '\u200B', value: '\u200B', inline: false } // Blank field for spacing before buttons
        )
        .setFooter({ text: `Spotify | Updated at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, iconURL: spotifyIconUrl });

    if (albumArt) {
        embed.setThumbnail(albumArt);
    }

    // Interactive Components
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
