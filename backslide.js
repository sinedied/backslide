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
Usage: bs [init|serve|export] [options]

Commands:
  i, init            Initialize new slideshow in current dir
  e, export [files]  Export markdown files to html slideshows [default: *.md]
    -o, --output     Output directory                         [default: dist]
  s, serve [dir]     Start dev server for specified directory [default: .]
    -p, --port       Port number to listen on                 [default: 4100]
`;

class BackslideCli {

  constructor(args) {
    this._pwd = process.cwd();
    this._args = args;
    if (args != null) {
      this._runCommand();
    }
  }

  serve(dir, port) {
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
    if (files.length === 0) {
      this._exit('No markdown files found.');
    }

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
        return fs.writeFile(path.join(TempDir, filename), html);
      });
  }

  export(output, files) {
    files = files || glob.sync('*.md');
    fs.mkdirpSync(output);

    let count = 0;
    const progress = new Progress(':percent exporting file :current/:total', { total: files.length });
    const promise = Promise.resolve();
    const nextFile = () => promise.then(() => {
      if (count < files.length) {
        const file = files[count++];
        return this._exportFile(output, file)
          .then(() => progress.tick())
          .then(nextFile);
      }
    });
    return nextFile();
  }

  _exportFile(dir, file) {
    let html, md;
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
      .then(html => this._inline('.tmp', html))    
      .then(html => {
        process.chdir(this._pwd);
        const filename = path.basename(file, path.extname(file)) + '.html';
        return fs.writeFile(path.join(dir, filename), html);
      });
  }

  _inline(basedir, html) {
    return new Promise((resolve, reject) => {
      process.chdir(basedir);
      new Inliner({
        source: html,
        inlinemin: true,
        compressCSS: false,
        compressJS: false,
        collapseWhitespace: false,
        preserveComments: true
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
        // TODO
        break;
      case 's':
      case 'serve':
        return this.serve(_[1], this._args.port);
      case 'e':
      case 'export':
        return this.export(this._args.output, _.slice(1));
      default:
        this._help();
    }
  }

}

new BackslideCli(require('minimist')(process.argv.slice(2), {
  string: ['output'],
  number: ['port'],
  alias: {
    o: 'output',
    p: 'port'
  },
  default: {
    o: './dist',
    p: 4100
  }
}));

exports = BackslideCli;
