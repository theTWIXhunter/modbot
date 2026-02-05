// features/mediacensor.js
// Automatically deletes messages containing non-spoilered URLs or images in specified channels

const { EmbedBuilder } = require('discord.js');

// Configurable constants - add channel IDs where media should be censored
const CENSORED_CHANNELS = (process.env.CENSORED_CHANNELS || '').split(',').filter(id => id.trim());

// URL regex pattern to detect links (not inside spoiler tags)
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;
const SPOILER_URL_REGEX = /\|\|(https?:\/\/[^\s]+)\|\|/gi;

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        // Ignore bots and non-censored channels
        if (message.author.bot) return;
        if (!CENSORED_CHANNELS.includes(message.channel.id)) return;

        // Check for non-spoilered attachments
        const hasUnspoileredAttachments = message.attachments.some(att => !att.spoiler);

        // Check for non-spoilered URLs in message content
        // First remove all spoilered URLs from content
        let contentWithoutSpoilers = message.content.replace(SPOILER_URL_REGEX, '');
        
        // Extract URLs and filter out Tenor links
        const urls = contentWithoutSpoilers.match(URL_REGEX) || [];
        const nonTenorUrls = urls.filter(url => !url.includes('tenor.com'));
        const hasUnspoileredUrls = nonTenorUrls.length > 0;

        // If message contains non-spoilered media/URLs, delete it
        if (hasUnspoileredAttachments || hasUnspoileredUrls) {
            try {
                await message.delete();
                
                // Send ephemeral-like notification
                const notification = await message.channel.send(
                    `❌ ${message.author}, images and URLs must be spoilered in this channel. Your message was deleted.\nTip: Use spoiler tags \`||url||\` for links or mark images as spoilers when uploading.`
                );
                
                // Delete notification after 8 seconds
                setTimeout(() => {
                    notification.delete().catch(() => {});
                }, 8000);

                console.log(`[Media Censor] Deleted unspoilered content from ${message.author.tag} in #${message.channel.name}`);
            } catch (e) {
                console.error('[Media Censor] Failed to delete message:', e);
            }
        }
    });

    console.log('[Media Censor] Feature loaded. Monitoring channels:', CENSORED_CHANNELS.length > 0 ? CENSORED_CHANNELS.join(', ') : 'None configured');
};
