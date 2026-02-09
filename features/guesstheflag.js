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

    // Load flags from data files
    const flagsPath = path.join(__dirname, '..', 'data', 'flags.json');
    const customFlagsPath = path.join(__dirname, '..', 'data', 'custom-flags.json');
    let FLAGS = [];

    try {
        // Load standard flags
        if (fs.existsSync(flagsPath)) {
            const flagsData = JSON.parse(fs.readFileSync(flagsPath, 'utf8'));
            // Add the URL property based on the code
            FLAGS = flagsData.map(flag => ({
                ...flag,
                url: flag.url || `https://flagcdn.com/w320/${flag.code}.png`
            }));
        } else {
            console.error('flags.json not found! Guess the Flag feature disabled.');
            return;
        }

        // Load custom flags if they exist
        if (fs.existsSync(customFlagsPath)) {
            const customFlagsData = JSON.parse(fs.readFileSync(customFlagsPath, 'utf8'));
            const customFlags = customFlagsData.map(flag => ({
                ...flag,
                url: flag.url || `https://flagcdn.com/w320/${flag.code}.png`
            }));
            FLAGS = FLAGS.concat(customFlags);
            console.log(`[Guess the Flag] Loaded ${customFlags.length} custom flag(s).`);
        }
    } catch (err) {
        console.error('Error loading or parsing flags.json:', err);
        return;
    }

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

    function findFlagByName(name) {
        const normalized = normalizeCountryName(name);
        
        for (const flag of FLAGS) {
            if (normalizeCountryName(flag.name) === normalized) {
                return flag;
            }
            
            // Check aliases
            for (const alias of flag.aliases) {
                if (normalizeCountryName(alias) === normalized) {
                    return flag;
                }
            }
        }
        
        return null;
    }

    function isAdmin(member) {
        return member.permissions.has('Administrator') || member.permissions.has('ManageGuild');
    }

    async function startNewRound(channelId) {
        const channel = await client.channels.fetch(channelId);
        if (!channel) return;

        const flag = getRandomFlag();
        gameStates[channelId].currentFlag = flag;
        gameStates[channelId].votes = {};
        gameStates[channelId].voters = new Set();
        gameStates[channelId].isTransitioning = false;

        console.log(`[Guess the Flag] New round started in ${channel.name} - Answer: ${flag.name} ${flag.emoji}`);

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
            scores: savedData[channelId]?.scores || {},
            isTransitioning: false
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
        
        // Block all guesses during round transition
        if (gameState.isTransitioning) return;

        const content = message.content.trim();

        // ?flag commands
        if (content.startsWith('?flag ')) {
            if (!isAdmin(message.member)) {
                await message.reply('❌ This command is admin only.').catch(() => {});
                return;
            }

            const args = content.slice(6).trim().split(' ');
            const subcommand = args[0].toLowerCase();

            // ?flag get - show current flag
            if (subcommand === 'get') {
                console.log(`[Guess the Flag] ${message.author.tag} used ?flag get command - Answer: ${gameState.currentFlag.name}`);
                const embed = new EmbedBuilder()
                    .setTitle('🚩 Current Flag')
                    .setDescription(`**${gameState.currentFlag.name}** ${gameState.currentFlag.emoji}`)
                    .setImage(gameState.currentFlag.url)
                    .setColor('#5865F2');

                await message.reply({ embeds: [embed] }).catch(() => {});
                return;
            }

            // ?flag set name - set current flag (without revealing it)
            if (subcommand === 'set') {
                const flagName = args.slice(1).join(' ');
                if (!flagName) {
                    await message.reply('Please provide a country name. Example: `?flag set France`').catch(() => {});
                    return;
                }

                const flag = findFlagByName(flagName);
                if (!flag) {
                    await message.reply(`Country "${flagName}" not found. Please try again.`).catch(() => {});
                    return;
                }

                gameState.currentFlag = flag;
                gameState.votes = {};
                gameState.voters = new Set();
                gameState.isTransitioning = false;

                console.log(`[Guess the Flag] ${message.author.tag} used ?flag set command - Answer set to: ${flag.name}`);
                await message.reply(`✅ Answer set to: **${flag.name}** ${flag.emoji}`).then(msg => {
                    setTimeout(() => msg.delete().catch(() => {}), 5000);
                }).catch(() => {});
                await message.delete().catch(() => {});
                return;
            }

            // ?flag send name - skip and send specific flag
            if (subcommand === 'send') {
                const flagName = args.slice(1).join(' ');
                if (!flagName) {
                    await message.reply('Please provide a country name. Example: `?flag send France`').catch(() => {});
                    return;
                }

                const flag = findFlagByName(flagName);
                if (!flag) {
                    await message.reply(`Country "${flagName}" not found. Please try again.`).catch(() => {});
                    return;
                }

                gameState.isTransitioning = true;

                console.log(`[Guess the Flag] ${message.author.tag} used ?flag send command - Sending: ${flag.name}`);
                const revealEmbed = new EmbedBuilder()
                    .setTitle('⏭️ Flag Skipped')
                    .setDescription(`The correct answer was: **${gameState.currentFlag.name}** ${gameState.currentFlag.emoji}`)
                    .setColor('#FEE75C')
                    .setFooter({ text: `Skipped by ${message.author.tag}` });

                await message.channel.send({ embeds: [revealEmbed] });
                await message.delete().catch(() => {});

                // Set the new flag
                gameState.currentFlag = flag;
                gameState.votes = {};
                gameState.voters = new Set();
                gameState.isTransitioning = false;

                const embed = new EmbedBuilder()
                    .setTitle('🚩 Guess the Flag!')
                    .setDescription('What country does this flag belong to?\n\n**How to play:**\n• Type `!` followed by the country name (e.g., `!France`)\n• Type `?` to skip to the next flag')
                    .setImage(flag.url)
                    .setColor('#5865F2')
                    .setFooter({ text: 'First to guess correctly wins!' });

                await message.channel.send({ embeds: [embed] });
                return;
            }

            return;
        }

        // Skip to next flag
        if (content === '?') {
            console.log(`[Guess the Flag] ${message.author.tag} skipped - Answer was: ${gameState.currentFlag.name}`);
            gameState.isTransitioning = true;
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

            // Check if correct
            if (isCorrectGuess(guess, gameState.currentFlag)) {
                // Block further guesses during transition
                gameState.isTransitioning = true;
                
                // Winner!
                const userId = message.author.id;
                gameState.scores[userId] = (gameState.scores[userId] || 0) + 1;
                saveGameData();

                console.log(`[Guess the Flag] ✅ ${message.author.tag} guessed correctly: ${gameState.currentFlag.name} (Score: ${gameState.scores[userId]})`);
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
                console.log(`[Guess the Flag] ❌ ${message.author.tag} guessed wrong: "${guess}" (Answer: ${gameState.currentFlag.name})`);
                await message.react('❌');
            }
        }
    });

    console.log('[Guess the Flag] Feature loaded. Active channels:', GUESS_FLAG_CHANNELS.join(', '));
};
