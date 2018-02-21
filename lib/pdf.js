const path = require('path');
const fs = require('fs-extra');
const child = require('child_process');
const Progress = require('progress');
const util = require('./util');
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
function pdf(output, files, options) {
  let count = 0;
  let progress;
  const exportedFiles = [];
  return Promise.resolve()
    .then(() => {
      files = util.getFiles(files);
      util.checkTemplate();
      fs.mkdirpSync(output);
      progress = new Progress(':percent converting pdf :count/:total', {total: files.length});
    })
    .then(() => this.export(
      path.join(TempDir, 'pdf'),
      files,
      {
        stripNotes: false,
        stripFragments: options.stripFragments,
        fixRelativePath: true,
        inline: options.inline
      }
    ))
    .then(exportedFiles => {
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
    })
    .then(() => exportedFiles)
    .catch(err => util.exit(`\nAn error occurred during pdf conversion: ${(err && err.message) || err}`));
}

module.exports = pdf;
