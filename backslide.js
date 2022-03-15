const child = require('child_process');
const path = require('path');
const process = require('process');
const { Buffer } = require('buffer');
const browserSync = require('browser-sync').create('bs-server');
const minimist = require('minimist');
const commandExists = require('command-exists');
const updateNotifier = require('update-notifier');
const mime = require('mime');
const Progress = require('progress');
const inliner = require('web-resource-inliner');
const sass = require('sass');
const Mustache = require('mustache');
const glob = require('glob');
const fs = require('fs-extra');
const pkg = require('./package.json');

const TemporaryDir = '.tmp';
const StarterDir = 'starter';
const TemplateDir = 'template';
const HtmlTemplate = 'index.html';
const SassTemplate = 'style.scss';
const WebsiteRootFile = 'index.html';
const AssetsFolders = ['assets', 'images', 'img'];
const TitleRegExp = /^title:\s*(.*?)\s*$/gm;
const NotesRegExp = /^\?\?\?$[\s\S]*?(^---?$)/gm;
const FragmentsRegExp = /(^--[^-][\s\S])/gm;
const MdRelativeURLRegExp =
  /(!?\[.*?]\()((?!\/|data:|http:\/\/|https:\/\/|file:\/\/).+?)((?=\)))/gm;
const HtmlRelativeURLRegExp =
  /(<(?:img|link|script|a)[^>]+(?:src|href)=["'])((?!\/|data:|http:\/\/|https:\/\/|file:\/\/).[^">]+?)(["'])/gm;
const CssRelativeURLRegExp =
  /(url\("?)((?!\/|data:|http:\/\/|https:\/\/|file:\/\/)[^")]+)("?\))/gm;
const MdImagesRegExp = /(!\[.*?]\()(file:\/{3}.+?)((?=\)))/gm;
const HtmlImagesRegExp = /(<img[^>]+src=["'])(file:\/{3}.[^">]+?)(["'])/gm;
const CssImagesRegExp = /(url\("?)((file:\/\/)[^")]+)("?\))/gm;
const isWindows = process.platform.startsWith('win');

const help = `${pkg.name} ${pkg.version}
Usage: bs [init|serve|export|pdf] [options]

Commands:
  i, init                 Init new presentation in current directory
    -t, --template <dir>  Use custom template directory
    --force               Overwrite existing files                 
  e, export [files]       Export markdown files to html slides [default: *.md]
    -o, --output          Output directory                     [default: dist]
    -r, --strip-notes     Strip presenter notes                     
    -h, --handouts        Strip slide fragments for handouts
    -l, --no-inline       Do not inline external resources
    -b, --web             Export as website, copying assets
  s, serve [dir]          Start dev server for specified dir.  [default: .]
    -p, --port            Port number to listen on             [default: 4100]
    -s, --skip-open       Do not open browser on start              
  p, pdf [files]          Export markdown files to pdf         [default: *.md]
    -h, --handouts        Strip slide fragments for handouts
    -o, --output          Output directory                     [default: pdf]
    -w, --wait            Wait time between slides in ms       [default: 1000]
    --verbose             Show Decktape console output
    -- [Decktape opts]    Pass any Decktape options directly
`;

class BackslideCli {
  constructor() {
    this._stderrWrite = process.stderr.write;
    this._pwd = process.cwd();
  }

  /**
   * Runs command with specified arguments.
   * @params {Array<string>} args Command-line arguments.
   */
  run(args) {
    this._args = minimist(args, {
      boolean: [
        'verbose',
        'force',
        'skip-open',
        'strip-notes',
        'handouts',
        'no-inline',
        'web'
      ],
      string: ['output', 'template'],
      number: ['port', 'wait'],
      alias: {
        o: 'output',
        p: 'port',
        w: 'wait',
        s: 'skip-open',
        r: 'strip-notes',
        l: 'no-inline',
        t: 'template',
        h: 'handouts',
        b: 'web'
      },
      '--': true
    });
    this._runCommand();
  }

  /**
   * Creates the template directory with a presentation starter in the current directory.
   * @param {string} fromTemplateDir A custom template directory.
   * @param {boolean} force Overwrite existing files.
   */
  init(fromTemplateDir, force) {
    if (!force && fs.existsSync(TemplateDir)) {
      this._exit(`Template directory already exists`);
    }

    if (!force && fs.existsSync('./presentation.md')) {
      this._exit(`Presentation.md already exists`);
    }

    fromTemplateDir = fromTemplateDir
      ? path.resolve(fromTemplateDir)
      : path.join(__dirname, StarterDir, TemplateDir);
    try {
      fs.copySync(fromTemplateDir, TemplateDir);
      fs.copySync(
        path.join(__dirname, StarterDir, 'presentation.md'),
        './presentation.md'
      );
      console.info('Presentation initialized successfully');
    } catch (error) {
      this._exit((error && error.message) || error);
    }
  }

  /**
   * Exports markdown files as pdf using an existing Decktape install.
   * @param {string} output The ouput dir.
   * @param {string[]} files The markdown files.
   * @param {number} wait Wait time between slides in ms.
   * @param {boolean} verbose Show decktape console output.
   * @param {boolean} options Additional Decktape options.
   * @return Promise<string[]> The exported files.
   */
  pdf(output, files, wait, handouts, verbose, options) {
    let count = 0;
    let progress;
    const exportedFiles = [];

    if (!commandExists.sync('decktape')) {
      this._exit(
        'For pdf export to work, Decktape must be installed.\nUse: npm i -g decktape\n'
      );
    }

    return Promise.resolve()
      .then(() => {
        files = this._getFiles(files);
        this._checkTemplate();
        fs.mkdirpSync(output);
        progress = new Progress(':percent converting pdf :count/:total', {
          total: files.length
        });
      })
      .then(() =>
        this.export(
          path.join(TemporaryDir, 'pdf'),
          files,
          false,
          handouts,
          true,
          !this._args['no-inline']
        )
      )
      .then((exportedFiles) => {
        for (const file of exportedFiles) {
          progress.render({ count: ++count });
          const exportedFile = path.basename(file, path.extname(file)) + '.pdf';
          exportedFiles.push(exportedFile);
          child.execSync(
            [
              `decktape`,
              `-p ${wait}`,
              `"file://${path.resolve(file)}"`,
              `"${path.join(output, exportedFile)}"`,
              ...options
            ].join(' '),
            {
              stdio: verbose ? [1, 2] : [2]
            }
          );
          progress.tick({ count });
        }
      })
      .then(() => exportedFiles)
      .catch((error) =>
        this._exit(
          `\nAn error occurred during pdf conversion: ${
            (error && error.message) || error
          }`
        )
      );
  }

  /**
   * Starts a development server with live reload.
   * @param {string} dir The directory containing markdown files.
   * @param {number} port The port number to listen on.
   * @param {boolean} open True to open default browser.
   */
  serve(dir, port, open) {
    dir = dir || '.';
    let files;
    let count = 0;
    const promise = Promise.resolve();
    const nextFile = () =>
      promise.then(() => {
        if (count < files.length) {
          const file = files[count++];
          return this._serveFile(TemporaryDir, file).then(nextFile);
        }
      });
    return Promise.resolve()
      .then(() => {
        fs.removeSync(TemporaryDir);
        this._checkTemplate();
        if (!this._isDirectory(dir)) {
          this._exit(`${dir} is not a directory`);
        }

        files = this._getFiles([dir]);
      })
      .then(() => this._sass())
      .then((css) => {
        const cssFile =
          path.basename(SassTemplate, path.extname(SassTemplate)) + '.css';
        return fs.outputFile(path.join(TemporaryDir, cssFile), css);
      })
      .then(() => {
        // Find node_modules path
        const sassPath = require.resolve('sass');
        const nodeModulesPath = sassPath.slice(0, sassPath.lastIndexOf('sass'));

        // Run sass in watch mode (no API >_<)
        child.spawn(
          'node',
          [
            path.join(nodeModulesPath, 'sass.js'),
            '-w',
            `${path.join(TemplateDir, SassTemplate)}:${path.join(
              TemporaryDir,
              path.basename(SassTemplate, path.extname(SassTemplate)) + '.css'
            )}`
          ],
          { stdio: 'inherit' }
        );
      })
      .then(() => nextFile())
      .then(() => this._startServer(dir, port, open))
      .catch((error) =>
        this._exit(
          `\nCannot start server: ${(error && error.message) || error}`
        )
      );
  }

  /**
   * Exports markdown files as html slides.
   * @param {string} output The ouput dir.
   * @param {string[]} files The markdown files.
   * @param {boolean} stripNotes True to strip presenter notes.
   * @param {boolean} stripFragments True to strip presention fragments (useful for handouts).
   * @param {boolean} fixRelativePath True to fix relative image paths in markdown
   * @param {boolean} inline True to inline external resources.
   * @param {boolean} website True to export as a website (first presentation only).
   * @return Promise<string[]> The exported files.
   */
  export(
    output,
    files,
    stripNotes,
    stripFragments,
    fixRelativePaths,
    inline,
    website
  ) {
    let count = 0;
    let progress;
    const exportedFiles = [];
    const promise = Promise.resolve();
    const nextFile = () =>
      promise.then(() => {
        if (count < files.length) {
          const file = files[count++];
          progress.render({ count });
          return this._exportFile(
            output,
            file,
            stripNotes,
            stripFragments,
            fixRelativePaths,
            inline,
            website
          )
            .then((exportedFile) => exportedFiles.push(exportedFile))
            .then(() => progress.tick({ count }))
            .then(nextFile);
        }
      });
    return Promise.resolve()
      .then(() => {
        files = this._getFiles(files);
        if (website) {
          files = files.slice(0, 1);
        }

        this._checkTemplate();
        progress = new Progress(':percent exporting file :count/:total', {
          total: files.length
        });
      })
      .then(() => nextFile())
      .then(() => exportedFiles)
      .catch((error) =>
        this._exit(
          `\nAn error occurred during html export: ${
            (error && error.message) || error
          }`
        )
      );
  }

  _startServer(dir, port, open) {
    browserSync.init({
      ui: false,
      injectChanges: true,
      notify: false,
      port,
      files: [
        path.join(TemplateDir, '*.{html,css,js}'),
        path.join(TemporaryDir, '*.{html,css,js}'),
        path.join(dir, '*.md')
      ],
      server: {
        baseDir: [TemporaryDir, TemplateDir, dir],
        directory: true
      },
      watchOptions: {
        ignored: 'node_modules'
      },
      browser: open ? undefined : []
    });
  }

  _serveFile(dir, file) {
    return fs
      .readFile(path.join(TemplateDir, HtmlTemplate))
      .then((buffer) =>
        Mustache.render(buffer.toString(), {
          source: `sourceUrl: '${path.basename(file)}'`,
          style: `<link rel="stylesheet" href="style.css">`
        })
      )
      .then((html) => {
        const filename = path.basename(file, path.extname(file)) + '.html';
        return fs.outputFile(path.join(TemporaryDir, filename), html);
      });
  }

  _exportFile(
    dir,
    file,
    stripNotes,
    stripFragments,
    fixRelativePath,
    inline,
    website
  ) {
    fixRelativePath = website ? false : fixRelativePath;
    inline = website ? false : inline;
    let html;
    let md;
    const filename = path.basename(file, path.extname(file)) + '.html';
    const dirname = path.dirname(path.resolve(file));
    const exportedFile = path.join(dir, website ? WebsiteRootFile : filename);
    return Promise.all([
      fs.readFile(file),
      fs.readFile(path.join(TemplateDir, HtmlTemplate)),
      this._sass()
    ])
      .then((results) => {
        md = results[0].toString();
        if (stripNotes) {
          md = md.replace(NotesRegExp, '$1');
        }

        if (stripFragments) {
          md = md.replace(FragmentsRegExp, '');
        }

        if (inline && fixRelativePath) {
          md = this._makePathRelativeTo(md, dirname, [
            MdRelativeURLRegExp,
            HtmlRelativeURLRegExp,
            CssRelativeURLRegExp
          ]);
        }

        if (inline) {
          md = this._inlineImages(md, [
            MdImagesRegExp,
            HtmlImagesRegExp,
            CssImagesRegExp
          ]);
        }

        html = results[1].toString();
        if (fixRelativePath && !inline) {
          html = this._makePathRelativeTo(html, TemplateDir, [
            HtmlRelativeURLRegExp,
            CssRelativeURLRegExp
          ]);
        }

        return results[2];
      })
      .then((css) => {
        if (inline) {
          return this._inlineCss(path.join(dirname, TemplateDir), dir, css);
        }

        fs.outputFile(path.join(dir, 'style.css'), css);
        return css;
      })
      .then((css) => {
        if (fixRelativePath && !inline) {
          css = this._makePathRelativeTo(css.toString(), TemplateDir, [
            CssRelativeURLRegExp
          ]);
        }

        return Mustache.render(html, {
          source: `source: ${this._escapeScript(JSON.stringify(md))}`,
          style: website
            ? `<link rel="stylesheet" href="style.css">`
            : `<style>\n${css}\n</style>`,
          title: this._getTitle(md) || path.basename(file, path.extname(file))
        });
      })
      .then((html) => {
        this._suppressErrorOutput();
        return inline ? this._inline(TemplateDir, html) : html;
      })
      .then((html) => {
        process.chdir(this._pwd);
        return fs.outputFile(exportedFile, html);
      })
      .then(() => {
        if (website) {
          return this._copyAssets(dir);
        }
      })
      .then(() => this._restoreErrorOutput())
      .then(() => exportedFile);
  }

  _copyAssets(dir) {
    try {
      const filterHtmlSass = (file) =>
        ![HtmlTemplate, SassTemplate].some((n) => file.includes(n));
      fs.copySync(TemplateDir, dir, { filter: filterHtmlSass });
      for (const assetFolder of AssetsFolders) {
        if (fs.existsSync(assetFolder)) {
          fs.copySync(assetFolder, path.join(dir, assetFolder));
        }
      }
    } catch (error) {
      this._exit((error && error.message) || error);
    }
  }

  _makePathRelativeTo(contents, dir, regexps) {
    // Make paths relative to the specified directory
    for (const regexp of regexps) {
      contents = contents.replace(regexp, `$1file://${path.resolve(dir)}/$2$3`);
    }

    return contents;
  }

  _inlineImages(contents, regexps) {
    const cache = {};
    for (const regexp of regexps) {
      let match = regexp.exec(contents);
      while (match) {
        const url = match[2].replace(/^file:\/\//g, '');
        if (!cache[url]) {
          try {
            const b = fs.readFileSync(url);
            cache[url] = `data:${mime.getType(match[2])};base64,${b.toString(
              'base64'
            )}`;
          } catch (error) {
            console.error(error.message);
          }
        }

        contents = contents.replace(new RegExp(match[2], 'g'), cache[url]);
        match = regexp.exec(contents);
      }
    }

    return contents;
  }

  _inlineCss(basedir, targetdir, css) {
    return new Promise((resolve, reject) => {
      inliner.css(
        {
          fileContent: css.toString(),
          relativeTo: targetdir,
          rebaseRelativeTo: path.relative(targetdir, basedir),
          images: true,
          svgs: true
        },
        (error, css) => (error ? reject(error) : resolve(Buffer.from(css)))
      );
    });
  }

  _inline(basedir, html) {
    return new Promise((resolve, reject) => {
      process.chdir(basedir);
      inliner.html(
        {
          fileContent: html,
          images: true,
          svgs: true
        },
        (error, html) => (error ? reject(error) : resolve(html))
      );
    });
  }

  _sass() {
    return new Promise((resolve, reject) => {
      sass.render(
        {
          file: path.join(TemplateDir, SassTemplate),
          includePaths: [TemplateDir],
          outputStyle: 'compressed'
        },
        (error, result) => (error ? reject(error) : resolve(result.css))
      );
    });
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
    if (
      files.length === 0 ||
      (files.length === 1 && this._isDirectory(files[0]))
    ) {
      const pattern = this._normalizePattern(files[0] ? files[0] : '');
      try {
        files = glob.sync(path.join(pattern, '*.md'));
      } catch (error) {
        this._exit((error && error.message) || error);
      }
    }

    if (files.length === 0) {
      this._exit('No markdown files found');
    }

    return files;
  }

  _normalizePattern(pattern) {
    if (isWindows) {
      // Glob only works with forward slashes
      return pattern.replace(/\\/g, '/');
    }

    return pattern;
  }

  _isDirectory(path) {
    try {
      const stat = fs.statSync(path);
      return stat.isDirectory();
    } catch {
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
    return match ? match[1] : null;
  }

  _escapeScript(md) {
    return md.replace(/<\/script>/g, '<\\/script>');
  }

  _help() {
    this._exit(help);
  }

  _exit(error, code = 1) {
    console.error(error);
    process.exit(code);
  }

  _runCommand() {
    updateNotifier({ pkg }).notify();

    const { _ } = this._args;
    switch (_[0]) {
      case 'i':
      case 'init':
        return this.init(
          this._args.template || process.env.BACKSLIDE_TEMPLATE_DIR,
          this._args.force
        );
      case 's':
      case 'serve':
        return this.serve(
          _[1],
          this._args.port || 4100,
          !this._args['skip-open']
        );
      case 'e':
      case 'export':
        return this.export(
          this._args.output || 'dist',
          _.slice(1),
          this._args['strip-notes'],
          this._args.handouts,
          !this._args['no-inline'],
          !this._args['no-inline'],
          this._args.web
        );
      case 'p':
      case 'pdf':
        return this.pdf(
          this._args.output || 'pdf',
          _.slice(1),
          this._args.wait || 1000,
          this._args.handouts,
          this._args.verbose,
          this._args['--']
        );
      default:
        this._help();
    }
  }
}

module.exports = BackslideCli;
