const yargs = require('yargs');
const chalk = require('chalk');
const { initializeShellEnv } = require('@nats/requests');

const { CLI_EPILOGUE, CLI_VERSION } = require('./constants');

const printBanner = () => {
  console.log(chalk.cyan(`Hey API CLI ${CLI_VERSION}`));
};

const run = async () => {
  // Fetch shell environment (useful when CLI is run as subprocess from GUI app or cron)
  await initializeShellEnv();

  const argLength = process.argv.length;
  const commandsToPrintBanner = ['--help', '-h'];

  if (argLength <= 2 || process.argv.find((arg) => commandsToPrintBanner.includes(arg))) {
    printBanner();
  }

  const { argv } = yargs
    .strict()
    .commandDir('commands')
    .epilogue(CLI_EPILOGUE)
    .usage('Usage: $0 <command> [options]')
    .demandCommand(1, 'What would you like to do? Run $0 --help to see available commands.')
    .help('h')
    .alias('h', 'help');
};

module.exports = {
  run
};
