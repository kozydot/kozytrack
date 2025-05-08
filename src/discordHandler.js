const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const { getLogger } = require('./logger');
const { getConfig, saveConfig } = require('./config');

const log = getLogger('DISCORD'); // logger for this module
const discordToken = process.env.DISCORD_BOT_TOKEN;

if (!discordToken) {
    log.fatal("[SETUP] Error: DISCORD_BOT_TOKEN not found in .env file."); // fatal if token missing
    process.exit(1);
}

let targetChannel = null; // cache the target channel object

// setup client with needed intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, // find channels
        GatewayIntentBits.GuildMessages, // send/delete messages
        GatewayIntentBits.GuildIntegrations // slash commands
    ]
});

function getDiscordClient() {
    return client;
}

function getTargetChannel() {
    return targetChannel;
}

// update cached channel (used by /channelset)
function setTargetChannel(channel) {
    targetChannel = channel;
}

// get channel object using id from config
async function fetchTargetChannel() {
    const { targetChannelId } = getConfig();
    if (targetChannelId) {
        log.info(`Attempting to fetch configured channel: ${targetChannelId}`);
        try {
            const fetchedChannel = await client.channels.fetch(targetChannelId);
            // make sure it's a valid text channel
            if (!fetchedChannel || !fetchedChannel.isTextBased()) {
                log.error(`Configured channel ${targetChannelId} not found or is not a text channel. Use /channelset.`);
                targetChannel = null;
            } else {
                log.info(`Target channel set to: #${fetchedChannel.name} (${fetchedChannel.id})`);
                targetChannel = fetchedChannel; // update the cache
            }
        } catch (error) {
            log.error({ err: error }, `Error fetching channel ${targetChannelId}`);
            log.warn('The bot might not have access to this channel, or the ID is invalid. Use /channelset.');
            targetChannel = null;
        }
    } else {
        log.warn('Target channel ID not set in config. Use /channelset command.');
        targetChannel = null;
    }
    return targetChannel; // return channel object or null
}

// delete previous bot messages in the channel
async function cleanupOldMessages(channel, clientInstance) {
    if (!channel) return;
    log.debug(`Cleaning up old status messages in #${channel.name}...`);
    try {
        const messages = await channel.messages.fetch({ limit: 20 }); // get recent messages
        const botMessages = messages.filter(m => m.author.id === clientInstance.user.id);

        if (botMessages.size === 0) {
            log.debug('No old bot messages found to cleanup.');
            return;
        }

        log.debug(`Found ${botMessages.size} old message(s) to delete.`);
        // delete em all
        const deletionPromises = botMessages.map(msg => msg.delete().catch(err => {
             if (err.code !== 10008) { // ignore if message already gone
                 log.warn({ err: err }, `Failed to delete old message ${msg.id}`);
             }
        }));
        await Promise.allSettled(deletionPromises);
        log.debug('Cleanup finished.');
    } catch (error) {
        // log fetch/filter errors
        log.error({ err: error }, 'Error during old message cleanup');
    }
}

// send/update status message (delete + send)
async function updateDiscordMessage(channel, embed, clientInstance, type = 'Update') {
    if (!channel) {
        log.debug('Message update skipped: No target channel provided.');
        return true; // ok to fail if no channel
    }

    try {
        // 1. cleanup old messages
        await cleanupOldMessages(channel, clientInstance);

        // 2. send new message
        const newMessage = await channel.send(embed);
        log.info(`Sent new status message ${newMessage.id} with status: ${type}`);

    } catch (error) {
        log.error({ err: error }, 'Error sending/deleting Discord message');

        // handle perm errors
        if (error.code === 50001 || error.code === 50013) { // no access?
             log.error(`Missing permissions (Send Messages / Manage Messages?) in channel #${channel.name}. Please check bot permissions.`);
             targetChannel = null; // clear cached channel
             return false; // tell polling to stop
        }
    }
    return true; // ok / non-critical fail
}

// login to discord
function login() {
     log.info('Logging in...');
     client.login(discordToken);
}

module.exports = {
    client, // export client directly
    getDiscordClient,
    getTargetChannel,
    setTargetChannel,
    fetchTargetChannel,
    updateDiscordMessage,
    login,
};
