# 3.0.0
- Complete refatoring of the code
- Fixed </script> tags breaking export
- Added transform commands
- Misc fixes I don't remember :-)

# 2.3.0
- Inline local images in markdown (PR https://github.com/sinedied/backslide/pull/16)
- Fixed relative paths also in html template and sass styles (PR https://github.com/sinedied/backslide/pull/16)

# 2.2.1
- Fixed export with `data:uri` images
- Added update notifier

# 2.2.0
- Added option to strip fragments on export/pdf for handouts (https://github.com/sinedied/backslide/pull/14)
- Fixed relative image paths in export/pdf (https://github.com/sinedied/backslide/pull/14)

# 2.1.0
- Added support for custom template (https://github.com/sinedied/backslide/issues/12)

# 2.0.0
- Use `decktape@2` for PDF export, external installation is no more needed
- Removed support for Node 6

# 1.2.1
- Use `fs-extra` instead of deprecated `fs-promise` (PR https://github.com/sinedied/backslide/pull/6)
- Fixed typo in serve example (PR https://github.com/sinedied/backslide/pull/6)

# 1.2.0
- Added option to disable resources inlining on export

# 1.1.1
- Removed browsersync notification

# 1.1.0
- Added option to skip opening browser on serve
- Added option to strip presenter notes on export

# 1.0.3
- Fixed Windows compatibility

# 1.0.2
- Fixed sass watch on serve

# 1.0.1
- Fixed serve command
- Fixed minimum node version

# 1.0.0
- Initial version