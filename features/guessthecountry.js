// features/guessthecountry.js
// Guess the Country - Multi-category geography trivia game
// Players vote using "!" followed by the answer

const fs = require('fs');
const path = require('path');
const https = require('https');
const sharp = require('sharp');
const { EmbedBuilder, SlashCommandBuilder, AttachmentBuilder } = require('discord.js');

module.exports = (client) => {
    // Load shared channel configuration
    const sharedPath = path.join(__dirname, '..', 'data', 'shared-channels.json');
    let sharedConfig = {};

    try {
        if (fs.existsSync(sharedPath)) {
            sharedConfig = JSON.parse(fs.readFileSync(sharedPath, 'utf8'));
        } else {
            console.error('shared-channels.json not found! Guess the Country feature disabled.');
            return;
        }
    } catch (err) {
        console.error('Error loading or parsing shared-channels.json:', err);
        return;
    }

    // Channel IDs for guess the country game
    const GUESS_COUNTRY_CHANNELS = sharedConfig.guessthecountry || [];

    if (GUESS_COUNTRY_CHANNELS.length === 0) {
        console.log('[Guess the Country] No channels configured.');
        return;
    }

    // Question types
    const QUESTION_TYPES = {
        FLAG_TO_COUNTRY: 'flag_to_country',
        COUNTRY_TO_CAPITAL: 'country_to_capital',
        CAPITAL_TO_COUNTRY: 'capital_to_country',
        OUTLINE_TO_COUNTRY: 'outline_to_country',
        BORDERS_TO_COUNTRY: 'borders_to_country',
        LANDMARK_TO_COUNTRY: 'landmark_to_country'
    };

    // Weighted distribution (adds up to 100)
    const DEFAULT_WEIGHTS = {
        [QUESTION_TYPES.FLAG_TO_COUNTRY]: 25,
        [QUESTION_TYPES.COUNTRY_TO_CAPITAL]: 0, // Disabled
        [QUESTION_TYPES.CAPITAL_TO_COUNTRY]: 0, // Disabled
        [QUESTION_TYPES.OUTLINE_TO_COUNTRY]: 25, // Enabled with SVG to PNG conversion
        [QUESTION_TYPES.BORDERS_TO_COUNTRY]: 25,
        [QUESTION_TYPES.LANDMARK_TO_COUNTRY]: 25
    };

    // Load country data
    const countriesPath = path.join(__dirname, '..', 'data', 'countries.json');
    let COUNTRIES = [];

    // Helper function to convert country name to amCharts map name
    function getAmChartsMapName(countryName) {
        // amCharts naming: country name in lowercase + "Low" (e.g., "afghanistanLow")
        const nameMap = {
            'United States': 'usaLow',
            'United Kingdom': 'unitedKingdomLow',
            'South Korea': 'southKoreaLow',
            'North Korea': 'northKoreaLow',
            'South Africa': 'southAfricaLow',
            'New Zealand': 'newZealandLow',
            'Czech Republic': 'czechRepublicLow',
            'Bosnia and Herzegovina': 'bosniaHerzegovinaLow',
            'North Macedonia': 'macedoniaLow',
            'Dominican Republic': 'dominicanRepublicLow',
            'Costa Rica': 'costaRicaLow',
            'El Salvador': 'elSalvadorLow',
            'Puerto Rico': 'puertoRicoLow',
            'Hong Kong': 'hongKongLow',
            'Papua New Guinea': 'papuaNewGuineaLow',
            'Solomon Islands': 'solomonIslandsLow',
            'Marshall Islands': 'marshallIslandsLow',
            'Vatican City': 'vaticanCityLow',
            'San Marino': 'sanMarinoLow',
            'Saudi Arabia': 'saudiArabiaLow',
            'United Arab Emirates': 'unitedArabEmiratesLow',
            'Sri Lanka': 'sriLankaLow',
            'Ivory Coast': 'ivoryCoastLow'
        };
        
        if (nameMap[countryName]) {
            return nameMap[countryName];
        }
        
        // Default: remove spaces and make lowercase + "Low"
        return countryName.toLowerCase().replace(/\s+/g, '') + 'Low';
    }

    try {
        // Try loading comprehensive countries.json first
        if (fs.existsSync(countriesPath)) {
            COUNTRIES = JSON.parse(fs.readFileSync(countriesPath, 'utf8'));
            console.log(`[Guess the Country] Loaded ${COUNTRIES.length} countries from countries.json`);
        } else {
            // Fallback to flags.json if countries.json doesn't exist yet
            console.log('[Guess the Country] countries.json not found, using flags.json as fallback');
            const flagsPath = path.join(__dirname, '..', 'data', 'flags.json');
            if (fs.existsSync(flagsPath)) {
                const flags = JSON.parse(fs.readFileSync(flagsPath, 'utf8'));
                COUNTRIES = flags.map(flag => ({
                    name: flag.name,
                    emoji: flag.emoji,
                    code: flag.code,
                    aliases: flag.aliases,
                    flagUrl: flag.url || `https://flagcdn.com/w320/${flag.code}.png`,
                    capital: null,
                    capitalAliases: [],
                    borders: flag.borders || [],
                    outlineUrl: `https://www.amcharts.com/lib/3/maps/svg/${getAmChartsMapName(flag.name)}.svg`,
                    landmarks: []
                }));
                console.log('[Guess the Country] Limited to flag questions only until countries.json is created');
            } else {
                console.error('Neither countries.json nor flags.json found! Feature disabled.');
                return;
            }
        }
    } catch (err) {
        console.error('Error loading country data:', err);
        return;
    }

    // Load landmarks data
    const landmarksPath = path.join(__dirname, '..', 'data', 'landmarks.json');
    let LANDMARKS = {};

    try {
        if (fs.existsSync(landmarksPath)) {
            LANDMARKS = JSON.parse(fs.readFileSync(landmarksPath, 'utf8'));
        }
    } catch (err) {
        console.error('Error loading landmarks.json:', err);
    }

    const dataPath = path.join(__dirname, '..', 'data', 'guessthecountry.json');

    // Game state per channel
    const gameStates = {};

    // Skip cooldown tracker
    const skipCooldowns = {}; // { channelId: { userId: timestamp } }

    function loadGameData() {
        try {
            if (fs.existsSync(dataPath)) {
                const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
                return data;
            }
        } catch (error) {
            console.error('Error loading guessthecountry.json:', error);
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
            console.error('Error saving guessthecountry.json:', error);
        }
    }

    function getRandomCountry() {
        return COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
    }

    function normalizeAnswer(answer) {
        return answer.toLowerCase().trim().replace(/[^a-z\s]/g, '');
    }

    function isCorrectGuess(guess, correctAnswer, aliases = []) {
        const normalized = normalizeAnswer(guess);
        const correctNormalized = normalizeAnswer(correctAnswer);
        
        if (normalized === correctNormalized) return true;
        
        // Check aliases
        for (const alias of aliases) {
            if (normalized === normalizeAnswer(alias)) return true;
        }
        
        return false;
    }

    // Check if a URL returns 200 (exists) or 404 (not found)
    function checkUrlExists(url) {
        return new Promise((resolve) => {
            https.get(url, (res) => {
                if (res.statusCode === 200) {
                    resolve(true);
                } else if (res.statusCode === 404) {
                    console.error(`[Guess the Country] 404 Error: Outline not found at ${url}`);
                    resolve(false);
                } else {
                    console.warn(`[Guess the Country] Unexpected status ${res.statusCode} for ${url}`);
                    resolve(false);
                }
                res.resume(); // Consume response to free up memory
            }).on('error', (err) => {
                console.error(`[Guess the Country] Error checking URL ${url}:`, err.message);
                resolve(false);
            });
        });
    }

    // Download SVG, convert to PNG, and cache on disk
    async function convertAndCacheSvg(svgUrl, countryCode) {
        const cacheDir = path.join(__dirname, '..', 'data', 'images', 'png_maps');
        const pngPath = path.join(cacheDir, `${countryCode}.png`);

        // Check if already cached
        if (fs.existsSync(pngPath)) {
            console.log(`[Guess the Country] Using cached PNG for ${countryCode}`);
            return pngPath;
        }

        // Create cache directory if it doesn't exist
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }

        console.log(`[Guess the Country] Converting ${countryCode} SVG to PNG: ${svgUrl}`);

        return new Promise((resolve, reject) => {
            https.get(svgUrl, (res) => {
                if (res.statusCode !== 200) {
                    console.error(`[Guess the Country] Failed to download SVG for ${countryCode}: ${res.statusCode}`);
                    return reject(new Error(`HTTP ${res.statusCode}`));
                }

                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', async () => {
                    try {
                        const svgBuffer = Buffer.concat(chunks);
                        
                        // Convert SVG to PNG using sharp
                        // Use 'inside' fit to ensure the entire image fits within bounds and scales proportionally
                        // Lower density to avoid rendering issues with some SVGs
                        await sharp(svgBuffer, { density: 150 })
                            .resize(800, 800, { 
                                fit: 'inside',
                                withoutEnlargement: false,
                                background: { r: 255, g: 255, b: 255, alpha: 0 }
                            })
                            .trim() // Remove any excess transparent borders
                            .png()
                            .toFile(pngPath);
                        
                        console.log(`[Guess the Country] Successfully converted and cached ${countryCode}`);
                        resolve(pngPath);
                    } catch (err) {
                        console.error(`[Guess the Country] Error converting SVG for ${countryCode}:`, err);
                        reject(err);
                    }
                });
            }).on('error', (err) => {
                console.error(`[Guess the Country] Error downloading SVG for ${countryCode}:`, err);
                reject(err);
            });
        });
    }

    function selectRandomQuestionType(weights = DEFAULT_WEIGHTS) {
        // Filter out question types that can't be used due to missing data
        const availableTypes = {};
        let totalWeight = 0;

        for (const [type, weight] of Object.entries(weights)) {
            // Check if we have the necessary data for this question type
            let canUse = true;

            if (type === QUESTION_TYPES.COUNTRY_TO_CAPITAL || type === QUESTION_TYPES.CAPITAL_TO_COUNTRY) {
                // Need countries with capitals
                canUse = COUNTRIES.some(c => c.capital);
            } else if (type === QUESTION_TYPES.OUTLINE_TO_COUNTRY) {
                // Need countries with outline URLs
                canUse = COUNTRIES.some(c => c.outlineUrl);
            } else if (type === QUESTION_TYPES.BORDERS_TO_COUNTRY) {
                // Need countries with borders
                canUse = COUNTRIES.some(c => c.borders && c.borders.length > 0);
            } else if (type === QUESTION_TYPES.LANDMARK_TO_COUNTRY) {
                // Need landmark data
                canUse = Object.keys(LANDMARKS).length > 0;
            }

            if (canUse) {
                availableTypes[type] = weight;
                totalWeight += weight;
            }
        }

        // Weighted random selection
        const random = Math.random() * totalWeight;
        let cumulative = 0;

        for (const [type, weight] of Object.entries(availableTypes)) {
            cumulative += weight;
            if (random <= cumulative) {
                return type;
            }
        }

        // Fallback to flag question
        return QUESTION_TYPES.FLAG_TO_COUNTRY;
    }

    async function generateQuestion(type, country) {
        const question = {
            type: type,
            country: country.name,
            emoji: country.emoji,
            correctAnswer: country.name,
            aliases: country.aliases
        };

        switch (type) {
            case QUESTION_TYPES.FLAG_TO_COUNTRY:
                question.title = '🚩 Guess the Country!';
                question.description = 'What country does this flag belong to?';
                question.imageUrl = country.flagUrl;
                question.answer = country.name;
                break;

            case QUESTION_TYPES.COUNTRY_TO_CAPITAL:
                question.title = '🏛️ What is the capital?';
                question.description = `What is the capital of **${country.name}** ${country.emoji}?`;
                question.correctAnswer = country.capital;
                question.aliases = country.capitalAliases || [];
                break;

            case QUESTION_TYPES.CAPITAL_TO_COUNTRY:
                question.title = '🗺️ Which country?';
                question.description = `**${country.capital}** is the capital of which country?`;
                question.imageUrl = country.flagUrl;
                question.answer = country.name;
                break;

            case QUESTION_TYPES.OUTLINE_TO_COUNTRY:
                try {
                    // Convert SVG to PNG and cache it
                    const pngPath = await convertAndCacheSvg(country.outlineUrl, country.code);
                    question.title = '🗺️ Guess the Country!';
                    question.description = 'What country has this outline/shape?';
                    question.imageUrl = `attachment://${country.code}.png`;
                    question.filePath = pngPath; // Store file path for attachment
                    question.fileAttachmentName = `${country.code}.png`; // Store attachment name
                    question.answer = country.name;
                    console.log(`[Guess the Country] Generated outline question for ${country.name}`);
                } catch (err) {
                    console.error(`[Guess the Country] Failed to generate outline for ${country.name}:`, err);
                    return null; // Return null if conversion fails
                }
                break;

            case QUESTION_TYPES.BORDERS_TO_COUNTRY:
                // Get neighboring country names (filter out countries not in our database)
                const borderNames = country.borders
                    .map(code => {
                        const neighbor = COUNTRIES.find(c => c.code.toUpperCase() === code.toUpperCase());
                        return neighbor ? neighbor.name : null;
                    })
                    .filter(name => name !== null);
                
                question.title = '🧭 Guess the Country!';
                question.description = `What country borders: **${borderNames.join(', ')}**?`;
                question.answer = country.name;
                break;

            case QUESTION_TYPES.LANDMARK_TO_COUNTRY:
                const landmarks = LANDMARKS[country.name] || [];
                if (landmarks.length > 0) {
                    const landmark = landmarks[Math.floor(Math.random() * landmarks.length)];
                    question.title = '🏛️ Guess the Country!';
                    question.description = `What country is this landmark/monument in?\n*${landmark.name}*`;
                    question.imageUrl = landmark.url;
                    question.answer = country.name;
                }
                break;
        }

        return question;
    }

    function isAdmin(member) {
        return member.permissions.has('Administrator') || member.permissions.has('ManageGuild');
    }

    async function startNewRound(channelId) {
        const channel = await client.channels.fetch(channelId);
        if (!channel) return;

        const gameState = gameStates[channelId];

        // Select question type
        const questionType = selectRandomQuestionType();
        console.log(`[Guess the Country] Selected question type: ${questionType}`);
        
        // Get appropriate country based on question type
        let country = null;
        let attempts = 0;
        const maxAttempts = 50;

        while (!country && attempts < maxAttempts) {
            const candidate = getRandomCountry();
            
            // Validate candidate has required data for this question type
            let valid = true;
            
            if (questionType === QUESTION_TYPES.COUNTRY_TO_CAPITAL || questionType === QUESTION_TYPES.CAPITAL_TO_COUNTRY) {
                valid = candidate.capital !== null && candidate.capital !== '';
            } else if (questionType === QUESTION_TYPES.OUTLINE_TO_COUNTRY) {
                // Just check if outline URL is configured
                valid = candidate.outlineUrl !== null;
            } else if (questionType === QUESTION_TYPES.BORDERS_TO_COUNTRY) {
                // Check that country has borders AND that at least one neighbor exists in our database
                if (candidate.borders && candidate.borders.length > 0) {
                    const validNeighbors = candidate.borders.filter(code => 
                        COUNTRIES.some(c => c.code.toUpperCase() === code.toUpperCase())
                    );
                    valid = validNeighbors.length > 0;
                } else {
                    valid = false;
                }
            } else if (questionType === QUESTION_TYPES.LANDMARK_TO_COUNTRY) {
                valid = LANDMARKS[candidate.name] && LANDMARKS[candidate.name].length > 0;
            }
            
            if (valid) {
                country = candidate;
            }
            attempts++;
        }

        if (!country) {
            // Fallback to flag question with any country
            country = getRandomCountry();
            const question = await generateQuestion(QUESTION_TYPES.FLAG_TO_COUNTRY, country);
            gameState.currentQuestion = question;
        } else {
            const question = await generateQuestion(questionType, country);
            // If question generation failed (e.g., SVG conversion failed), fall back to flag question
            if (!question || !question.title) {
                const fallbackQuestion = await generateQuestion(QUESTION_TYPES.FLAG_TO_COUNTRY, country);
                gameState.currentQuestion = fallbackQuestion;
            } else {
                gameState.currentQuestion = question;
            }
        }

        gameState.votes = {};
        gameState.voters = new Set();
        gameState.isTransitioning = false;
        gameState.roundStartTime = Date.now();

        console.log(`[Guess the Country] New round started in ${channel.name} - Type: ${gameState.currentQuestion.type}, Answer: ${gameState.currentQuestion.correctAnswer} ${gameState.currentQuestion.emoji}`);

        const embed = new EmbedBuilder()
            .setTitle(gameState.currentQuestion.title)
            .setDescription(
                (gameState.currentQuestion.description || '') +
                '\n\n**How to play:**\n• Type `!` followed by your answer (e.g., `!France`)\n• Type `?` to skip (-1 point, 1 min cooldown)'
            )
            .setColor('#5865F2')
            .setFooter({ text: 'First to guess correctly wins!' });

        if (gameState.currentQuestion.imageUrl) {
            embed.setImage(gameState.currentQuestion.imageUrl);
        }

        // Send with attachment if it's an outline question with a file
        const messageOptions = { embeds: [embed] };
        if (gameState.currentQuestion.filePath && gameState.currentQuestion.fileAttachmentName) {
            const attachment = new AttachmentBuilder(gameState.currentQuestion.filePath, { 
                name: gameState.currentQuestion.fileAttachmentName 
            });
            messageOptions.files = [attachment];
        }

        await channel.send(messageOptions);
    }

    // Initialize game states for configured channels
    const savedData = loadGameData();
    for (const channelId of GUESS_COUNTRY_CHANNELS) {
        gameStates[channelId] = {
            currentQuestion: null,
            votes: {},
            voters: new Set(),
            scores: savedData[channelId]?.scores || {},
            isTransitioning: false,
            roundStartTime: 0
        };
        skipCooldowns[channelId] = {};
    }

    // Start first round when bot is ready
    client.once('clientReady', () => {
        for (const channelId of GUESS_COUNTRY_CHANNELS) {
            startNewRound(channelId);
        }
    });

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!GUESS_COUNTRY_CHANNELS.includes(message.channel.id)) return;

        const gameState = gameStates[message.channel.id];
        if (!gameState || !gameState.currentQuestion) return;
        
        // Block all guesses during round transition
        if (gameState.isTransitioning) return;

        const content = message.content.trim();

        // ?country commands (admin only)
        if (content.startsWith('?country ')) {
            if (!isAdmin(message.member)) {
                await message.reply('❌ This command is admin only.').catch(() => {});
                return;
            }

            const args = content.slice(9).trim().split(' ');
            const subcommand = args[0].toLowerCase();

            // ?country get - show current answer (DM only)
            if (subcommand === 'get') {
                console.log(`[Guess the Country] ${message.author.tag} used ?country get command - Answer: ${gameState.currentQuestion.correctAnswer}`);
                const embed = new EmbedBuilder()
                    .setTitle('🔍 Current Answer')
                    .setDescription(`**${gameState.currentQuestion.correctAnswer}** ${gameState.currentQuestion.emoji}`)
                    .setColor('#5865F2');

                // Send as DM to keep it private
                try {
                    await message.author.send({ embeds: [embed] });
                    await message.react('✅').catch(() => {});
                } catch (err) {
                    console.error(`[Guess the Country] Could not DM ${message.author.tag}:`, err);
                    await message.reply('❌ Could not send DM. Please check your privacy settings.').catch(() => {});
                }
                return;
            }

            // ?country set [answer] - set the answer without resending question
            if (subcommand === 'set') {
                const newAnswer = args.slice(1).join(' ').trim();
                if (!newAnswer) {
                    await message.reply('❌ Usage: `?country set <country name>`').catch(() => {});
                    return;
                }

                // Find matching country
                const country = COUNTRIES.find(c => 
                    normalizeAnswer(c.name) === normalizeAnswer(newAnswer) ||
                    (c.aliases && c.aliases.some(alias => normalizeAnswer(alias) === normalizeAnswer(newAnswer)))
                );

                if (!country) {
                    await message.reply(`❌ Country not found: ${newAnswer}`).catch(() => {});
                    return;
                }

                // Update the current answer
                gameState.currentQuestion.correctAnswer = country.name;
                gameState.currentQuestion.emoji = country.emoji;
                gameState.currentQuestion.aliases = country.aliases;
                gameState.currentQuestion.country = country.name;

                console.log(`[Guess the Country] ${message.author.tag} changed answer to: ${country.name}`);
                await message.react('✅').catch(() => {});
                return;
            }

            // ?country send [code] [type] - manually send a specific question
            if (subcommand === 'send') {
                const countryCode = args[1]?.toLowerCase();
                const questionType = args[2]?.toLowerCase();

                if (!countryCode) {
                    await message.reply('❌ Usage: `?country send <country_code> [question_type]`\nTypes: flag, capital, capitalto, outline, borders, landmark').catch(() => {});
                    return;
                }

                // Find country by code
                const country = COUNTRIES.find(c => c.code.toLowerCase() === countryCode);
                if (!country) {
                    await message.reply(`❌ Country not found with code: ${countryCode}`).catch(() => {});
                    return;
                }

                // Determine question type
                let selectedType = QUESTION_TYPES.FLAG_TO_COUNTRY; // default
                if (questionType) {
                    const typeMap = {
                        'flag': QUESTION_TYPES.FLAG_TO_COUNTRY,
                        'capital': QUESTION_TYPES.COUNTRY_TO_CAPITAL,
                        'capitalto': QUESTION_TYPES.CAPITAL_TO_COUNTRY,
                        'outline': QUESTION_TYPES.OUTLINE_TO_COUNTRY,
                        'borders': QUESTION_TYPES.BORDERS_TO_COUNTRY,
                        'landmark': QUESTION_TYPES.LANDMARK_TO_COUNTRY
                    };
                    selectedType = typeMap[questionType] || QUESTION_TYPES.FLAG_TO_COUNTRY;
                }

                // Generate and send the question
                console.log(`[Guess the Country] ${message.author.tag} manually sending ${selectedType} question for ${country.name}`);
                
                const question = await generateQuestion(selectedType, country);
                if (!question || !question.title) {
                    await message.reply('❌ Failed to generate question for this country/type combination.').catch(() => {});
                    return;
                }

                // Update game state
                gameState.currentQuestion = question;
                gameState.votes = {};
                gameState.voters = new Set();
                gameState.isTransitioning = false;
                gameState.roundStartTime = Date.now();

                const embed = new EmbedBuilder()
                    .setTitle(gameState.currentQuestion.title)
                    .setDescription(
                        (gameState.currentQuestion.description || '') +
                        '\n\n**How to play:**\n• Type `!` followed by your answer (e.g., `!France`)\n• Type `?` to skip (-1 point, 1 min cooldown)'
                    )
                    .setColor('#5865F2')
                    .setFooter({ text: 'First to guess correctly wins!' });

                if (gameState.currentQuestion.imageUrl) {
                    embed.setImage(gameState.currentQuestion.imageUrl);
                }

                // Send with attachment if it's an outline question with a file
                const messageOptions = { embeds: [embed] };
                if (gameState.currentQuestion.filePath && gameState.currentQuestion.fileAttachmentName) {
                    const attachment = new AttachmentBuilder(gameState.currentQuestion.filePath, { 
                        name: gameState.currentQuestion.fileAttachmentName 
                    });
                    messageOptions.files = [attachment];
                }

                await message.channel.send(messageOptions);
                await message.react('✅').catch(() => {});
                return;
            }

            // ?country types - list active question types
            if (subcommand === 'types') {
                console.log(`[Guess the Country] ${message.author.tag} used ?country types command`);
                const types = [
                    '🚩 Flag → Country',
                    '🏛️ Country → Capital',
                    '🗺️ Capital → Country',
                    '🗺️ Country Outline',
                    '🧭 Neighboring Countries',
                    '🏛️ Landmark/Monument'
                ];

                const embed = new EmbedBuilder()
                    .setTitle('📋 Active Question Types')
                    .setDescription(types.join('\n'))
                    .setColor('#5865F2');

                await message.reply({ embeds: [embed] }).catch(() => {});
                return;
            }

            return;
        }

        // Skip to next question (? command)
        if (content === '?') {
            const userId = message.author.id;
            const now = Date.now();
            const timeSinceRoundStart = now - gameState.roundStartTime;
            const SKIP_COOLDOWN = 60000; // 1 minute in milliseconds

            // Check if round has been active for at least 1 minute
            if (timeSinceRoundStart < SKIP_COOLDOWN) {
                const remainingTime = Math.ceil((SKIP_COOLDOWN - timeSinceRoundStart) / 1000);
                await message.channel.send(`⏳ You must wait ${remainingTime} more seconds before skipping.`).catch(() => {});
                return;
            }

            // Check per-user cooldown
            const lastSkip = skipCooldowns[message.channel.id][userId] || 0;
            const timeSinceLastSkip = now - lastSkip;

            if (timeSinceLastSkip < SKIP_COOLDOWN) {
                const remainingTime = Math.ceil((SKIP_COOLDOWN - timeSinceLastSkip) / 1000);
                await message.channel.send(`⏳ You can skip again in ${remainingTime} seconds.`).catch(() => {});
                return;
            }

            // Subtract 1 point
            gameState.scores[userId] = (gameState.scores[userId] || 0) - 1;
            saveGameData();

            // Update skip cooldown
            skipCooldowns[message.channel.id][userId] = now;

            console.log(`[Guess the Country] ${message.author.tag} skipped - Answer was: ${gameState.currentQuestion.correctAnswer} (Score: ${gameState.scores[userId]})`);
            gameState.isTransitioning = true;
            const embed = new EmbedBuilder()
                .setTitle('⏭️ Question Skipped')
                .setDescription(
                    `The correct answer was: **${gameState.currentQuestion.correctAnswer}** ${gameState.currentQuestion.emoji}\n\n` +
                    `${message.author} lost 1 point for skipping.`
                )
                .setColor('#FEE75C')
                .setFooter({ text: `Skipped by ${message.author.tag}` });

            await message.channel.send({ embeds: [embed] });
            setTimeout(() => startNewRound(message.channel.id), 3000);
            return;
        }

        // Check for guess (starts with !)
        if (content.startsWith('!')) {
            const guess = content.slice(1).trim();
            if (!guess) return;

            // Check if correct
            if (isCorrectGuess(guess, gameState.currentQuestion.correctAnswer, gameState.currentQuestion.aliases)) {
                // Block further guesses during transition
                gameState.isTransitioning = true;
                
                // Winner!
                const userId = message.author.id;
                gameState.scores[userId] = (gameState.scores[userId] || 0) + 1;
                saveGameData();

                console.log(`[Guess the Country] ✅ ${message.author.tag} guessed correctly: ${gameState.currentQuestion.correctAnswer} (Score: ${gameState.scores[userId]})`);
                const embed = new EmbedBuilder()
                    .setTitle('🎉 Correct!')
                    .setDescription(
                        `**${message.author}** guessed it right!\n\n` +
                        `The answer was: **${gameState.currentQuestion.correctAnswer}** ${gameState.currentQuestion.emoji}`
                    )
                    .addFields({ name: '🏆 Score', value: `${gameState.scores[userId]} points`, inline: true })
                    .setColor('#57F287');

                await message.channel.send({ embeds: [embed] });
                await message.react('✅');

                // Start new round after delay
                setTimeout(() => startNewRound(message.channel.id), 3000);
            } else {
                // Wrong guess
                console.log(`[Guess the Country] ❌ ${message.author.tag} guessed wrong: "${guess}" (Answer: ${gameState.currentQuestion.correctAnswer})`);
                await message.react('❌');
            }
        }
    });

    console.log('[Guess the Country] Feature loaded. Active channels:', GUESS_COUNTRY_CHANNELS.join(', '));
    console.log('[Guess the Country] 6 question types available.');

    // Register /stats slash command
    const statsCommand = new SlashCommandBuilder()
        .setName('countrystats')
        .setDescription('View Guess the Country leaderboard and statistics')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('View stats for a specific user')
                .setRequired(false)
        );

    return {
        commands: [statsCommand],
        handler: async (interaction) => {
            if (interaction.commandName === 'countrystats') {
                const channelId = interaction.channel.id;
                const gameState = gameStates[channelId];

                if (!gameState) {
                    await interaction.reply('❌ This channel is not configured for Guess the Country.');
                    return;
                }

                const targetUser = interaction.options.getUser('user');

                if (targetUser) {
                    // Show stats for specific user
                    const score = gameState.scores[targetUser.id] || 0;
                    const embed = new EmbedBuilder()
                        .setTitle('🌍 Guess the Country Stats')
                        .setDescription(`**${targetUser.username}** has **${score}** points`)
                        .setColor('#5865F2')
                        .setThumbnail(targetUser.displayAvatarURL());

                    await interaction.reply({ embeds: [embed] });
                } else {
                    // Show leaderboard
                    const sortedScores = Object.entries(gameState.scores)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 10);

                    if (sortedScores.length === 0) {
                        await interaction.reply('📊 No scores yet! Start playing to get on the leaderboard.');
                        return;
                    }

                    const leaderboardText = await Promise.all(
                        sortedScores.map(async ([userId, score], index) => {
                            try {
                                const user = await client.users.fetch(userId);
                                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                                return `${medal} **${user.username}** - ${score} points`;
                            } catch {
                                return `${index + 1}. Unknown User - ${score} points`;
                            }
                        })
                    );

                    const embed = new EmbedBuilder()
                        .setTitle('🏆 Guess the Country Leaderboard')
                        .setDescription(leaderboardText.join('\n'))
                        .setColor('#5865F2')
                        .setFooter({ text: 'Top 10 players' });

                    await interaction.reply({ embeds: [embed] });
                }
            }
        }
    };
};
