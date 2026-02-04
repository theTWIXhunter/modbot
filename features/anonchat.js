// features/anonchat.js
// Anonymous chat feature for a specific channel using a webhook

const { WebhookClient, EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Configurable constants - strip any quotes from env vars
const ANON_CHANNEL_ID = (process.env.ANON_CHANNEL_ID || 'YOUR_ANON_CHANNEL_ID').replace(/['"]/g, '');
const MOD_LOG_CHANNEL_ID = (process.env.MOD_LOG_CHANNEL_ID || 'YOUR_MOD_LOG_CHANNEL_ID').replace(/['"]/g, '');
const WEBHOOK_ID = (process.env.ANON_WEBHOOK_ID || 'YOUR_WEBHOOK_ID').replace(/['"]/g, '');
const WEBHOOK_TOKEN = (process.env.ANON_WEBHOOK_TOKEN || 'YOUR_WEBHOOK_TOKEN').replace(/['"]/g, '');
const DATA_PATH = path.join(__dirname, '../data/anonchat.json');

// Helper to load or initialize data
function loadData() {
    try {
        if (!fs.existsSync(DATA_PATH)) return { users: {}, usernames: {}, blacklist: [] };
        return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    } catch (e) {
        console.error('Error loading anonchat.json, using defaults:', e);
        return { users: {}, usernames: {}, blacklist: [] };
    }
}

function saveData(data) {
    try {
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error saving anonchat.json:', e);
    }
}

const commands = [
    new SlashCommandBuilder()
        .setName('anon')
        .setDescription('Send anonymous messages')
        .addSubcommand(sub =>
            sub.setName('send')
                .setDescription('Send an anonymous message')
                .addStringOption(opt =>
                    opt.setName('message')
                        .setDescription('The message to send anonymously')
                        .setRequired(true))
                .addStringOption(opt =>
                    opt.setName('username')
                        .setDescription('Anonymous username (optional, defaults to "anonymous user")')
                        .setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('blacklist')
                .setDescription('Blacklist a user from using anonymous chat (Admin only)')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('User to blacklist')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('unblacklist')
                .setDescription('Remove a user from the blacklist (Admin only)')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('User to unblacklist')
                        .setRequired(true)))
];

module.exports = {
    commands,
    
    async handleInteraction(interaction, client) {
        if (interaction.commandName !== 'anon') return;

        const subcommand = interaction.options.getSubcommand();

        // Handle blacklist/unblacklist (admin only)
        if (subcommand === 'blacklist' || subcommand === 'unblacklist') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({ content: '❌ You need Manage Messages permission to use this command.', ephemeral: true });
            }

            const user = interaction.options.getUser('user');
            let data = loadData();
            if (!data.blacklist) data.blacklist = [];

            if (subcommand === 'blacklist') {
                if (!data.blacklist.includes(user.id)) {
                    data.blacklist.push(user.id);
                    saveData(data);
                    return interaction.reply({ content: `✅ ${user.tag} has been blacklisted from anonymous chat.`, ephemeral: true });
                } else {
                    return interaction.reply({ content: `${user.tag} is already blacklisted.`, ephemeral: true });
                }
            } else {
                data.blacklist = data.blacklist.filter(id => id !== user.id);
                saveData(data);
                return interaction.reply({ content: `✅ ${user.tag} has been removed from the blacklist.`, ephemeral: true });
            }
        }

        // Handle send subcommand
        if (subcommand === 'send') {
            // Check if command is used in the correct channel
            if (interaction.channel.id !== ANON_CHANNEL_ID) {
                return interaction.reply({ content: '❌ This command can only be used in the anonymous chat channel.', ephemeral: true });
            }

            let data = loadData();
            if (!data.users) data.users = {};
            if (!data.usernames) data.usernames = {};
            if (!data.blacklist) data.blacklist = [];

            // Check blacklist
            if (data.blacklist.includes(interaction.user.id)) {
                return interaction.reply({ content: '❌ You are blacklisted from using anonymous chat.', ephemeral: true });
            }

            const text = interaction.options.getString('message');
            let username = interaction.options.getString('username') || 'anonymous user';
            username = username.trim();

            // Prevent username from being taken by another user
            const takenBy = Object.entries(data.usernames).find(([name, uid]) => name.toLowerCase() === username.toLowerCase());
            if (takenBy && takenBy[1] !== interaction.user.id) {
                return interaction.reply({ content: '❌ That anonymous username is already taken by another user.', ephemeral: true });
            }

            // Prevent using anyone's nickname
            if (interaction.guild && username !== 'anonymous user') {
                const member = interaction.guild.members.cache.find(m => m.nickname && m.nickname.toLowerCase() === username.toLowerCase());
                if (member) {
                    return interaction.reply({ content: '❌ You cannot use someone\'s nickname as your anonymous username.', ephemeral: true });
                }
            }

            // Register username for this user
            if (!data.users[interaction.user.id]) data.users[interaction.user.id] = [];
            if (!data.users[interaction.user.id].includes(username)) {
                data.users[interaction.user.id].push(username);
                data.usernames[username] = interaction.user.id;
            }
            saveData(data);

            // Send message via webhook
            try {
                const webhook = new WebhookClient({ id: WEBHOOK_ID, token: WEBHOOK_TOKEN });
                await webhook.send({
                    content: text,
                    username: username,
                });
            } catch (e) {
                console.error('Error sending anonymous message via webhook:', e);
                return interaction.reply({ content: '❌ Failed to send anonymous message. Please check webhook configuration.', ephemeral: true });
            }

            // Log to mod channel
            const modLog = client.channels.cache.get(MOD_LOG_CHANNEL_ID);
            if (modLog) {
                const embed = new EmbedBuilder()
                    .setTitle('Anonymous Message')
                    .addFields(
                        { name: 'User', value: `${interaction.user.tag} (${interaction.user.id})` },
                        { name: 'Anon Username', value: username },
                        { name: 'Message', value: text.length > 1024 ? text.slice(0, 1021) + '...' : text }
                    )
                    .setTimestamp();
                modLog.send({ embeds: [embed] }).catch(e => console.error('Error logging anon message:', e));
            }

            // Confirm to user
            await interaction.reply({ content: '✅ Anonymous message sent!', ephemeral: true });
        }
    }
};
