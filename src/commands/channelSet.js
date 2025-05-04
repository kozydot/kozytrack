const { ChannelType, InteractionFlags } = require('discord.js');
const chalk = require('chalk');
const { saveConfig } = require('../config'); // config utils
const { stopPolling, startPollingIfNeeded } = require('../polling'); // polling controls
const { setTargetChannel, getDiscordClient } = require('../discordHandler'); // discord utils

// handles the /channelset command logic
async function handleChannelSet(interaction) {
    const client = getDiscordClient();
    const selectedChannel = interaction.options.getChannel('channel');

    // validate input
    if (!selectedChannel || selectedChannel.type !== ChannelType.GuildText) {
        console.log(chalk.yellow(`[DISCORD] /channelset failed: Invalid channel type selected by ${interaction.user.tag}.`));
        await interaction.reply({ content: 'Please select a valid text channel.', flags: [InteractionFlags.Ephemeral] });
        return;
    }

    // check bot permissions in the selected channel
    console.log(chalk.dim(`[DISCORD] Checking permissions for bot in channel #${selectedChannel.name}...`));
    const permissions = selectedChannel.permissionsFor(client.user);
    // need view, send, manage (for delete+send), and embed links
    if (!permissions || !permissions.has('ViewChannel') || !permissions.has('SendMessages') || !permissions.has('ManageMessages') || !permissions.has('EmbedLinks')) {
         console.log(chalk.yellow(`[DISCORD] /channelset failed: Missing permissions in #${selectedChannel.name}. Needs View, Send, Manage Messages, Embed Links.`));
         await interaction.reply({ content: `I don't have the necessary permissions (View Channel, Send Messages, Manage Messages, Embed Links) in ${selectedChannel}. Please grant them and try again.`, flags: [InteractionFlags.Ephemeral] });
         return;
    }
    console.log(chalk.dim(`[DISCORD] Permissions OK in #${selectedChannel.name}.`));

    // stop polling if it was running for a previous channel
    stopPolling();

    // update config and state
    saveConfig({ targetChannelId: selectedChannel.id }); // save to config.json
    setTargetChannel(selectedChannel); // update live variable in discordHandler

    console.log(chalk.green(`[DISCORD] Target channel set to #${selectedChannel.name} (${selectedChannel.id}) by ${interaction.user.tag}`));
    await interaction.reply({ content: `Spotify status updates will now be sent to ${selectedChannel}.`, flags: [InteractionFlags.Ephemeral] });

    // attempt to start polling now that channel is set
    startPollingIfNeeded(selectedChannel, client);
}

module.exports = {
    handleChannelSet,
};
