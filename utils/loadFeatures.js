const fs = require('fs');
const path = require('path');

/**
 * Loads all feature modules from the given directory.
 * @param {string} featuresDir - Absolute path to the features directory.
 * @returns {Array} Array of loaded feature modules.
 */
function loadFeatures(featuresDir) {
  if (!fs.existsSync(featuresDir)) {
    throw new Error(`Features directory does not exist: ${featuresDir}`);
  }
  const featureFiles = fs.readdirSync(featuresDir).filter(f => f.endsWith('.js'));
  console.log('[Loader] Loading features:', featureFiles);
  const loaded = featureFiles.map(f => {
    const mod = require(path.join(featuresDir, f));
    console.log(`[Loader] Loaded feature: ${f}`);
    return mod;
  });
  return loaded;
}

module.exports = loadFeatures;
