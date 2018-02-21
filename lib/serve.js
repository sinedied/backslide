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
function serve(dir, port, open) {
  dir = dir || '.';
  let files;
  let count = 0;
  const promise = Promise.resolve();
  const nextFile = () => promise.then(() => {
    if (count < files.length) {
      const file = files[count++];
      return serveFile(TempDir, file)
        .then(nextFile);
    }
  });
  return Promise.resolve()
    .then(() => {
      fs.removeSync(TempDir);
      util.checkTemplate();
      if (!util.isDirectory(dir)) {
        util.exit(`${dir} is not a directory`);
      }
      files = util.getFiles([dir]);
    })
    .then(() => sass())
    .then(css => {
      const cssFile = path.basename(SassTemplate, path.extname(SassTemplate)) + '.css';
      return fs.outputFile(path.join(TempDir, cssFile), css);
    })
    .then(() => {
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
    })
    .then(() => nextFile())
    .then(() => startServer(dir, port, open))
    .catch(err => util.exit(`\nCannot start server: ${(err && err.message) || err}`));
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

function serveFile(dir, file) {
  return fs.readFile(path.join(TemplateDir, HtmlTemplate))
    .then(buffer => Mustache.render(buffer.toString(), {
      source: `sourceUrl: '${path.basename(file)}'`,
      style: `<link rel="stylesheet" href="style.css">`
    }))
    .then(html => {
      const filename = path.basename(file, path.extname(file)) + '.html';
      return fs.outputFile(path.join(TempDir, filename), html);
    });
}

module.exports = serve;
