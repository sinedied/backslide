const path = require('path');
const fs = require('fs-extra');
const glob = require('glob');
const {TemplateDir, HtmlTemplate, SassTemplate} = require('./constants');

const isWindows = /^win/.test(process.platform);
const operatorsRegExp = /[|\\{}()[\]^$+*?.]/g;

function exit(error, code = 1) {
  console.error(error);
  process.exit(code);
}

function isDirectory(path) {
  try {
    const stat = fs.statSync(path);
    return stat.isDirectory();
  } catch (err) {
    return false;
  }
}

function getFiles(files) {
  if (!files.length || (files.length === 1 && isDirectory(files[0]))) {
    const pattern = normalizePattern(files[0] ? files[0] : '');
    try {
      files = glob.sync(path.join(pattern, '*.md'));
    } catch (err) {
      exit((err && err.message) || err);
    }
  }
  if (files.length === 0) {
    exit('No markdown files found');
  }
  return files;
}

function normalizePattern(pattern) {
  if (isWindows) {
    // Glob only works with forward slashes
    return pattern.replace(/\\/g, '/');
  }
  return pattern;
}

function checkTemplate() {
  if (!fs.existsSync(path.join(TemplateDir, HtmlTemplate))) {
    throw new Error(`${path.join(TemplateDir, HtmlTemplate)} not found`);
  }
  if (!fs.existsSync(path.join(TemplateDir, SassTemplate))) {
    throw new Error(`${path.join(TemplateDir, SassTemplate)} not found`);
  }
}

function escapeRegExp(str) {
  return str.replace(operatorsRegExp, '\\$&');
}

module.exports = {
  isWindows,
  exit,
  isDirectory,
  getFiles,
  checkTemplate,
  escapeRegExp
};
