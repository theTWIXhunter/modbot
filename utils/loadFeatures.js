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
  return featureFiles.map(f => require(path.join(featuresDir, f)));
}

module.exports = loadFeatures;
