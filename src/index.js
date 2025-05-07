// load environment variables first
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { InteractionType } = require('discord.js');
const { getLogger } = require('./logger');
const config = require('./config');
const discord = require('./discordHandler');
const spotify = require('./spotify');
const polling = require('./polling');
const { handleChannelSet } = require('./commands/channelSet');
const { handleFetchLyrics } = require('./commands/fetchLyrics');

const log = getLogger('Main'); // contextual logger for main process
const LOCK_FILE_PATH = path.join(__dirname, '..', '.kozytrack.lock'); // Lock file in project root

// Function to acquire a lock
function acquireLock() {
    try {
        // Try to create the lock file exclusively
        // If it exists, this will throw an error
        fs.writeFileSync(LOCK_FILE_PATH, process.pid.toString(), { flag: 'wx' });
        log.info(`Lock acquired. PID: ${process.pid}`);
        return true;
    } catch (error) {
        if (error.code === 'EEXIST') {
            const existingPid = fs.readFileSync(LOCK_FILE_PATH, 'utf8');
            log.warn(`Another instance of KozyTrack (PID: ${existingPid}) might be running. Lock file ${LOCK_FILE_PATH} already exists.`);
            log.warn('If you are sure no other instance is running, delete the .kozytrack.lock file and try again.');
            return false;
        }
        // For other errors, rethrow
        log.error({ err: error }, 'Error acquiring lock file.');
        throw error;
    }
}

// Function to release the lock
function releaseLock() {
    try {
        if (fs.existsSync(LOCK_FILE_PATH)) {
            fs.unlinkSync(LOCK_FILE_PATH);
            log.info('Lock released.');
        }
    } catch (error) {
        log.error({ err: error }, 'Error releasing lock file.');
    }
}

// main function to initialize and run the bot
async function main() {
    if (!acquireLock()) {
        log.warn('Exiting due to existing lock file.');
        process.exit(1); // Exit if lock can't be acquired
    }

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
        if (interaction.isChatInputCommand()) {
            const { commandName } = interaction;
            log.info(`Processing command: /${commandName} by ${interaction.user.tag}`);

            try {
                // route command to the appropriate handler
                if (commandName === 'channelset') {
                    await handleChannelSet(interaction);
                } else if (commandName === 'fetchlyrics') {
                    await handleFetchLyrics(interaction); // trackId will be null, handled by fetchLyrics
                } else {
                    // handle unknown commands
                    log.warn(`Unknown command received: ${commandName}`);
                    await interaction.reply({ content: 'Unknown command.', ephemeral: true });
                }
            } catch (error) {
                // generic error handler for command processing
                log.error({ err: error }, `Error handling slash command /${commandName}`);
                try {
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: 'An error occurred while processing the command.', ephemeral: true });
                    } else {
                        await interaction.editReply({ content: 'An error occurred while processing the command.' });
                    }
                } catch (replyError) {
                    log.error({ err: replyError }, "Failed to send error reply to slash command interaction");
                }
            }
        } else if (interaction.isButton()) {
            log.info(`Processing button interaction: ${interaction.customId} by ${interaction.user.tag}`);

            if (interaction.customId.startsWith('lyrics_')) {
                const trackId = interaction.customId.split('_')[1];
                if (trackId) {
                    try {
                        await handleFetchLyrics(interaction, trackId);
                    } catch (error) {
                        log.error({ err: error }, `Error handling lyrics button for track ${trackId}`);
                        try {
                            if (!interaction.replied && !interaction.deferred) {
                                await interaction.reply({ content: 'An error occurred while fetching lyrics for this song.', ephemeral: true });
                            } else {
                                await interaction.editReply({ content: 'An error occurred while fetching lyrics for this song.' });
                            }
                        } catch (replyError) {
                            log.error({ err: replyError }, "Failed to send error reply to lyrics button interaction");
                        }
                    }
                } else {
                    log.warn(`Button interaction 'lyrics_' with no trackId: ${interaction.customId}`);
                    await interaction.reply({ content: 'Could not determine the song for this action.', ephemeral: true });
                }
            } else {
                // Handle other button IDs if any in the future
                log.warn(`Unknown button ID: ${interaction.customId}`);
                await interaction.reply({ content: 'This button is not recognized.', ephemeral: true });
            }
        }
    });

    // login to discord
    discord.login();
}

// run the main function
main().catch(error => {
    log.fatal({ err: error }, 'Unhandled error in main function');
    releaseLock(); // Ensure lock is released on fatal error
    process.exit(1); // exit on critical error
});

// Graceful shutdown handling
process.on('exit', releaseLock); // Release lock on normal exit
process.on('SIGINT', async () => { // CTRL+C
    log.warn('\n[SYSTEM] SIGINT received. Shutting down...');
    polling.stopPolling();
    // Add any other cleanup here (e.g., close db connections)
    // releaseLock() will be called by 'exit' event
    process.exit(0);
});
process.on('SIGTERM', async () => { // kill command
    log.warn('\n[SYSTEM] SIGTERM received. Shutting down...');
    polling.stopPolling();
    // releaseLock() will be called by 'exit' event
    process.exit(0);
});
