// features/anonchat.js
// Anonymous chat feature for a specific channel using a webhook

const { WebhookClient, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Configurable constants
const ANON_CHANNEL_ID = process.env.ANON_CHANNEL_ID || 'YOUR_ANON_CHANNEL_ID';
const MOD_LOG_CHANNEL_ID = process.env.MOD_LOG_CHANNEL_ID || 'YOUR_MOD_LOG_CHANNEL_ID';
const WEBHOOK_ID = process.env.ANON_WEBHOOK_ID || 'YOUR_WEBHOOK_ID';
const WEBHOOK_TOKEN = process.env.ANON_WEBHOOK_TOKEN || 'YOUR_WEBHOOK_TOKEN';
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

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        // Handle /anon set command
        if (message.content.startsWith('/anon set ')) {
            if (message.channel.id !== ANON_CHANNEL_ID) return;

            let data = loadData();
            if (!data.users) data.users = {};
            if (!data.usernames) data.usernames = {};
            if (!data.blacklist) data.blacklist = [];

            if (data.blacklist.includes(message.author.id)) {
                return message.reply('You are blacklisted from using anonymous chat.');
            }

            // Parse command: /anon set [username:] message
            const args = message.content.slice(10).trim();
            let username = 'anonymous user';
            let text = args;
            if (args.includes(':')) {
                const split = args.split(':');
                username = split[0].trim();
                text = split.slice(1).join(':').trim();
            }
            if (!text) return message.reply('Please provide a message.');

            // Prevent username from being a user's nickname or taken by another user
            const guild = message.guild;
            const takenBy = Object.entries(data.usernames).find(([name, uid]) => name.toLowerCase() === username.toLowerCase());
            if (takenBy && takenBy[1] !== message.author.id) {
                return message.reply('That anonymous username is already taken.');
            }
            // Prevent using anyone's nickname
            if (guild && username !== 'anonymous user') {
                const member = guild.members.cache.find(m => m.nickname && m.nickname.toLowerCase() === username.toLowerCase());
                if (member) return message.reply('You cannot use a nickname as your anonymous username.');
            }
            // Register username for this user
            if (!data.users[message.author.id]) data.users[message.author.id] = [];
            if (!data.users[message.author.id].includes(username)) {
                data.users[message.author.id].push(username);
                data.usernames[username] = message.author.id;
            }
            saveData(data);

            // Send message via webhook
            try {
                const webhook = new WebhookClient({ id: WEBHOOK_ID, token: WEBHOOK_TOKEN });
                await webhook.send({
                    content: text,
                    username: username,
                    avatarURL: 'https://i.imgur.com/8b6bK0y.png', // generic anon avatar
                });
            } catch (e) {
                console.error('Error sending anonymous message via webhook:', e);
                return message.reply('Failed to send anonymous message.');
            }

            // Log to mod channel
            const modLog = client.channels.cache.get(MOD_LOG_CHANNEL_ID);
            if (modLog) {
                const embed = new EmbedBuilder()
                    .setTitle('Anonymous Message')
                    .addFields(
                        { name: 'User', value: `${message.author.tag} (${message.author.id})` },
                        { name: 'Anon Username', value: username },
                        { name: 'Message', value: text.length > 1024 ? text.slice(0, 1021) + '...' : text }
                    )
                    .setTimestamp();
                modLog.send({ embeds: [embed] }).catch(e => console.error('Error logging anon message:', e));
            }
            // Delete the original message
            message.delete().catch(() => {});
            return;
        }

        // Handle /anon blacklist/unblacklist commands (admin only)
        if (message.content.startsWith('/anon ')) {
            if (!message.member || !message.member.permissions.has('ManageMessages')) return;

            const args = message.content.slice(6).trim().split(/\s+/);
            let data = loadData();
            if (!data.blacklist) data.blacklist = [];

            if (args[0] === 'blacklist' && args[1]) {
                if (!data.blacklist.includes(args[1])) {
                    data.blacklist.push(args[1]);
                    saveData(data);
                    message.reply('User blacklisted from anonymous chat.');
                } else {
                    message.reply('User is already blacklisted.');
                }
            } else if (args[0] === 'unblacklist' && args[1]) {
                data.blacklist = data.blacklist.filter(id => id !== args[1]);
                saveData(data);
                message.reply('User removed from blacklist.');
            }
        }
    });
};
