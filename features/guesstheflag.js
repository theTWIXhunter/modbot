// features/guesstheflag.js
// Guess the flag game - players vote using "!" followed by country name

const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    // Load shared channel configuration
    const sharedPath = path.join(__dirname, '..', 'data', 'shared-channels.json');
    let sharedConfig = {};

    try {
        if (fs.existsSync(sharedPath)) {
            sharedConfig = JSON.parse(fs.readFileSync(sharedPath, 'utf8'));
        } else {
            console.error('shared-channels.json not found! Guess the Flag feature disabled.');
            return;
        }
    } catch (err) {
        console.error('Error loading or parsing shared-channels.json:', err);
        return;
    }

    // Channel IDs for guess the flag game (from shared config)
    const GUESS_FLAG_CHANNELS = sharedConfig.guesstheflag || [];

    if (GUESS_FLAG_CHANNELS.length === 0) {
        console.log('[Guess the Flag] No channels configured.');
        return;
    }

    // List of countries with their flag emoji and flag image URLs
    const FLAGS = [
        { name: 'United States', emoji: '🇺🇸', url: 'https://flagcdn.com/w320/us.png', aliases: ['usa', 'america', 'united states of america'] },
        { name: 'United Kingdom', emoji: '🇬🇧', url: 'https://flagcdn.com/w320/gb.png', aliases: ['uk', 'britain', 'great britain', 'england'] },
        { name: 'Canada', emoji: '🇨🇦', url: 'https://flagcdn.com/w320/ca.png', aliases: [] },
        { name: 'France', emoji: '🇫🇷', url: 'https://flagcdn.com/w320/fr.png', aliases: [] },
        { name: 'Germany', emoji: '🇩🇪', url: 'https://flagcdn.com/w320/de.png', aliases: [] },
        { name: 'Italy', emoji: '🇮🇹', url: 'https://flagcdn.com/w320/it.png', aliases: [] },
        { name: 'Spain', emoji: '🇪🇸', url: 'https://flagcdn.com/w320/es.png', aliases: [] },
        { name: 'Japan', emoji: '🇯🇵', url: 'https://flagcdn.com/w320/jp.png', aliases: [] },
        { name: 'China', emoji: '🇨🇳', url: 'https://flagcdn.com/w320/cn.png', aliases: [] },
        { name: 'South Korea', emoji: '🇰🇷', url: 'https://flagcdn.com/w320/kr.png', aliases: ['korea'] },
        { name: 'Brazil', emoji: '🇧🇷', url: 'https://flagcdn.com/w320/br.png', aliases: [] },
        { name: 'Mexico', emoji: '🇲🇽', url: 'https://flagcdn.com/w320/mx.png', aliases: [] },
        { name: 'Australia', emoji: '🇦🇺', url: 'https://flagcdn.com/w320/au.png', aliases: [] },
        { name: 'India', emoji: '🇮🇳', url: 'https://flagcdn.com/w320/in.png', aliases: [] },
        { name: 'Russia', emoji: '🇷🇺', url: 'https://flagcdn.com/w320/ru.png', aliases: [] },
        { name: 'Netherlands', emoji: '🇳🇱', url: 'https://flagcdn.com/w320/nl.png', aliases: ['holland'] },
        { name: 'Belgium', emoji: '🇧🇪', url: 'https://flagcdn.com/w320/be.png', aliases: [] },
        { name: 'Switzerland', emoji: '🇨🇭', url: 'https://flagcdn.com/w320/ch.png', aliases: [] },
        { name: 'Sweden', emoji: '🇸🇪', url: 'https://flagcdn.com/w320/se.png', aliases: [] },
        { name: 'Norway', emoji: '🇳🇴', url: 'https://flagcdn.com/w320/no.png', aliases: [] },
        { name: 'Denmark', emoji: '🇩🇰', url: 'https://flagcdn.com/w320/dk.png', aliases: [] },
        { name: 'Finland', emoji: '🇫🇮', url: 'https://flagcdn.com/w320/fi.png', aliases: [] },
        { name: 'Poland', emoji: '🇵🇱', url: 'https://flagcdn.com/w320/pl.png', aliases: [] },
        { name: 'Greece', emoji: '🇬🇷', url: 'https://flagcdn.com/w320/gr.png', aliases: [] },
        { name: 'Turkey', emoji: '🇹🇷', url: 'https://flagcdn.com/w320/tr.png', aliases: ['türkiye'] },
        { name: 'Portugal', emoji: '🇵🇹', url: 'https://flagcdn.com/w320/pt.png', aliases: [] },
        { name: 'Argentina', emoji: '🇦🇷', url: 'https://flagcdn.com/w320/ar.png', aliases: [] },
        { name: 'South Africa', emoji: '🇿🇦', url: 'https://flagcdn.com/w320/za.png', aliases: [] },
        { name: 'Egypt', emoji: '🇪🇬', url: 'https://flagcdn.com/w320/eg.png', aliases: [] },
        { name: 'Thailand', emoji: '🇹🇭', url: 'https://flagcdn.com/w320/th.png', aliases: [] },
        { name: 'Vietnam', emoji: '🇻🇳', url: 'https://flagcdn.com/w320/vn.png', aliases: [] },
        { name: 'Philippines', emoji: '🇵🇭', url: 'https://flagcdn.com/w320/ph.png', aliases: [] },
        { name: 'Indonesia', emoji: '🇮🇩', url: 'https://flagcdn.com/w320/id.png', aliases: [] },
        { name: 'Malaysia', emoji: '🇲🇾', url: 'https://flagcdn.com/w320/my.png', aliases: [] },
        { name: 'Singapore', emoji: '🇸🇬', url: 'https://flagcdn.com/w320/sg.png', aliases: [] },
        { name: 'New Zealand', emoji: '🇳🇿', url: 'https://flagcdn.com/w320/nz.png', aliases: [] },
        { name: 'Ireland', emoji: '🇮🇪', url: 'https://flagcdn.com/w320/ie.png', aliases: [] },
        { name: 'Austria', emoji: '🇦🇹', url: 'https://flagcdn.com/w320/at.png', aliases: [] },
        { name: 'Czech Republic', emoji: '🇨🇿', url: 'https://flagcdn.com/w320/cz.png', aliases: ['czechia'] },
        { name: 'Hungary', emoji: '🇭🇺', url: 'https://flagcdn.com/w320/hu.png', aliases: [] },
        { name: 'Romania', emoji: '🇷🇴', url: 'https://flagcdn.com/w320/ro.png', aliases: [] },
        { name: 'Ukraine', emoji: '🇺🇦', url: 'https://flagcdn.com/w320/ua.png', aliases: [] },
        { name: 'Chile', emoji: '🇨🇱', url: 'https://flagcdn.com/w320/cl.png', aliases: [] },
        { name: 'Colombia', emoji: '🇨🇴', url: 'https://flagcdn.com/w320/co.png', aliases: [] },
        { name: 'Peru', emoji: '🇵🇪', url: 'https://flagcdn.com/w320/pe.png', aliases: [] },
        { name: 'Venezuela', emoji: '🇻🇪', url: 'https://flagcdn.com/w320/ve.png', aliases: [] },
        { name: 'Saudi Arabia', emoji: '🇸🇦', url: 'https://flagcdn.com/w320/sa.png', aliases: [] },
        { name: 'United Arab Emirates', emoji: '🇦🇪', url: 'https://flagcdn.com/w320/ae.png', aliases: ['uae', 'emirates'] },
        { name: 'Israel', emoji: '🇮🇱', url: 'https://flagcdn.com/w320/il.png', aliases: [] },
        { name: 'Pakistan', emoji: '🇵🇰', url: 'https://flagcdn.com/w320/pk.png', aliases: [] },
    ];

    const dataPath = path.join(__dirname, '..', 'data', 'guesstheflag.json');

    // Game state per channel
    const gameStates = {};

    function loadGameData() {
        try {
            if (fs.existsSync(dataPath)) {
                const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
                return data;
            }
        } catch (error) {
            console.error('Error loading guesstheflag.json:', error);
        }
        return {};
    }

    function saveGameData() {
        try {
            const dataToSave = {};
            for (const [channelId, state] of Object.entries(gameStates)) {
                dataToSave[channelId] = {
                    scores: state.scores
                };
            }
            fs.writeFileSync(dataPath, JSON.stringify(dataToSave, null, 2));
        } catch (error) {
            console.error('Error saving guesstheflag.json:', error);
        }
    }

    function getRandomFlag() {
        return FLAGS[Math.floor(Math.random() * FLAGS.length)];
    }

    function normalizeCountryName(name) {
        return name.toLowerCase().trim().replace(/[^a-z\s]/g, '');
    }

    function isCorrectGuess(guess, flag) {
        const normalized = normalizeCountryName(guess);
        const flagName = normalizeCountryName(flag.name);
        
        if (normalized === flagName) return true;
        
        // Check aliases
        for (const alias of flag.aliases) {
            if (normalized === normalizeCountryName(alias)) return true;
        }
        
        return false;
    }

    async function startNewRound(channelId) {
        const channel = await client.channels.fetch(channelId);
        if (!channel) return;

        const flag = getRandomFlag();
        gameStates[channelId].currentFlag = flag;
        gameStates[channelId].votes = {};
        gameStates[channelId].voters = new Set();

        const embed = new EmbedBuilder()
            .setTitle('🚩 Guess the Flag!')
            .setDescription('What country does this flag belong to?\n\n**How to play:**\n• Type `!` followed by the country name (e.g., `!France`)\n• Type `?` to skip to the next flag')
            .setImage(flag.url)
            .setColor('#5865F2')
            .setFooter({ text: 'First to guess correctly wins!' });

        await channel.send({ embeds: [embed] });
    }

    // Initialize game states for configured channels
    const savedData = loadGameData();
    for (const channelId of GUESS_FLAG_CHANNELS) {
        gameStates[channelId] = {
            currentFlag: null,
            votes: {},
            voters: new Set(),
            scores: savedData[channelId]?.scores || {}
        };
    }

    // Start first round when bot is ready
    client.once('ready', () => {
        for (const channelId of GUESS_FLAG_CHANNELS) {
            startNewRound(channelId);
        }
    });

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!GUESS_FLAG_CHANNELS.includes(message.channel.id)) return;

        const gameState = gameStates[message.channel.id];
        if (!gameState || !gameState.currentFlag) return;

        const content = message.content.trim();

        // Skip to next flag
        if (content === '?') {
            const embed = new EmbedBuilder()
                .setTitle('⏭️ Flag Skipped')
                .setDescription(`The correct answer was: **${gameState.currentFlag.name}** ${gameState.currentFlag.emoji}`)
                .setColor('#FEE75C')
                .setFooter({ text: `Skipped by ${message.author.tag}` });

            await message.channel.send({ embeds: [embed] });
            await startNewRound(message.channel.id);
            return;
        }

        // Check for guess (starts with !)
        if (content.startsWith('!')) {
            const guess = content.slice(1).trim();
            if (!guess) return;

            // Check if user already voted
            if (gameState.voters.has(message.author.id)) {
                const reply = await message.reply('❌ You already voted for this flag!');
                setTimeout(() => reply.delete().catch(() => {}), 3000);
                return;
            }

            // Record vote
            gameState.voters.add(message.author.id);

            // Check if correct
            if (isCorrectGuess(guess, gameState.currentFlag)) {
                // Winner!
                const userId = message.author.id;
                gameState.scores[userId] = (gameState.scores[userId] || 0) + 1;
                saveGameData();

                const embed = new EmbedBuilder()
                    .setTitle('🎉 Correct!')
                    .setDescription(`**${message.author}** guessed it right!\n\nThe flag belongs to: **${gameState.currentFlag.name}** ${gameState.currentFlag.emoji}`)
                    .addFields({ name: '🏆 Score', value: `${gameState.scores[userId]} correct guesses`, inline: true })
                    .setColor('#57F287')
                    .setThumbnail(gameState.currentFlag.url);

                await message.channel.send({ embeds: [embed] });
                await message.react('✅');

                // Start new round after delay
                setTimeout(() => startNewRound(message.channel.id), 3000);
            } else {
                // Wrong guess
                await message.react('❌');
            }
        }
    });

    console.log('[Guess the Flag] Feature loaded. Active channels:', GUESS_FLAG_CHANNELS.join(', '));
};
