const path = require('path');
const fs = require('fs-extra');
const mime = require('mime');
const got = require('got');
const {URL} = require('url');
const util = require('../util');
const dataUri = require('./data-uri');

const MdImagesRegExp = /!\[(.*?)\]\((.+?)\)/gm;

async function inlineImages(contents, basePath) {
  const cache = {};
  // TODO: HTML & CSS
  const regexp = MdImagesRegExp;
  let newContents = contents;
  let match = regexp.exec(contents);
  while (match) {
    const url = match[2];
    if (!/data:/.test(url)) {
      if (!cache[url]) {
        try {
          // eslint-disable-next-line no-await-in-loop
          cache[url] = await getImage(url, basePath);
        } catch (err) {
          console.error((err && err.message) || err);
        }
      }

      // TODO: replace whole match and inject filename as alt
      newContents = newContents.replace(new RegExp(util.escapeRegExp(match[2]), 'g'), cache[url]);
    }
    match = regexp.exec(contents);
  }
  return newContents;
}

function extractImages(output, contents) {
  // TODO: HTML & CSS
  const regexp = MdImagesRegExp;
  let newContents = contents;
  let match = regexp.exec(contents);
  while (match) {
    const url = match[2];
    let file;
    console.log('plouf');
    if (/data:/.test(url)) {
      const name = match[1] || generateUniqueName();
      console.log(name);
      try {
        const image = dataUri.decode(url);
        file = `${name}.${image.extension}`;
        fs.outputFileSync(path.join(output, file), image.data);
      } catch (err) {
        console.error((err && err.message) || err);
      }
      // TODO: replace whole match
      newContents = newContents.replace(new RegExp(util.escapeRegExp(match[2]), 'g'), path.join('images', file));
    }
    match = regexp.exec(contents);
  }
  console.log(match);
  return newContents;
}

// TODO: check for existing files
let num = 1;
function generateUniqueName() {
  return String(num++);
}

async function getImage(url, basePath) {
  const parsedUrl = new URL(url, 'file://');
  let data, type;
  if (parsedUrl.protocol === 'file:') {
    data = await fs.readFile(path.join(basePath, url));
    type = mime.getType(path.extname(url));
  } else {
    const res = await got(url, {encoding: null});
    data = res.body;
    type = res.headers['content-type'];
  }
  return dataUri.encode(data, type);
}

module.exports = {
  inlineImages,
  extractImages
};
