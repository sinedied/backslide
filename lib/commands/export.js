const path = require('path');
const fs = require('fs-extra');
const Mustache = require('mustache');
const Inliner = require('inliner');
const Progress = require('progress');
const util = require('../util');
const {HtmlTemplate, TemplateDir} = require('../constants');
const sass = require('../processings/sass');
const transform = require('../processings/transform');

const TitleRegExp = /^title:\s*(.*?)\s*$/gm;
const MdRelativeURLRegExp = /(!?\[.*?\]\()((?!\/|data:|http:\/\/|https:\/\/|file:\/\/).+?)((?=\)))/gm;
const HtmlRelativeURLRegExp = /(<(?:img|link|script|a)[^>]+(?:src|href)=(?:"|'))((?!\/|data:|http:\/\/|https:\/\/|file:\/\/).[^">]+?)("|')/gm;
const CssRelativeURLRegExp = /(url\()((?!\/|data:|http:\/\/|https:\/\/|file:\/\/)[^)]+)(\))/gm;
const pwd = process.cwd();
const stderrWrite = process.stderr.write;

/**
 * Exports markdown files as html slides.
 * @param {string} output The ouput dir.
 * @param {string[]} files The markdown files.
 * @param {object} options Export options.
 * Possible options:
 * - {boolean} stripNotes True to strip presenter notes.
 * - {boolean} stripFragments True to strip presention fragments (useful for handouts).
 * - {boolean} fixRelativePath True to fix relative image paths in markdown
 * - {boolean} inline True to inline external resources.
 * @return Promise<string[]> The exported files.
 */
async function exportHtml(output, files, options) {
  try {
    files = util.getFiles(files);
    util.checkTemplate();
    let count = 0;
    const progress = new Progress(':percent exporting file :count/:total', {total: files.length});
    const exportedFiles = [];
    const nextFile = async () => {
      if (count < files.length) {
        const file = files[count++];
        progress.render({count});
        const exportedFile = await exportFile(output, file, options);
        exportedFiles.push(exportedFile);
        progress.tick({count});
        return nextFile();
      }
    };
    await nextFile();
    return exportedFiles;
  } catch (err) {
    util.exit(`\nAn error occurred during html export: ${(err && err.message) || err}`);
  }
}

async function exportFile(dir, file, options) {
  let html, md, css;
  const filename = path.basename(file, path.extname(file)) + '.html';
  const dirname = path.dirname(path.resolve(file));
  const exportedFile = path.join(dir, filename);

  [md, html, css] = await Promise.all([
    fs.readFile(file),
    fs.readFile(path.join(TemplateDir, HtmlTemplate)),
    sass()
  ]);
  md = md.toString();
  html = html.toString();

  if (options.stripNotes) {
    md = transform.stripNotes(md);
  }
  if (options.stripFragments) {
    md = transform.stripFragments(md);
  }
  if (options.fixRelativePath) {
    md = transform.makePathRelativeTo(md, dirname, [MdRelativeURLRegExp, HtmlRelativeURLRegExp, CssRelativeURLRegExp]);
  }
  if (inline) {
    md = transform.inlineImages(md);
  }
  if (options.fixRelativePath && !inline) {
    html = transform.makePathRelativeTo(html, TemplateDir, [HtmlRelativeURLRegExp, CssRelativeURLRegExp]);
  }
  if (options.fixRelativePath && !inline) {
    css = transform.makePathRelativeTo(css.toString(), TemplateDir, [CssRelativeURLRegExp]);
  }
  html = await Mustache.render(html, {
    source: `source: ${JSON.stringify(md)}`,
    style: `<style>\n${css}\n</style>`,
    title: getTitle(md) || path.basename(file, path.extname(file))
  });

  suppressErrorOutput();
  html = inline ? await inline(TemplateDir, html) : html;
  await fs.outputFile(exportedFile, html);
  restoreErrorOutput();

  return exportedFile;
}

function getTitle(md) {
  const match = TitleRegExp.exec(md);
  return match ? match[1] : null;
}

function suppressErrorOutput() {
  process.stderr.write = (data, encoding, callback) => {
    if (callback) {
      callback();
    }
    return true;
  };
}

function restoreErrorOutput() {
  return new Promise(resolve => {
    process.stderr.once('drain', () => {
      process.stderr.write = stderrWrite;
      resolve();
    });
    // Drain before restoring output
    process.stderr.emit('drain');
  });
}

function inline(basedir, html) {
  return new Promise((resolve, reject) => {
    process.chdir(basedir);
    // eslint-disable-next-line no-new
    new Inliner(
      {
        source: html,
        inlinemin: true,
        // Must be disabled because it's buggy, see https://github.com/remy/inliner/issues/63
        collapseWhitespace: false
      },
      (err, html) => {
        process.chdir(pwd);
        if (err) {
          reject(err);
        } else {
          resolve(html);
        }
      }
    );
  });
}

module.exports = exportHtml;
