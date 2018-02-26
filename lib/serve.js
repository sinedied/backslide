const path = require('path');
const fs = require('fs-extra');
const child = require('child_process');
const browserSync = require('browser-sync').create('bs-server');
const Mustache = require('mustache');
const util = require('./util');
const sass = require('./sass');
const {TempDir, SassTemplate, HtmlTemplate, TemplateDir} = require('./constants');

/**
 * Starts a development server with live reload.
 * @param {string} dir The directory containing markdown files.
 * @param {number} port The port number to listen on.
 * @param {boolean} open True to open default browser.
 */
async function serve(dir, port, open) {
  try {
    dir = dir || '.';
    fs.removeSync(TempDir);
    util.checkTemplate();
    if (!util.isDirectory(dir)) {
      util.exit(`${dir} is not a directory`);
    }
    const files = util.getFiles([dir]);
    const css = await sass();
    const cssFile = path.basename(SassTemplate, path.extname(SassTemplate)) + '.css';
    await fs.outputFile(path.join(TempDir, cssFile), css);

    // Find node_modules path
    const sassPath = require.resolve('node-sass');
    const nodeModulesPath = sassPath.substr(0, sassPath.lastIndexOf('node-sass'));
    const sassBin = `.bin/node-sass${util.isWindows ? '.cmd' : ''}`;

    // Run node-sass in watch mode (no API >_<)
    child.spawn(
      path.join(nodeModulesPath, sassBin),
      ['-w', path.join(TemplateDir, SassTemplate), '-o', TempDir],
      {stdio: 'inherit'}
    );

    let count = 0;
    const nextFile = async () => {
      if (count < files.length) {
        const file = files[count++];
        await serveFile(TempDir, file);
        return nextFile();
      }
    };

    await nextFile();
    return startServer(dir, port, open);
  } catch (err) {
    util.exit(`\nCannot start server: ${(err && err.message) || err}`);
  }
}

function startServer(dir, port, open) {
  browserSync.init({
    ui: false,
    injectChanges: true,
    notify: false,
    port,
    files: [
      path.join(TemplateDir, '*.{html,css,js}'),
      path.join(TempDir, '*.{html,css,js}'),
      path.join(dir, '*.md')
    ],
    server: {
      baseDir: [TempDir, TemplateDir, dir],
      directory: true
    },
    watchOptions: {
      ignored: 'node_modules'
    },
    browser: open ? undefined : []
  });
}

async function serveFile(dir, file) {
  const buffer = await fs.readFile(path.join(TemplateDir, HtmlTemplate));
  const html = await Mustache.render(buffer.toString(), {
    source: `sourceUrl: '${path.basename(file)}'`,
    style: `<link rel="stylesheet" href="style.css">`
  });
  const filename = path.basename(file, path.extname(file)) + '.html';
  return fs.outputFile(path.join(TempDir, filename), html);
}

module.exports = serve;
