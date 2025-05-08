const { ChannelType, InteractionFlags } = require('discord.js');
const { getLogger } = require('../logger');
const { saveConfig } = require('../config'); // config helpers
const { stopPolling, startPollingIfNeeded } = require('../polling'); // polling helpers
const { setTargetChannel, getDiscordClient } = require('../discordHandler'); // discord helpers

const log = getLogger('CMD:CHANNELSET'); // logger for this command

// handle /channelset
async function handleChannelSet(interaction) {
    const client = getDiscordClient();
    const selectedChannel = interaction.options.getChannel('channel');

    // check channel type
    if (!selectedChannel || selectedChannel.type !== ChannelType.GuildText) {
        log.warn(`Command failed: Invalid channel type selected by ${interaction.user.tag}.`);
        await interaction.reply({ content: 'Please select a valid text channel.', flags: [1 << 6] }); // ephemeral reply
        return;
    }

    // check bot perms
    log.debug(`Checking permissions for bot in channel #${selectedChannel.name}...`);
    const permissions = selectedChannel.permissionsFor(client.user);
    // need view, send, manage, embed perms
    if (!permissions || !permissions.has('ViewChannel') || !permissions.has('SendMessages') || !permissions.has('ManageMessages') || !permissions.has('EmbedLinks')) {
         log.warn(`Command failed: Missing permissions in #${selectedChannel.name}. Needs View, Send, Manage Messages, Embed Links.`);
        await interaction.reply({ content: `I don't have the necessary permissions (View Channel, Send Messages, Manage Messages, Embed Links) in ${selectedChannel}. Please grant them and try again.`, flags: [1 << 6] }); // ephemeral reply
        return;
    }
    log.debug(`Permissions OK in #${selectedChannel.name}.`);

    // stop any previous polling
    stopPolling();

    // save new channel
    saveConfig({ targetChannelId: selectedChannel.id }); // save id to config.json
    setTargetChannel(selectedChannel); // update cached channel object

    log.info(`Target channel set to #${selectedChannel.name} (${selectedChannel.id}) by ${interaction.user.tag}`);
    await interaction.reply({ content: `Spotify status updates will now be sent to ${selectedChannel}.`, flags: [1 << 6] }); // ephemeral reply

    // try starting polling now
    // pass channel/client
    startPollingIfNeeded(selectedChannel, client);
}

module.exports = {
    handleChannelSet,
};
