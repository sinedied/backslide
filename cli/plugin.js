// const updateChecker = {
//   hooks: ['preclirun'],
//   run() {
//     updateNotifier({pkg}).notify();
//   }
// };

const child = require('child_process');
const Conf = require('conf');

const isWindows = /^win/.test(process.platform);
const pluginKey = 'backslide-plugin';

/**
 * add
 * remove
 * list
 */
const pluginCommand = {
  hooks: ['preclirun'],
  match: (args) => args._[0] === 'plugin' ? {} : undefined,

  async run (args, context) {
    // if (context.stage === 'preclirun') {

    // }
    // switch (args._[0]) {
    //   case 'a':
    //   case 'add':
    //     break;
    //   case 'r':
    //   case 'remove':
    //     break;
    //   case 'l':
    //   case 'list':
    //     break;
    // }

    const config = new Conf({
      defaults: {addons: []}
    });

    let list = await child.execSync(`npm search ${pluginKey} --json`, {stdio: [0, null, 2]});
    list = list ? JSON.parse(list) : [];
  }
};

module.exports = pluginCommand;
