const path = require('path');
const sass = require('node-sass');
const {TemplateDir, SassTemplate} = require('../constants');

function compileSass() {
  return new Promise((resolve, reject) => {
    sass.render({
      file: path.join(TemplateDir, SassTemplate),
      includePaths: [TemplateDir],
      outputStyle: 'compressed'
    },
    (err, result) => err ? reject(err) : resolve(result.css));
  });
}

module.exports = compileSass;
