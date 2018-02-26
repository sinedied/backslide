const pkg = require('./package.json');
const updateNotifier = require('update-notifier');
const minimist = require('minimist');
const util = require('./lib/util');
const init = require('./lib/commands/init');
const serve = require('./lib/commands/serve');
const exportHtml = require('./lib/commands/export');
const pdf = require('./lib/commands/pdf');
const transform = require('./lib/commands/transform');

const help =
`${pkg.name} ${pkg.version}
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
    -i, --online          Export for online hosting
  s, serve [dir]          Start dev server for specified dir.  [default: .]
    -p, --port            Port number to listen on             [default: 4100]
    -s, --skip-open       Do not open browser on start
  p, pdf [files]          Export markdown files to pdf         [default: *.md]
    -h, --handouts        Strip slide fragments for handouts
    -o, --output          Output directory                     [default: pdf]
    -w, --wait            Wait time between slides in ms       [default: 1000]
    --verbose             Show Decktape console output
    -- [Decktape opts]    Pass any Decktape options directly
  t, transform [files]    Performs transformations on your slides
    -o, --output          Output directory (default to in-place)
    -x, --extract-images  Extract embedded images
    -e, --embed-images    Embed external images
    -r, --strip-notes     Strip presenter notes
    -h, --handouts        Strip slide fragments for handouts
`;

class Backslide {
  constructor(args) {
    this._args = minimist(args, {
      boolean: [
        'verbose',
        'force',
        'skip-open',
        'strip-notes',
        'handouts',
        'no-inline',
        'extract-images',
        'embed-images',
        'online'
      ],
      string: [
        'output',
        'decktape',
        'template'
      ],
      number: [
        'port',
        'wait'
      ],
      alias: {
        o: 'output',
        p: 'port',
        d: 'decktape',
        w: 'wait',
        s: 'skip-open',
        r: 'strip-notes',
        l: 'no-inline',
        t: 'template',
        h: 'handouts',
        i: 'online',
        e: 'embed-images',
        x: 'extract-images'
      },
      '--': true
    });
  }

  run() {
    updateNotifier({pkg}).notify();

    const _ = this._args._;
    switch (_[0]) {
      case 'i':
      case 'init':
        return init(this._args.template || process.env.BACKSLIDE_TEMPLATE_DIR, this._args.force);
      case 's':
      case 'serve':
        return serve(_[1], this._args.port || 4100, !this._args['skip-open']);
      case 'e':
      case 'export':
        return exportHtml(
          this._args.output || 'dist',
          _.slice(1),
          {
            stripNotes: this._args['strip-notes'],
            stripFragments: this._args.handouts,
            fixRelativePath: !this._args.online,
            inline: !this._args['no-inline']
          }
        );
      case 'p':
      case 'pdf':
        return pdf(
          this._args.output || 'pdf',
          _.slice(1),
          {
            wait: this._args.wait || 1000,
            stripFragments: this._args.handouts,
            verbose: this._args.verbose,
            inline: !this._args['no-inline'],
            decktapeOptions: this._args['--']
          }
        );
      case 't':
      case 'transform':
        return transform(
          this._args.output,
          _.slice(1),
          {
            stripNotes: this._args['strip-notes'],
            stripFragments: this._args.handouts,
            extractImages: this._args['extract-images'] ? 'images' : null,
            embedImages: this._args['embed-images']
          }
        );
      default:
        util.exit(help);
    }
  }
}

module.exports = Backslide;
