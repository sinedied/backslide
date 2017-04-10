'use strict';

const pkg = require('./package.json');
const child = require('child_process');
const path = require('path');
const fs = require('fs-promise');
const glob = require('glob');
const Mustache = require('mustache');
const sass = require('node-sass');
const Inliner = require('inliner');
const Progress = require('progress');
const browserSync = require('browser-sync').create('bs-server');

const TempDir = '.tmp';
const TemplateDir = './template';
const isWindows = /^win/.test(process.platform);

const help =
`${pkg.name} ${pkg.version}
Usage: bs [init|serve|export|pdf] [options]

Commands:
  i, init            Init new slideshow in current directory
  e, export [files]  Export markdown files to html slideshows [default: *.md]
    -o, --output     Output directory                         [default: dist]
  s, serve [dir]     Start dev server for specified directory [default: .]
    -p, --port       Port number to listen on                 [default: 4100]
  p, pdf [files]     Export markdown files to pdf             [default: *.md]
    -o, --output     Output directory                         [default: pdf]
    -d, --decktape   Decktape installation dir                [default: .]
    --verbose        Show Decktape console output

 For pdf export to work, Decktape must be installed.
 See https://github.com/astefanutti/decktape for details.
`;

class BackslideCli {

  constructor(args) {
    this._stderrWrite = process.stderr.write;
    this._pwd = process.cwd();
    this._args = args;
    if (args != null) {
      this._runCommand();
    }
  }

  init() {
    if (fs.existsSync(path(TemplateDir, 'index.html')) || fs.existsSync(path.join(TemplateDir, 'style.scss'))) {
      this._exit('"template" already in current directory');
    }
    try {
      fs.copySync(path.join(__dirname, '..', TemplateDir), '.')
      // TODO: create dummy markdown file
      console.info('Slideshow initialized successfully');
    } catch (err) {
      this._exit(err);
    }
  }

  /**
   * Exports markdown files as pdf using an existing Decktape install.
   * @param {string} output The ouput dir.
   * @param {string[]} files The markdown files.
   * @return Promise<string[]> The exported files.
   */
  pdf(output, decktape, files, verbose) {
    files = files || glob.sync('*.md');
    this._checkFiles(files);

    // TODO: Check decktape install && files

    fs.mkdirpSync(output);

    let count = 0;
    const exportedFiles = [];
    const progress = new Progress(':percent converting pdf :count/:total', { total: files.length });
    return this.export(path.join(TempDir, 'pdf'), files)
      .then((exportedFiles) => {
        exportedFiles.forEach(file => {
          progress.render({ count: ++count });
          const exportedFile = path.basename(file, path.extname(file)) + '.pdf';
          exportedFiles.push(exportedFile);
          child.execSync([
              path.join(decktape, 'phantomjs'),
              path.join(decktape, 'decktape.js'),
              file,
              path.join(output, exportedFile)
            ].join(' '), {
              stdio: verbose ? [1, 2] : [2]
            }
          );
          progress.tick({ count: count });
        });
      })
      .then(() => exportedFiles);
  }

  serve(dir, port) {
    // TODO: check template folder existence

    dir = dir || '.';
    fs.removeSync(TempDir);
    // TODO: use node-sass programmatically
    // Compile scss once first as there's an issue with watch
    child.execSync(`node ./node_modules/.bin/node-sass ${path.join(TemplateDir, 'style.scss')} -o ${TempDir}`);
    // Run node-sass in watch mode
    const scssWatch = child.spawn('node', [
      './node_modules/.bin/node-sass',
      '-w',
      path.join(TemplateDir, 'style.scss'),
      '-o',
      TempDir
    ]);
    scssWatch.stdout.pipe(process.stdout);
    scssWatch.stderr.pipe(process.stderr);

    let pattern = path.join(dir, '*.md');
    if (isWindows) {
      // glob only works with forward slashes
      pattern = pattern.replace(/\\/g, '/');
    }
    const files = glob.sync(pattern);
    this._checkFiles(files);

    let count = 0;
    const promise = Promise.resolve();
    const nextFile = () => promise.then(() => {
      if (count < files.length) {
        const file = files[count++];
        return this._serveFile(TempDir, file)
          .then(nextFile);
      }
    });
    return nextFile()
      .then(() => this._startServer(dir, port));
  }

  _startServer(dir, port) {
    browserSync.init({
      ui: false,
      injectChanges: true,
      port: port,
      files: [
        path.join(TemplateDir, '*.{html,css,js}'),
        path.join(TempDir, '*.{html,css,js}'),
        path.join(dir, '*.md')
      ],
      server: {
        baseDir: [TempDir, dir],
        directory: true
      },
      watchOptions: {
        ignored: 'node_modules'
      }
    });
  }

  _serveFile(dir, file) {
    return fs.readFile(path.join(TemplateDir, 'index.html'))
      .then(buffer => Mustache.render(buffer.toString(), {
        source: `sourceUrl: '${path.basename(file)}'`,
        style: `<link rel="stylesheet" href="style.css">`
      }))
      .then(html => {
        const filename = path.basename(file, path.extname(file)) + '.html';
        return fs.outputFile(path.join(TempDir, filename), html);
      });
  }

  /**
   * Exports markdown files as html slideshows.
   * @param {string} output The ouput dir.
   * @param {string[]} files The markdown files.
   * @return Promise<string[]> The exported files.
   */
  export(output, files) {
    // TODO: check template folder existence
    files = files || glob.sync('*.md');
    this._checkFiles(files);

    let count = 0;
    const exportedFiles = [];
    const progress = new Progress(':percent exporting file :count/:total', { total: files.length });
    const promise = Promise.resolve();
    const nextFile = () => promise.then(() => {
      if (count < files.length) {
        const file = files[count++];
        progress.render({ count: count });        
        return this._exportFile(output, file)
          .then(exportedFile => exportedFiles.push(exportedFile))
          .then(() => progress.tick({ count: count }))
          .then(nextFile);
      }
    });
    return nextFile()
      .then(() => exportedFiles);
  }

  _exportFile(dir, file) {
    let html, md;
    const filename = path.basename(file, path.extname(file)) + '.html';
    const exportedFile = path.join(dir, filename);
    return Promise.all([
        fs.readFile(file),
        fs.readFile(path.join(TemplateDir, 'index.html')),
        fs.readFile(path.join(TemplateDir, 'style.scss'))
      ])
      .then(buffers => {
        md = JSON.stringify(buffers[0].toString());
        html = buffers[1].toString();
        return this._scss(TemplateDir, buffers[2].toString());
      })
      .then(css => Mustache.render(html, {
        source: `source: ${md}`,
        style: `<style>\n${css}\n</style>`
      }))
      .then(html => {
        this._suppressErrorOutput();
        this._inline(TemplateDir, html)
      })
      .then(html => {
        process.chdir(this._pwd);
        return fs.outputFile(exportedFile, html);
      })
      .then(() => this._restoreErrorOutput())
      .then(() => exportedFile);
  }

  _inline(basedir, html) {
    return new Promise((resolve, reject) => {
      process.chdir(basedir);
      new Inliner({
        source: html,
        inlinemin: true,
        // Must be disabled because it's buggy, see https://github.com/remy/inliner/issues/63
        collapseWhitespace: false,
        // compressCSS: false,
        // compressJS: false,
      },
      (err, html) => err ? reject(err) : resolve(html));
    });
  }

  _scss(basedir, scss) {
    return new Promise((resolve, reject) => {
      sass.render({
        data: scss,
        includePaths: [TemplateDir]
      },
      (err, result) => err ? reject(err) : resolve(result.css));
    });
  }

  _checkFiles(files) {
    if (files.length === 0) {
      this._exit('No markdown files found');
    }
  }

  _suppressErrorOutput() {
    process.stderr.write = (data, encoding, callback) => {
      if (callback) {
        callback();
      }
      return true;
    };
  }

  _restoreErrorOutput() {
    return new Promise((resolve) => {
      process.stderr.once('drain', () => {
        process.stderr.write = this._stderrWrite;
        resolve();
      });
      // Drain before restoring output
      process.stderr.emit('drain');
    });
  }

  _help() {
    this._exit(help);
  }

  _exit(error, code = 1) {
    console.error(error);
    process.exit(code);
  }

  _runCommand() {
    const _ = this._args._;
    switch (_[0]) {
      case 'i':
      case 'init':
        return this.init();
      case 's':
      case 'serve':
        return this.serve(_[1], this._args.port || 4100);
      case 'e':
      case 'export':
        return this.export(this._args.output || 'dist', _.slice(1));
      case 'p':
      case 'pdf':
        return this.pdf(this._args.output || 'pdf', this._args.decktape || '.', _.slice(1), this._args.verbose);
      default:
        this._help();
    }
  }

}

new BackslideCli(require('minimist')(process.argv.slice(2), {
  boolean: ['verbose'],
  string: ['output', 'decktape'],
  number: ['port'],
  alias: {
    o: 'output',
    p: 'port',
    d: 'decktape'
  }
}));

exports = BackslideCli;
