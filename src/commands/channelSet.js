const { ChannelType, InteractionFlags } = require('discord.js');
const { getLogger } = require('../logger');
const { saveConfig } = require('../config'); // config utils
const { stopPolling, startPollingIfNeeded } = require('../polling'); // polling controls
const { setTargetChannel, getDiscordClient } = require('../discordHandler'); // discord utils

const log = getLogger('Cmd:ChannelSet'); // contextual logger

// handles the /channelset command logic
async function handleChannelSet(interaction) {
    const client = getDiscordClient();
    const selectedChannel = interaction.options.getChannel('channel');

    // validate input
    if (!selectedChannel || selectedChannel.type !== ChannelType.GuildText) {
        log.warn(`Command failed: Invalid channel type selected by ${interaction.user.tag}.`);
        await interaction.reply({ content: 'Please select a valid text channel.', flags: [1 << 6] }); // 1 << 6 is InteractionFlags.Ephemeral
        return;
    }

    // check bot permissions in the selected channel
    log.debug(`Checking permissions for bot in channel #${selectedChannel.name}...`);
    const permissions = selectedChannel.permissionsFor(client.user);
    // need view, send, manage (for delete+send), and embed links
    if (!permissions || !permissions.has('ViewChannel') || !permissions.has('SendMessages') || !permissions.has('ManageMessages') || !permissions.has('EmbedLinks')) {
         log.warn(`Command failed: Missing permissions in #${selectedChannel.name}. Needs View, Send, Manage Messages, Embed Links.`);
        await interaction.reply({ content: `I don't have the necessary permissions (View Channel, Send Messages, Manage Messages, Embed Links) in ${selectedChannel}. Please grant them and try again.`, flags: [1 << 6] }); // 1 << 6 is InteractionFlags.Ephemeral
        return;
    }
    log.debug(`Permissions OK in #${selectedChannel.name}.`);

    // stop polling if it was running for a previous channel
    stopPolling();

    // update config and state
    saveConfig({ targetChannelId: selectedChannel.id }); // save to config.json
    setTargetChannel(selectedChannel); // update live variable in discordHandler

    log.info(`Target channel set to #${selectedChannel.name} (${selectedChannel.id}) by ${interaction.user.tag}`);
    await interaction.reply({ content: `Spotify status updates will now be sent to ${selectedChannel}.`, flags: [1 << 6] }); // 1 << 6 is InteractionFlags.Ephemeral

    // attempt to start polling now that channel is set
    // pass the necessary arguments (targetChannel, client)
    startPollingIfNeeded(selectedChannel, client);
}

module.exports = {
    handleChannelSet,
};
