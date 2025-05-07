const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const { getLogger } = require('./logger');
const { getConfig, saveConfig } = require('./config');

const log = getLogger('Discord'); // contextual logger
const discordToken = process.env.DISCORD_BOT_TOKEN;

if (!discordToken) {
    log.fatal("[SETUP] Error: DISCORD_BOT_TOKEN not found in .env file."); // use fatal for critical setup errors
    process.exit(1);
}

let targetChannel = null; // holds the channel object where status is posted

// initialize discord client with necessary permissions (intents)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, // needed to find channels
        GatewayIntentBits.GuildMessages, // needed to send/delete messages
        GatewayIntentBits.GuildIntegrations // needed for slash commands
    ]
});

function getDiscordClient() {
    return client;
}

function getTargetChannel() {
    return targetChannel;
}

// updates the target channel in memory (used by channelSet command)
function setTargetChannel(channel) {
    targetChannel = channel;
}

// fetches the target channel object based on id stored in config
async function fetchTargetChannel() {
    const { targetChannelId } = getConfig();
    if (targetChannelId) {
        log.info(`Attempting to fetch configured channel: ${targetChannelId}`);
        try {
            const fetchedChannel = await client.channels.fetch(targetChannelId);
            // validate fetched channel
            if (!fetchedChannel || !fetchedChannel.isTextBased()) {
                log.error(`Configured channel ${targetChannelId} not found or is not a text channel. Use /channelset.`);
                targetChannel = null;
            } else {
                log.info(`Target channel set to: #${fetchedChannel.name} (${fetchedChannel.id})`);
                targetChannel = fetchedChannel; // set the module-level variable
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
    return targetChannel; // return the fetched (or null) channel
}

// finds and deletes all previous messages sent by the bot in the target channel
async function cleanupOldMessages(channel, clientInstance) {
    if (!channel) return;
    log.debug(`Cleaning up old status messages in #${channel.name}...`);
    try {
        const messages = await channel.messages.fetch({ limit: 20 }); // fetch recent messages
        const botMessages = messages.filter(m => m.author.id === clientInstance.user.id);

        if (botMessages.size === 0) {
            log.debug('No old bot messages found to cleanup.');
            return;
        }

        log.debug(`Found ${botMessages.size} old message(s) to delete.`);
        // attempt to delete all found messages concurrently
        const deletionPromises = botMessages.map(msg => msg.delete().catch(err => {
             if (err.code !== 10008) { // ignore "unknown message" errors
                 log.warn({ err: err }, `Failed to delete old message ${msg.id}`);
             }
        }));
        await Promise.allSettled(deletionPromises);
        log.debug('Cleanup finished.');
    } catch (error) {
        // log errors during fetch/filter itself
        log.error({ err: error }, 'Error during old message cleanup');
    }
}

// handles sending/updating the status message (delete & send strategy)
async function updateDiscordMessage(channel, embed, clientInstance, type = 'Update') {
    if (!channel) {
        log.debug('Message update skipped: No target channel provided.');
        return true; // non-critical failure
    }

    try {
        // 1. cleanup ALL previous messages from the bot in the channel
        await cleanupOldMessages(channel, clientInstance);

        // 2. send the new message
        const newMessage = await channel.send(embed);
        log.info(`Sent new status message ${newMessage.id} with status: ${type}`);

    } catch (error) {
        log.error({ err: error }, 'Error sending/deleting Discord message');

        // handle critical permission errors
        if (error.code === 50001 || error.code === 50013) { // missing access / permissions
             log.error(`Missing permissions (Send Messages / Manage Messages?) in channel #${channel.name}. Please check bot permissions.`);
             targetChannel = null; // clear target channel state locally
             return false; // indicate critical failure -> polling should stop
        }
    }
    return true; // indicate success or non-critical failure
}

// logs the bot into discord
function login() {
     log.info('Logging in...');
     client.login(discordToken);
}

module.exports = {
    client, // export client for event handling
    getTargetChannel,
    setTargetChannel,
    fetchTargetChannel,
    updateDiscordMessage,
    login,
};
