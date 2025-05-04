const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const chalk = require('chalk');
const { getConfig, saveConfig } = require('./config');

const discordToken = process.env.DISCORD_BOT_TOKEN;

if (!discordToken) {
    console.error(chalk.red("[SETUP] Error: DISCORD_BOT_TOKEN not found in .env file."));
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
        console.log(chalk.blue(`[DISCORD] Attempting to fetch configured channel: ${targetChannelId}`));
        try {
            const fetchedChannel = await client.channels.fetch(targetChannelId);
            // validate fetched channel
            if (!fetchedChannel || !fetchedChannel.isTextBased()) {
                console.error(chalk.red(`[DISCORD] Error: Configured channel ${targetChannelId} not found or is not a text channel. Use /channelset.`));
                targetChannel = null;
            } else {
                console.log(chalk.green(`[DISCORD] Target channel set to: #${fetchedChannel.name} (${fetchedChannel.id})`));
                targetChannel = fetchedChannel; // set the module-level variable
            }
        } catch (error) {
            console.error(chalk.red(`[DISCORD] Error fetching channel ${targetChannelId}:`), error.message);
            console.log(chalk.yellow('[DISCORD] The bot might not have access to this channel, or the ID is invalid. Use /channelset.'));
            targetChannel = null;
        }
    } else {
        console.log(chalk.yellow('[DISCORD] Target channel ID not set in config. Use /channelset command.'));
        targetChannel = null;
    }
    return targetChannel; // return the fetched (or null) channel
}

// finds and deletes all previous messages sent by the bot in the target channel
async function cleanupOldMessages(channel, clientInstance) {
    if (!channel) return;
    console.log(chalk.dim(`[DISCORD] Cleaning up old status messages in #${channel.name}...`));
    try {
        const messages = await channel.messages.fetch({ limit: 20 }); // fetch recent messages
        const botMessages = messages.filter(m => m.author.id === clientInstance.user.id);

        if (botMessages.size === 0) {
            console.log(chalk.dim('[DISCORD] No old bot messages found to cleanup.'));
            return;
        }

        console.log(chalk.dim(`[DISCORD] Found ${botMessages.size} old message(s) to delete.`));
        // attempt to delete all found messages concurrently
        const deletionPromises = botMessages.map(msg => msg.delete().catch(err => {
             if (err.code !== 10008) { // ignore "unknown message" errors
                 console.warn(chalk.yellow(`[DISCORD] Failed to delete old message ${msg.id}: ${err.message}`));
             }
        }));
        await Promise.allSettled(deletionPromises);
        console.log(chalk.dim('[DISCORD] Cleanup finished.'));
    } catch (error) {
        // log errors during fetch/filter itself
        console.error(chalk.red('[DISCORD] Error during old message cleanup:'), error);
    }
}

// handles sending/updating the status message (delete & send strategy)
async function updateDiscordMessage(channel, embed, clientInstance, type = 'Update') {
    if (!channel) {
        console.log(chalk.dim('[DISCORD] Message update skipped: No target channel provided.'));
        return true; // non-critical failure
    }

    try {
        // 1. cleanup ALL previous messages from the bot in the channel
        await cleanupOldMessages(channel, clientInstance);

        // 2. send the new message
        const newMessage = await channel.send({ embeds: [embed] });
        console.log(chalk.green(`[DISCORD] Sent new status message ${newMessage.id} with status: ${type}`));

    } catch (error) {
        console.error(chalk.red('[DISCORD] Error sending/deleting Discord message:'), error.message || error);

        // handle critical permission errors
        if (error.code === 50001 || error.code === 50013) { // missing access / permissions
             console.error(chalk.red(`[DISCORD] Error: Missing permissions (Send Messages / Manage Messages?) in channel #${channel.name}. Please check bot permissions.`));
             targetChannel = null; // clear target channel state locally
             return false; // indicate critical failure -> polling should stop
        }
    }
    return true; // indicate success or non-critical failure
}

// logs the bot into discord
function login() {
     console.log(chalk.blue('[DISCORD] Logging in...'));
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
