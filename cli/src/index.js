#!/usr/bin/env node
require('dotenv').config();
const { Command } = require('commander');
const Alarms = require('./commands/alarms');
const Flows = require('./commands/flows');

const program = new Command();

program
  .name('fw')
  .description('Firewalla MSP CLI')
  .version('1.0.0')
  .option('-v, --debug', 'Output debug info', false)
  .option('-d, --domain <domain>', 'MSP Domain (e.g. company.firewalla.net)');

const alarms = program.command('alarms').description('Manage network alarms');

alarms
  .command('list')
  .description('List alarms from a specific box')
  .option('--box <name|gid>', 'Box Name or GID')
  .option('--params <json>', 'API filters')
  .action((options) => {
    Alarms.list({ ...options, ...program.opts() });
  });

const flows = program.command('flows').description('Manage network flows');

flows
  .command('list')
  .description('List network flows with flexible filtering')
  .option('--box <name|gid>', 'Box Name or GID')
  .option('--query <query>', 'Search query (e.g., "Device:iphone direction:outbound")')
  .option('--since <time>', 'Flows since (e.g., "2h", "30m", "1d", "2024-01-01")')
  .option('--until <time>', 'Flows until (e.g., "2h", "30m", "1d", "2024-01-01")')
  .option('--blocked', 'Only show blocked flows')
  .option('--stats', 'Show aggregated statistics instead of raw data')
  .option('--groupBy <fields>', 'Group results (e.g., "domain,box")')
  .option('--sortBy <fields>', 'Sort results (e.g., "ts:desc,total:asc")')
  .option('--limit <n>', 'Max results (<=500, default 200)')
  .option('--cursor <cursor>', 'Pagination cursor')
  .option('--params <json>', 'Raw API parameters')
  .action((options) => {
    Flows.list({ ...options, ...program.opts() });
  });

program.parse(process.argv);
