class Cli {
  constructor(args, commands, help) {
    this._args = args;
    this._commands = commands;
    this._help = help;
  }

  run() {
    const command = this._commands.find(c => c.match && c.match(args));
    if (!command) {
      console.log(help);
      this._commands.forEach(c => c.help && console.log(c.help));
      process.exit(-1);
    }
    const prehook = "pre" + command.name;
    this._commands.forEach(c => {
      if (c.hooks && c.hooks.includes(prehook)) {
        c.run(this._args, prehook);
      }
    });
    command.run(this._args, command.name);
    const posthook = "post" + command.name;
    this._commands.forEach(c => {
      if (c.hooks && c.hooks.includes(posthook)) {
        c.run(this._args, posthook);
      }
    });
  }
}

const TestCommand = {
  name = "transform",
  hooks = ["preinstall"],
  help = `t, transform: help`,

  match(args) {

  },

  run(args, context) {

  }
}

module.exports = {
  Cli,
  Command
};