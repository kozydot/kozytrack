const { EmbedBuilder } = require('discord.js');

// creates the embed for the currently playing song status
function createSongEmbed(track) {
    const artists = track.artists.map(artist => artist.name).join(', ');
    const albumArt = track.album.images.length > 0 ? track.album.images[0].url : null;

    const embed = new EmbedBuilder()
        .setColor(0x1DB954) // spotify green
        .setTitle(track.name)
        .setURL(track.external_urls.spotify)
        .setAuthor({ name: artists })
        .setDescription(`**Album:** ${track.album.name}`)
        .setTimestamp() // use discord's timestamp
        .setFooter({ text: 'Now Playing on Spotify', iconURL: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/100px-Spotify_logo_without_text.svg.png' });

     if (albumArt) {
        embed.setThumbnail(albumArt);
    }

    return embed;
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
