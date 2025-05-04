// load environment variables first
require('dotenv').config();

const { InteractionType } = require('discord.js');
const { getLogger } = require('./logger');
const config = require('./config');
const discord = require('./discordHandler');
const spotify = require('./spotify');
const polling = require('./polling');
const { handleChannelSet } = require('./commands/channelSet');
const { handleFetchLyrics } = require('./commands/fetchLyrics');

const log = getLogger('Main'); // contextual logger for main process

// main function to initialize and run the bot
async function main() {
    log.info('Starting KozyTrack Bot...');
    // load config on startup
    config.loadConfig();

    // setup discord client event listeners
    const client = discord.client; // get the client from the handler

    client.once('ready', async () => {
        log.info(`Logged in as ${client.user.tag}!`);

        // initialize spotify (handles auth/refresh)
        log.info('Initializing Spotify connection...');
        const spotifyReady = await spotify.initializeSpotify();

        // fetch target channel from config
        const targetChannel = await discord.fetchTargetChannel();

        // start polling if everything is ready
        if (spotifyReady && targetChannel) {
            polling.startPollingIfNeeded(targetChannel, client);
        } else {
             // log status if polling couldn't start
             if (!spotifyReady) {
                 log.warn('Bot ready, but Spotify auth needed/failed. See previous logs/authorize URL.');
             }
             if (!targetChannel) {
                 log.warn('Bot ready, but target channel not set/found. Use /channelset.');
             }
        }
         if (polling.isPolling()) {
             log.info('Bot ready and polling started.');
         }
    });

    client.on('interactionCreate', async interaction => {
        // only handle slash commands
        if (!interaction.isChatInputCommand()) return;

        const { commandName } = interaction;
        log.info(`Processing command: /${commandName} by ${interaction.user.tag}`);

        try {
            // route command to the appropriate handler
            if (commandName === 'channelset') {
                await handleChannelSet(interaction);
            } else if (commandName === 'fetchlyrics') {
                await handleFetchLyrics(interaction);
            } else {
                 // handle unknown commands
                 log.warn(`Unknown command received: ${commandName}`);
                 await interaction.reply({ content: 'Unknown command.', ephemeral: true });
            }
        } catch (error) {
             // generic error handler for command processing
             log.error({ err: error }, `Error handling command /${commandName}`);
             try {
                 if (!interaction.replied && !interaction.deferred) {
                     await interaction.reply({ content: 'An error occurred while processing the command.', ephemeral: true });
                 } else {
                     await interaction.editReply({ content: 'An error occurred while processing the command.' });
                 }
             } catch (replyError) {
                  log.error({ err: replyError }, "Failed to send error reply to interaction");
             }
        }
    });

    // login to discord
    discord.login();
}

// run the main function
main().catch(error => {
    log.fatal({ err: error }, 'Unhandled error in main function');
    process.exit(1); // exit on critical error
});

// optional: graceful shutdown handling
// process.on('SIGINT', async () => {
//     log.warn('\n[SYSTEM] SIGINT received. Shutting down...');
//     polling.stopPolling();
//     // add any other cleanup here (e.g., close db connections)
//     process.exit(0);
// });
