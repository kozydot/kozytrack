require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, ChannelType } = require('discord.js');

const clientId = '1368662717619114024'; // Provided Application ID
const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
    throw new Error('DISCORD_BOT_TOKEN is missing from .env file!');
}
if (!clientId) {
    throw new Error('clientId is missing!'); // Should not happen if hardcoded correctly
}

const commands = [
    new SlashCommandBuilder()
        .setName('channelset')
        .setDescription('Sets the channel where the Spotify status will be displayed.')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The text channel to use for status updates')
                .addChannelTypes(ChannelType.GuildText) // Ensure only text channels can be selected
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('fetchlyrics')
        .setDescription('Fetches lyrics for the currently playing Spotify song.'),
]
    .map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        // Registering globally. Use Routes.applicationGuildCommands(clientId, guildId) for specific guilds.
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error reloading application commands:', error);
    }
})();
