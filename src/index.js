// load environment variables first
require('dotenv').config();

const chalk = require('chalk');
const { InteractionType } = require('discord.js');
const config = require('./config');
const discord = require('./discordHandler');
const spotify = require('./spotify');
const polling = require('./polling');
const { handleChannelSet } = require('./commands/channelSet');
const { handleFetchLyrics } = require('./commands/fetchLyrics');

// main function to initialize and run the bot
async function main() {
    // load config on startup
    config.loadConfig();

    // setup discord client event listeners
    const client = discord.client; // get the client from the handler

    client.once('ready', async () => {
        console.log(chalk.green(`[DISCORD] Logged in as ${chalk.bold(client.user.tag)}!`));

        // initialize spotify (handles auth/refresh)
        console.log(chalk.cyan('[SPOTIFY] Initializing Spotify connection...'));
        const spotifyReady = await spotify.initializeSpotify();

        // fetch target channel from config
        const targetChannel = await discord.fetchTargetChannel();

        // start polling if everything is ready
        if (spotifyReady && targetChannel) {
            polling.startPollingIfNeeded(targetChannel, client);
        } else {
             // log status if polling couldn't start
             if (!spotifyReady) {
                 console.log(chalk.yellow('[STATUS] Bot ready, but Spotify auth needed/failed. See previous logs/authorize URL.'));
             }
             if (!targetChannel) {
                 console.log(chalk.yellow('[STATUS] Bot ready, but target channel not set/found. Use /channelset.'));
             }
        }
         if (polling.isPolling()) {
             console.log(chalk.green('[STATUS] Bot ready and polling started.'));
         }
    });

    client.on('interactionCreate', async interaction => {
        // only handle slash commands
        if (!interaction.isChatInputCommand()) return;

        const { commandName } = interaction;
        console.log(chalk.blue(`[DISCORD] Processing command: /${commandName}`));

        try {
            // route command to the appropriate handler
            if (commandName === 'channelset') {
                await handleChannelSet(interaction);
            } else if (commandName === 'fetchlyrics') {
                await handleFetchLyrics(interaction);
            } else {
                 // handle unknown commands
                 console.log(chalk.yellow(`[DISCORD] Unknown command received: ${commandName}`));
                 await interaction.reply({ content: 'Unknown command.', ephemeral: true });
            }
        } catch (error) {
             // generic error handler for command processing
             console.error(chalk.red(`[DISCORD] Error handling command /${commandName}:`), error);
             try {
                 if (!interaction.replied && !interaction.deferred) {
                     await interaction.reply({ content: 'An error occurred while processing the command.', ephemeral: true });
                 } else {
                     await interaction.editReply({ content: 'An error occurred while processing the command.' });
                 }
             } catch (replyError) {
                  console.error(chalk.red("[DISCORD] Failed to send error reply to interaction:"), replyError);
             }
        }
    });

    // login to discord
    discord.login();
}

// run the main function
main().catch(error => {
    console.error(chalk.red('[MAIN] Unhandled error in main function:'), error);
    process.exit(1); // exit on critical error
});

// optional: graceful shutdown handling
// process.on('SIGINT', async () => {
//     console.log(chalk.yellow('\n[SYSTEM] SIGINT received. Shutting down...'));
//     polling.stopPolling();
//     // add any other cleanup here (e.g., close db connections)
//     process.exit(0);
// });
