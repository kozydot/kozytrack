// load .env (if not production)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

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

const log = getLogger('MAIN'); // logger for this module
const LOCK_FILE_PATH = path.join(__dirname, '..', '.kozytrack.lock'); // prevent multiple instances

// try to create/acquire lock file
function acquireLock() {
    try {
        // create lock file exclusively
        // fails if already exists
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
        // other errors? rethrow.
        log.error({ err: error }, 'Error acquiring lock file.');
        throw error;
    }
}

// release the lock file
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

// main startup function
async function main() {
    if (!acquireLock()) {
        log.warn('Exiting due to existing lock file.');
        process.exit(1); // exit if lock exists
    }

    log.info('Starting KozyTrack Bot...');
    // load config
    config.loadConfig();

    // setup discord client
    const client = discord.client; // get client from handler

    client.once('ready', async () => {
        log.info(`Logged in as ${client.user.tag}!`);

        // init spotify (auth/refresh)
        log.info('Initializing Spotify connection...');
        const spotifyReady = await spotify.initializeSpotify();

        // get target channel
        const targetChannel = await discord.fetchTargetChannel();

        // start polling if ready
        if (spotifyReady && targetChannel) {
            polling.startPollingIfNeeded(targetChannel, client);
        } else {
             // log why polling didn't start
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
                // route commands
                if (commandName === 'channelset') {
                    await handleChannelSet(interaction);
                } else if (commandName === 'fetchlyrics') {
                    await handleFetchLyrics(interaction); // track id handled by fetchlyrics
                } else {
                    // unknown command
                    log.warn(`Unknown command received: ${commandName}`);
                    await interaction.reply({ content: 'Unknown command.', ephemeral: true });
                }
            } catch (error) {
                // generic command error handler
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
                // handle other buttons later?
                log.warn(`Unknown button ID: ${interaction.customId}`);
                await interaction.reply({ content: 'This button is not recognized.', ephemeral: true });
            }
        }
    });

    // login to discord
    discord.login();
}

// run main
main().catch(error => {
    log.fatal({ err: error }, 'Unhandled error in main function');
    releaseLock(); // release lock on fatal error
    process.exit(1); // exit on critical error
});

// graceful shutdown
process.on('exit', releaseLock); // release lock on exit
process.on('SIGINT', async () => { // ctrl+c
    log.warn('\n[SYSTEM] SIGINT received. Shutting down...');
    polling.stopPolling();
    // other cleanup?
    // lock released via 'exit'
    process.exit(0);
});
process.on('SIGTERM', async () => { // kill command
    log.warn('\n[SYSTEM] SIGTERM received. Shutting down...');
    polling.stopPolling();
    // lock released via 'exit'
    process.exit(0);
});
