const path = require('path');
const fs = require('fs-extra');
const util = require('../util');
const {StarterDir, TemplateDir} = require('../constants');

/**
 * Creates the template directory with a presentation starter in the current directory.
 * @param {string} fromTemplateDir A custom template directory.
 * @param {boolean} force Overwrite existing files.
 */
function init(fromTemplateDir, force) {
  if (!force && fs.existsSync(path.join(TemplateDir))) {
    util.exit(`Template directory already exists`);
  }
  fromTemplateDir = fromTemplateDir ? path.resolve(fromTemplateDir) : path.join(__dirname, StarterDir, TemplateDir);
  try {
    fs.copySync(fromTemplateDir, TemplateDir);
    fs.copySync(path.join(__dirname, StarterDir, 'presentation.md'), './presentation.md');
    console.info('Presentation initialized successfully');
  } catch (err) {
    util.exit((err && err.message) || err);
  }
}

module.exports = init;
