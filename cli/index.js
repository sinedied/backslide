const minimist = require('minimist');
const Cli = require('./cli');
const pluginCommand = require('./plugin.js');

const help = `testcli <command> [option]`;

class TestCli extends Cli {
  constructor(args) {
    super(minimist(args, {}, [pluginCommand], help));
  }
}

module.exports = TestCli;
