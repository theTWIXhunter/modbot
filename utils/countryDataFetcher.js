// utils/countryDataFetcher.js
// One-time script to fetch comprehensive country data from REST Countries API
// Run with: node utils/countryDataFetcher.js

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

async function fetchCountryData() {
    console.log('Fetching country data from REST Countries API...');
    
    try {
        const response = await fetch('https://restcountries.com/v3.1/all');
        const countries = await response.json();
        
        // Load existing flags.json for flag codes and aliases
        const flagsPath = path.join(__dirname, '..', 'data', 'flags.json');
        let existingFlags = [];
        
        if (fs.existsSync(flagsPath)) {
            existingFlags = JSON.parse(fs.readFileSync(flagsPath, 'utf8'));
        }
        
        // Create a map for quick lookup
        const flagsMap = {};
        existingFlags.forEach(flag => {
            flagsMap[flag.name.toLowerCase()] = flag;
        });
        
        // Transform and enhance country data
        const enhanced = countries
            .filter(c => c.name && c.name.common) // Filter out invalid entries
            .map(c => {
                const commonName = c.name.common;
                const existing = flagsMap[commonName.toLowerCase()] || {};
                const code = (existing.code || c.cca2.toLowerCase());
                
                return {
                    name: commonName,
                    emoji: existing.emoji || c.flag || '',
                    code: code,
                    aliases: existing.aliases || [],
                    capital: (c.capital && c.capital[0]) ? c.capital[0] : null,
                    capitalAliases: [], // To be manually curated
                    borders: c.borders || [],
                    region: c.region || '',
                    subregion: c.subregion || '',
                    population: c.population || 0,
                    area: c.area || 0,
                    flagUrl: `https://flagcdn.com/w320/${code}.png`,
                    // Placeholders for manually curated data
                    outlineUrl: null,
                    landmarks: []
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
        
        // Save to countries.json
        const outputPath = path.join(__dirname, '..', 'data', 'countries.json');
        fs.writeFileSync(outputPath, JSON.stringify(enhanced, null, 2));
        
        console.log(`✅ Successfully saved ${enhanced.length} countries to data/countries.json`);
        console.log('📝 Note: You may want to manually curate:');
        console.log('   - capitalAliases (e.g., "parijs" for "Paris")');
        console.log('   - outlineUrl (country shape images)');
        console.log('   - landmarks (famous monuments/places)');
        
    } catch (error) {
        console.error('❌ Error fetching country data:', error);
    }
}

// Run if executed directly
if (require.main === module) {
    fetchCountryData();
}

module.exports = fetchCountryData;
