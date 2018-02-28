
const path = require('path');
const fs = require('fs-extra');
const mime = require('mime');

const NotesRegExp = /(?:^\?\?\?$[\s\S]*?)(^---?$)/gm;
const FragmentsRegExp = /(?:^--[^-]$)/gm;
const MdImagesRegExp = /(!\[.*?\]\()(file:\/\/\/.+?)((?=\)))/gm;
const HtmlImagesRegExp = /(<img[^>]+src=(?:"|'))(file:\/\/\/.[^">]+?)("|')/gm;
const CssImagesRegExp = /(url\()((file:\/\/)[^)]+)(\))/gm;

function makePathRelativeTo(contents, dir, regexps) {
  // Make paths relative to the specified directory
  regexps.forEach(regexp => {
    contents = contents.replace(regexp, `$1file://${path.resolve(dir)}/$2$3`);
  });
  return contents;
}

function inlineImages(contents) {
  const cache = {};
  [MdImagesRegExp, HtmlImagesRegExp, CssImagesRegExp].forEach(regexp => {
    let match = regexp.exec(contents);
    while (match) {
      const url = match[2].replace(/^file:\/\//g, '');
      if (!cache[url]) {
        try {
          const b = fs.readFileSync(url);
          cache[url] = `data:${mime.getType(match[2])};base64,${b.toString('base64')}`;
        } catch (e) {
          console.error(e.message);
        }
      }
      contents = contents.replace(new RegExp(match[2], 'g'), cache[url]);
      match = regexp.exec(contents);
    }
  });
  return contents;
}

function stripNotes(md) {
  return md.replace(NotesRegExp, '$1');
}

function stripFragments(md) {
  return md.replace(FragmentsRegExp, '');
}

module.exports = {
  makePathRelativeTo,
  inlineImages,
  stripNotes,
  stripFragments
};
