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
const TemplateDir = 'template';
const HtmlTemplate = 'index.html';
const SassTemplate = 'style.scss';
const RemarkScript = 'remark.min.js';
const TitleRegExp = /^title:\s*(.*?)\s*$/gm;
const isWindows = /^win/.test(process.platform);

const help =
`${pkg.name} ${pkg.version}
Usage: bs [init|serve|export|pdf] [options]

Commands:
  i, init            Init new presentation in current directory
    --force          Overwrite existing files
  e, export [files]  Export markdown files to html slides     [default: *.md]
    -o, --output     Output directory                         [default: dist]
  s, serve [dir]     Start dev server for specified directory [default: .]
    -p, --port       Port number to listen on                 [default: 4100]
  p, pdf [files]     Export markdown files to pdf             [default: *.md]
    -o, --output     Output directory                         [default: pdf]
    -d, --decktape   Decktape installation dir                [default: .]
    -w, --wait       Wait time between slides in ms           [default: 1000]
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

  /**
   * Creates the template directory with a presentation starter in the current directory.
   */
  init(force) {
    if (!force && fs.existsSync(path.join(TemplateDir))) {
      this._exit(`Template directory already exists`);
    }
    try {
      fs.copySync(path.join(__dirname, TemplateDir, HtmlTemplate), path.join(TemplateDir, HtmlTemplate));
      fs.copySync(path.join(__dirname, TemplateDir, SassTemplate), path.join(TemplateDir, SassTemplate));
      fs.copySync(path.join(__dirname, TemplateDir, RemarkScript), path.join(TemplateDir, RemarkScript));
      fs.copySync(path.join(__dirname, TemplateDir, 'presentation.md'), './presentation.md');
      console.info('Presentation initialized successfully');
    } catch (err) {
      this._exit(err && err.message || err);
    }
  }

  /**
   * Exports markdown files as pdf using an existing Decktape install.
   * @param {string} output The ouput dir.
   * @param {string} decktape The path to the decktape directory.
   * @param {string[]} files The markdown files.
   * @param {number} wait Wait time between slides in ms.
   * @param {boolean} verbose Show decktape console output.
   * @return Promise<string[]> The exported files.
   */
  pdf(output, decktape, files, wait, verbose) {
    let count = 0;
    let progress;
    const exportedFiles = [];
    return Promise.resolve()
      .then(() => {
        files = this._getFiles(files);
        this._checkDecktape(decktape);
        this._checkTemplate();
        fs.mkdirpSync(output);
        progress = new Progress(':percent converting pdf :count/:total', { total: files.length });
      })
      .then(() => this.export(path.join(TempDir, 'pdf'), files))
      .then((exportedFiles) => {
        exportedFiles.forEach(file => {
          progress.render({ count: ++count });
          const exportedFile = path.basename(file, path.extname(file)) + '.pdf';
          exportedFiles.push(exportedFile);
          child.execSync([
              path.join(decktape, 'phantomjs'),
              path.join(decktape, 'decktape.js'),
              `-p ${wait}`,
              file,
              path.join(output, exportedFile)
            ].join(' '), {
              stdio: verbose ? [1, 2] : [2]
            }
          );
          progress.tick({ count: count });
        });
      })
      .then(() => exportedFiles)
      .catch(err => this._exit(`\nAn error occurred during pdf conversion: ${err && err.message || err}`));
  }

  /**
   * Starts a development server with live reload.
   * @param {string} dir The directory containing markdown files.
   * @param {number} port The ort number to listen on.
   */
  serve(dir, port) {
    dir = dir || '.';
    let files;
    let count = 0;
    const promise = Promise.resolve();
    const nextFile = () => promise.then(() => {
      if (count < files.length) {
        const file = files[count++];
        return this._serveFile(TempDir, file)
          .then(nextFile);
      }
    });
    return Promise.resolve()
      .then(() => {
        fs.removeSync(TempDir);
        this._checkTemplate();
        if (!this._isDirectory(dir)) {
          this._exit(`${dir} is not a directory`);
        }
        files = this._getFiles([dir]);
      })
      .then(() => this._sass())
      .then(css => {
        const cssFile = path.basename(SassTemplate, path.extname(SassTemplate)) + '.css';
        return fs.outputFile(path.join(TempDir, cssFile), css);
      })
      .then(() => {
        // Find node_modules path
        const sassPath = require.resolve('node-sass');
        const nodeModulesPath = sassPath.substr(0, sassPath.lastIndexOf('node-sass'));
        const sassBin = `.bin/node-sass${isWindows ? '.cmd' : ''}`;

        // Run node-sass in watch mode (no API >_<)
        child.spawn(path.join(nodeModulesPath, sassBin), [
            '-w',
            path.join(TemplateDir, SassTemplate),
            '-o',
            TempDir
          ], { stdio: 'inherit' }
        );
      })
      .then(() => nextFile())
      .then(() => this._startServer(dir, port))
      .catch(err => this._exit(`\nCannot start server: ${err && err.message || err}`));
  }

  /**
   * Exports markdown files as html slides.
   * @param {string} output The ouput dir.
   * @param {string[]} files The markdown files.
   * @return Promise<string[]> The exported files.
   */
  export(output, files) {
    let count = 0;
    let progress;
    const exportedFiles = [];
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
    return Promise.resolve()
      .then(() => {
        files = this._getFiles(files);
        this._checkTemplate();
        progress = new Progress(':percent exporting file :count/:total', { total: files.length });
      })
      .then(() => nextFile())
      .then(() => exportedFiles)
      .catch(err => this._exit(`\nAn error occurred during html export: ${err && err.message || err}`));
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
        baseDir: [TempDir, TemplateDir, dir],
        directory: true
      },
      watchOptions: {
        ignored: 'node_modules'
      }
    });
  }

  _serveFile(dir, file) {
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

  _exportFile(dir, file) {
    let html, md;
    const filename = path.basename(file, path.extname(file)) + '.html';
    const exportedFile = path.join(dir, filename);
    return Promise.all([
        fs.readFile(file),
        fs.readFile(path.join(TemplateDir, HtmlTemplate)),
        this._sass()
      ])
      .then(results => {
        md = results[0].toString();
        html = results[1].toString();
        return results[2];
      })
      .then(css => Mustache.render(html, {
        source: `source: ${JSON.stringify(md)}`,
        style: `<style>\n${css}\n</style>`,
        title: this._getTitle(md) || path.basename(file, path.extname(file))
      }))
      .then(html => {
        this._suppressErrorOutput();
        return this._inline(TemplateDir, html)
      })
      .then(html => {
        process.chdir(this._pwd);
        return fs.outputFile(exportedFile, html);
      })
      .then(() => this._restoreErrorOutput())
      .then(() => exportedFile)
  }

  _inline(basedir, html) {
    return new Promise((resolve, reject) => {
      process.chdir(basedir);
      new Inliner({
        source: html,
        inlinemin: true,
        // Must be disabled because it's buggy, see https://github.com/remy/inliner/issues/63
        collapseWhitespace: false
      },
      (err, html) => err ? reject(err) : resolve(html));
    });
  }

  _sass() {
    return new Promise((resolve, reject) => {
      sass.render({
        file: path.join(TemplateDir, SassTemplate),
        includePaths: [TemplateDir]
      },
      (err, result) => err ? reject(err) : resolve(result.css));
    });
  }

  _checkDecktape(dir) {
    if (!fs.existsSync(path.join(dir, 'phantomjs')) || !fs.existsSync(path.join(dir, 'decktape.js'))) {
      throw new Error('Decktape not found');
    }
  }

  _checkTemplate() {
    if (!fs.existsSync(path.join(TemplateDir, HtmlTemplate))) {
      throw new Error(`${path.join(TemplateDir, HtmlTemplate)} not found`);
    }
    if (!fs.existsSync(path.join(TemplateDir, SassTemplate))) {
      throw new Error(`${path.join(TemplateDir, SassTemplate)} not found`);
    }
  }

  _getFiles(files) {
    if (!files.length || (files.length === 1 && this._isDirectory(files[0]))) {
      const pattern = this._normalizePattern(files[0] ? files[0] : '');
      try {
        files = glob.sync(path.join(pattern, '*.md'));
      } catch(err) {
        this._exit(err && err.message || err);
      }
    }
    if (files.length === 0) {
      this._exit('No markdown files found');
    }
    return files;
  }

  _normalizePattern(pattern) {
    if (isWindows) {
      // glob only works with forward slashes
      return pattern.replace(/\\/g, '/');
    }
    return pattern;
  }

  _isDirectory(path) {
    try {
      const stat = fs.statSync(path);
      return stat.isDirectory();
    } catch (err) {
      return false;
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

  _getTitle(md) {
    const match = TitleRegExp.exec(md);
    return match ? match[1]: null;
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
        return this.init(this._args.force);
      case 's':
      case 'serve':
        return this.serve(_[1], this._args.port || 4100);
      case 'e':
      case 'export':
        return this.export(this._args.output || 'dist', _.slice(1));
      case 'p':
      case 'pdf':
        return this.pdf(this._args.output || 'pdf',
          this._args.decktape || '.',
          _.slice(1), this._args.wait || 1000,
          this._args.verbose);
      default:
        this._help();
    }
  }

}

new BackslideCli(require('minimist')(process.argv.slice(2), {
  boolean: ['verbose', 'force'],
  string: ['output', 'decktape'],
  number: ['port', 'wait'],
  alias: {
    o: 'output',
    p: 'port',
    d: 'decktape',
    w: 'wait'
  }
}));

exports = BackslideCli;
