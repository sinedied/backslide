const path = require('path');
const fs = require('fs-extra');
const child = require('child_process');
const Progress = require('progress');
const util = require('./util');
const exportHtml = require('./export');
const {TempDir} = require('./constants');

/**
 * Exports markdown files as pdf using an existing Decktape install.
 * @param {string} output The ouput dir.
 * @param {string[]} files The markdown files.
 * @param {object} options Export options.
 * Possible options:
 * - {number} wait Wait time between slides in ms.
 * - {boolean} stripFragments True to strip presention fragments (useful for handouts).
 * - {boolean} verbose Show decktape console output.
 * - {boolean} inline True to inline external resources.
 * - {boolean} decktapeOptions Additional Decktape options.
 * @return Promise<string[]> The exported files.
 */
async function pdf(output, files, options) {
  try {
    files = util.getFiles(files);
    util.checkTemplate();
    fs.mkdirpSync(output);
    const progress = new Progress(':percent converting pdf :count/:total', {total: files.length});
    let count = 0;

    const exportedFiles = await exportHtml(
      path.join(TempDir, 'pdf'),
      files,
      {
        stripNotes: false,
        stripFragments: options.stripFragments,
        fixRelativePath: true,
        inline: options.inline
      }
    );
    exportedFiles.forEach(file => {
      progress.render({count: ++count});
      const exportedFile = path.basename(file, path.extname(file)) + '.pdf';
      exportedFiles.push(exportedFile);
      child.execSync(
        [
          'node',
          require.resolve('decktape'),
          `-p ${options.wait}`,
          `file://${path.resolve(file)}`,
          path.join(output, exportedFile),
          ...options.decktapeOptions
        ].join(' '),
        {
          stdio: options.verbose ? [1, 2] : [2]
        }
      );
      progress.tick({count});
    });
  } catch (err) {
    util.exit(`\nAn error occurred during pdf conversion: ${(err && err.message) || err}`);
  }
}

module.exports = pdf;
