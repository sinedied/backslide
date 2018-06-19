/**
 * Creates a new CLI instance.
 * @param {Object} args Arguments that will passed to each command for matching and execution.
 * @param {Array} commands List of commands that makes up this CLI.
 * @param {String|Function} help Help message to display when no command match. If a function is specified, the CLI
 *   instance will be passed as an argument, and it should return the help string.
 *
 * A command is an object with this shape:
 * ```js
 * {
 *   name: String,    // name of the command, must be set for matchable command and will be used for hooks
 *   help: String,    // help displayed for this command when no command match
 *   hooks: String[]  // hooks on which the command will be run, in the form <pre|post><command_name>
 *   match: (args) => Promise|Object,          // return context data if the command match or undefined
 *   run: (args, context) => Promise|undefined // execute the command for the specified context
 * }
 * ```
 * Note that `match` and `run` functions can return a promise if asynchronous work is needed.
 *
 * A context is an object with this shape:
 * ```js
 * {
 *   stage: String,   // the current execution stage, in the form [pre|post]<matched_command>
 *   data: Object     // the context data return by the prepare method of the matched command
 * }
 * ```
 *
 * Note that 2 special commands hooks are also available, with the CLI instance passed as context data:
 * - preclirun  : run before any other CLI action
 * - postclirun : run before exiting CLI after a successful command run
 *
 * The CLI command run lifecycle can resumed as:
 *
 *  [preclirun hooks]
 *          v
 *   [match command]--no match-->[show help]
 *          v
 * [pre<command>hooks]
 *          v
 *     [<command>]
 *          v
 * [post<command> hooks]
 *          v
 *  [postclirun hooks]
 */
class Cli {
  constructor(args, commands, help) {
    this.args = args;
    this.commands = commands;
    this.help = help;
  }

  async run() {
    let data;
    const command = this.commands.find(async c => {
      data = c.math ? await c.match(this.args) : undefined;
      return data !== undefined;
    });
    if (!command) {
      console.log(this.help);
      this.commands.forEach(c => c.help && console.log(c.help));
      process.exit(-1);
    } else if (!command.name) {
      Cli.exit('Error, matched command has no name!');
    }
    const prehook = 'pre' + command.name;
    this.commands.forEach(async c => {
      if (c.hooks && c.hooks.includes(prehook) && c.run) {
        await c.run(this.args, {stage: prehook, data});
      }
    });
    if (!command.run) {
      Cli.exit('Error, matched command has run function!');
    }
    await command.run(this.args, {stage: command.name, data});
    const posthook = 'post' + command.name;
    this.commands.forEach(async c => {
      if (c.hooks && c.hooks.includes(posthook) && c.run) {
        await c.run(this.args, {stage: posthook, data});
      }
    });
  }

  static exit(error, code = -1) {
    console.error(error);
    process.exit(code);
  }
}

module.exports = Cli;

// TODO: test CLI + async commands
