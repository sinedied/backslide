# 2.6.2
- Fix CSS inlining with relative URLs (PR https://github.com/sinedied/backslide/pull/77)
- Remove inlining size limit for images (fix #75)

# 2.6.1
- Fix crash with pdf generation using `--no-inline` (PR https://github.com/sinedied/backslide/pull/81)

# 2.6.0
- Fix crash with export using `--no-inline`
- Add `--web` option to quickly export presentation as a static website (fix #29)

# 2.5.0
- Add CSS resources inlining (PR https://github.com/sinedied/backslide/pull/74)
- Fix CSS images with relative paths not inlined (#73)

# 2.4.0
- Migrate to `web-resource-inliner` instead of `inliner` (PR https://github.com/sinedied/backslide/pull/71)
- Make `decktape` an optional external dependency, fixed install on Node > 12 (#70)
- Update dependencies to fix vulnerabilities

# 2.3.7
- Republish to fix #63

# 2.3.6
- Fix pdf export and XSS vulnerability when using multiple script tags (PR https://github.com/sinedied/backslide/pull/62)

# 2.3.5
- Fix pdf export error with spaces in path (PR https://github.com/sinedied/backslide/pull/59)
- Fix doc (PR https://github.com/sinedied/backslide/pull/60)

# 2.3.4
- Update dependencies to fix vulnerability

# 2.3.3
- Fix error with spaces in path (PR https://github.com/sinedied/backslide/pull/48)
- Fix issue with `</script>` tags no being escaped (https://github.com/sinedied/backslide/issues/51)

# 2.3.2
- Fix export (working this time) (PR https://github.com/sinedied/backslide/pull/42)

# 2.3.1
- Fix export issue (https://github.com/sinedied/backslide/issues/37)

# 2.3.0
- Inline local images in markdown (PR https://github.com/sinedied/backslide/pull/16)
- Fix relative paths also in html template and sass styles (PR https://github.com/sinedied/backslide/pull/16)

# 2.2.1
- Fix export with `data:uri` images
- Add update notifier

# 2.2.0
- Add option to strip fragments on export/pdf for handouts (https://github.com/sinedied/backslide/pull/14)
- Fix relative image paths in export/pdf (https://github.com/sinedied/backslide/pull/14)

# 2.1.0
- Add support for custom template (https://github.com/sinedied/backslide/issues/12)

# 2.0.0
- Use `decktape@2` for PDF export, external installation is no more needed
- Remove support for Node 6

# 1.2.1
- Use `fs-extra` instead of deprecated `fs-promise` (PR https://github.com/sinedied/backslide/pull/6)
- Fix typo in serve example (PR https://github.com/sinedied/backslide/pull/6)

# 1.2.0
- Add option to disable resources inlining on export

# 1.1.1
- Remove browsersync notification

# 1.1.0
- Add option to skip opening browser on serve
- Add option to strip presenter notes on export

# 1.0.3
- Fix Windows compatibility

# 1.0.2
- Fix sass watch on serve

# 1.0.1
- Fix serve command
- Fix minimum node version

# 1.0.0
- Initial version