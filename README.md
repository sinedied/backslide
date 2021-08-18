# :sweat_drops: backslide

[![NPM version](https://img.shields.io/npm/v/backslide.svg)](https://www.npmjs.com/package/backslide)
![Node version](https://img.shields.io/node/v/backslide.svg)
[![Build Status](https://github.com/sinedied/backslide/workflows/build/badge.svg)](https://github.com/sinedied/backslide/actions)
[![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> CLI tool for making HTML presentations with [Remark.js](https://github.com/gnab/remark) using [Markdown](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet)

![screenshot](https://cloud.githubusercontent.com/assets/593151/24945508/df6e3b50-1f5f-11e7-895c-89e89d89fa5a.jpg)

See an example presentation [here](https://sinedied.github.io/backslide)

## Features

- Template generator with [Sass](http://sass-lang.com) styling
- Live preview server
- Self-contained HTML export
- Automated PDF conversion
- Multiple presentations support

## Installation

### NPM/Yarn

```sh
npm install -g backslide
# or
yarn add backslide
```

### Docker

Backslide can be executed within a Docker container from the command-line using the `registry.gitlab.com/mpolitze/backslide-docker:latest` Docker image available on [GitLab Container Registry](https://gitlab.com/mpolitze/backslide-docker):

```sh
docker run --rm registry.gitlab.com/mpolitze/backslide-docker:latest
```

See the [How-to-use-this-image](https://gitlab.com/mpolitze/backslide-docker#how-to-use-this-image) for more examples.

## Usage

```
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
```

### Creating a new presentation

Use `bs init` to create a new presentation along with a `template` directory in the current directory. The `template` directory is needed for `backslide` to transform your Markdown files into HTML presentations.

Then edit the file `presentation.md` to get started.

You can create as many markdown presentations as you want in the directory, they will all be based on the same template.

If you want to start a new presentation using your own custom template, you can use `bs init --template <your_template_dir>`.
You can also set the environment variable `BACKSLIDE_TEMPLATE_DIR` to change the default template used by `bs init`.

### Making your slides

Use `bs serve` to start a development server with live reload.
A page will automatically open in your web browser showing all your presentations.

Select one to see the preview, you can then edit your `.md` file and see the changes immediately as you save the file. Any style change will also be applied live.

Slides are written in [Markdown](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet), along with some useful **Remark.js** specific additions.
See the [Remark.js wiki](https://github.com/gnab/remark/wiki) for the specific syntax and helpers.

#### Customize style

Just edit the `template/style.scss` file and make changes according to your needs.
The base theme already provides some helpful additions.

The stylesheet is written in [Sass](http://sass-lang.com), but you can use plain CSS instead if you feel like it, as long as you don't change the file extension.

### Exporting your slides

#### As self-contained HTML

Use `bs export` to export all your `.md` files as HTML presentations.

Everything will be inlined in the HTML document (scripts, css, etc) so you don't need a network to show your presentation.
If you have images, it's best to include them as [data-uri](https://css-tricks.com/data-uris/) in your markdown, but local images links are inlined too during export.

If you have set a `title` variable in your document (like this `title: My Awesome Presentation`), it will be used as the HTML document title, otherwise the file name will be used.

> Note: you can strip presenter notes from the exported HTML using the `--strip-notes` option, and remove slide fragments with the `--handouts` option.

#### As a website

Use `bs export --web <file>.md` to export a presentation into a static HTML website.

Files within the `template` folder and from the `assets`, `images` and `img` folders will be copied to the destination folder.

### Converting your slides to PDF

Use `bs pdf` to export your all `.md` files as PDF presentations.

> Note: you can remove slide fragements with the `--handouts` option.

This feature is based on [Decktape](https://github.com/astefanutti/decktape/).

For this feature to work, you need to install [Decktape](https://github.com/astefanutti/decktape/):

```sh
npm install -g decktape
```
