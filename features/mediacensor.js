// features/mediacensor.js
// Automatically deletes messages containing URLs or images in specified channels

const { EmbedBuilder } = require('discord.js');

// Configurable constants - add channel IDs where media should be censored
const CENSORED_CHANNELS = (process.env.CENSORED_CHANNELS || '').split(',').filter(id => id.trim());

// URL regex pattern to detect links
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        // Ignore bots and non-censored channels
        if (message.author.bot) return;
        if (!CENSORED_CHANNELS.includes(message.channel.id)) return;

        // Check for attachments (images, videos, files)
        const hasAttachments = message.attachments.size > 0;

        // Check for URLs in message content
        const hasUrls = URL_REGEX.test(message.content);

        // Check for embeds (auto-generated from URLs)
        const hasEmbeds = message.embeds.length > 0;

        // If message contains media/URLs, delete it
        if (hasAttachments || hasUrls || hasEmbeds) {
            try {
                await message.delete();
                
                // Send ephemeral-like notification
                const notification = await message.channel.send(
                    `❌ ${message.author}, images and URLs are not allowed in this channel. Your message was deleted.`
                );
                
                // Delete notification after 5 seconds
                setTimeout(() => {
                    notification.delete().catch(() => {});
                }, 5000);

                console.log(`[Media Censor] Deleted message from ${message.author.tag} in #${message.channel.name}`);
            } catch (e) {
                console.error('[Media Censor] Failed to delete message:', e);
            }
        }
    });

    console.log('[Media Censor] Feature loaded. Monitoring channels:', CENSORED_CHANNELS.length > 0 ? CENSORED_CHANNELS.join(', ') : 'None configured');
};
