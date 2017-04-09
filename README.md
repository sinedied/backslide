# backslide

[![NPM version](https://img.shields.io/npm/v/backslide.svg)](https://www.npmjs.com/package/backslide)
![Node version](https://img.shields.io/node/v/backslide.svg)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> Command line interface tool for making HTML presentations using [Remark.js](https://github.com/gnab/remark)

## Installation

```bash
npm install -g backslide
```

### Usage

```
Usage: bs [init|serve|export] [options]

Commands:
  i, init            Initialize new slideshow in current dir
  e, export [files]  Export markdown files to html slideshows [default: *.md]
    -o, --output     Output directory                         [default: dist]
  s, serve [dir]     Start dev server for specified dir       [default: .]
    -p, --port       Port number to listen on                 [default: 4100]
```
