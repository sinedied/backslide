
const path = require('path');
const fs = require('fs-extra');
const Progress = require('progress');
const util = require('../util');
const transform = require('../processings/transform');
const inline = require('../processings/inline');

/**
 * Performs transformations on markdown files.
 * @param {string?} output The ouput dir. If not specified, files will be processed in-place.
 * @param {string[]} files The markdown files.
 * @param {object} options Transformation options.
 * Possible options:
 * - {string} extractImages Extract embedded images to specified dir.
 * - {boolean} embedImages Embed external images.
 * - {boolean} stripNotes True to strip presenter notes.
 * - {boolean} stripFragments True to strip presention fragments (useful for handouts).
 * @return Promise<string[]> The exported files.
 */
async function transformMarkdown(output, files, options) {
  try {
    files = util.getFiles(files);
    if (output) {
      fs.mkdirpSync(output);
    }
    const progress = new Progress(':percent transforming slides :count/:total', {total: files.length});
    let count = 0;

    for (const file of files) {
      progress.render({count: ++count});
      let md = fs.readFileSync(file).toString();

      if (options.stripNotes) {
        md = transform.stripNotes(md);
      }
      if (options.stripFragments) {
        md = transform.stripFragments(md);
      }
      if (options.embedImages) {
        // eslint-disable-next-line no-await-in-loop
        md = await inline.inlineImages(md, path.dirname(file));
      }
      if (options.extractImages) {
        md = inline.extractImages(path.join(output, options.extractImages), md);
      }

      output = output || path.dirname(file);
      fs.outputFileSync(path.join(output, path.basename(file)), md);
      progress.tick({count});
    }
  } catch (err) {
    util.exit(`\nAn error occurred during slides transformation: ${(err && err.message) || err}`);
  }
}

module.exports = transformMarkdown;
