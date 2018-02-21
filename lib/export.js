const path = require('path');
const fs = require('fs-extra');
const Mustache = require('mustache');
const Inliner = require('inliner');
const Progress = require('progress');
const sass = require('./sass');
const util = require('./util');
const transform = require('./transform');
const {HtmlTemplate, TemplateDir} = require('./constants');

const TitleRegExp = /^title:\s*(.*?)\s*$/gm;
const NotesRegExp = /(?:^\?\?\?$[\s\S]*?)(^---?$)/gm;
const FragmentsRegExp = /(^--[^-][\s\S])/gm;
const MdRelativeURLRegExp = /(!?\[.*?\]\()((?!\/|data:|http:\/\/|https:\/\/|file:\/\/).+?)((?=\)))/gm;
const HtmlRelativeURLRegExp = /(<(?:img|link|script|a)[^>]+(?:src|href)=(?:"|'))((?!\/|data:|http:\/\/|https:\/\/|file:\/\/).[^">]+?)("|')/gm;
const CssRelativeURLRegExp = /(url\()((?!\/|data:|http:\/\/|https:\/\/|file:\/\/)[^)]+)(\))/gm;
const MdImagesRegExp = /(!\[.*?\]\()(file:\/\/\/.+?)((?=\)))/gm;
const HtmlImagesRegExp = /(<img[^>]+src=(?:"|'))(file:\/\/\/.[^">]+?)("|')/gm;
const CssImagesRegExp = /(url\()((file:\/\/)[^)]+)(\))/gm;
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
function exportHtml(output, files, options) {
  let count = 0;
  let progress;
  const exportedFiles = [];
  const promise = Promise.resolve();
  const nextFile = () => promise.then(() => {
    if (count < files.length) {
      const file = files[count++];
      progress.render({count});
      return exportFile(output, file, options)
        .then(exportedFile => exportedFiles.push(exportedFile))
        .then(() => progress.tick({count}))
        .then(nextFile);
    }
  });
  return Promise.resolve()
    .then(() => {
      files = util.getFiles(files);
      util.checkTemplate();
      progress = new Progress(':percent exporting file :count/:total', {total: files.length});
    })
    .then(() => nextFile())
    .then(() => exportedFiles)
    .catch(err => util.exit(`\nAn error occurred during html export: ${(err && err.message) || err}`));
}

function exportFile(dir, file, options) {
  let html, md;
  const filename = path.basename(file, path.extname(file)) + '.html';
  const dirname = path.dirname(path.resolve(file));
  const exportedFile = path.join(dir, filename);
  return Promise
    .all([
      fs.readFile(file),
      fs.readFile(path.join(TemplateDir, HtmlTemplate)),
      sass()
    ])
    .then(results => {
      md = results[0].toString();
      if (options.stripNotes) {
        md = md.replace(NotesRegExp, '$1');
      }
      if (options.stripFragments) {
        md = md.replace(FragmentsRegExp, '');
      }
      if (options.fixRelativePath) {
        md = transform.makePathRelativeTo(md, dirname, [MdRelativeURLRegExp, HtmlRelativeURLRegExp, CssRelativeURLRegExp]);
      }
      if (inline) {
        md = transform.inlineImages(md, [MdImagesRegExp, HtmlImagesRegExp, CssImagesRegExp]);
      }
      html = results[1].toString();
      if (options.fixRelativePath && !inline) {
        html = transform.makePathRelativeTo(html, TemplateDir, [HtmlRelativeURLRegExp, CssRelativeURLRegExp]);
      }
      return results[2];
    })
    .then(css => {
      if (options.fixRelativePath && !inline) {
        css = transform.makePathRelativeTo(css.toString(), TemplateDir, [CssRelativeURLRegExp]);
      }
      return Mustache.render(html, {
        source: `source: ${JSON.stringify(md)}`,
        style: `<style>\n${css}\n</style>`,
        title: getTitle(md) || path.basename(file, path.extname(file))
      });
    })
    .then(html => {
      suppressErrorOutput();
      return inline ? inline(TemplateDir, html) : html;
    })
    .then(html => {
      process.chdir(pwd);
      return fs.outputFile(exportedFile, html);
    })
    .then(() => restoreErrorOutput())
    .then(() => exportedFile);
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
    /* eslint no-new: "off" */
    new Inliner(
      {
        source: html,
        inlinemin: true,
        // Must be disabled because it's buggy, see https://github.com/remy/inliner/issues/63
        collapseWhitespace: false
      },
      (err, html) => err ? reject(err) : resolve(html)
    );
  });
}

module.exports = exportHtml;
