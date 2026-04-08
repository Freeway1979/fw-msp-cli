#!/usr/bin/env node
require('dotenv').config();
const { Command } = require('commander');
const Alarms = require('./commands/alarms');
const Devices = require('./commands/devices');
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

alarms
  .command('archive <aid>')
  .description('Archive (dismiss) an alarm by ID')
  .option('--box <name|gid>', 'Box Name or GID')
  .action((aid, options) => {
    Alarms.archive(aid, { ...options, ...program.opts() });
  });

alarms
  .command('delete <aid>')
  .description('Permanently delete an alarm by ID')
  .option('--box <name|gid>', 'Box Name or GID')
  .action((aid, options) => {
    Alarms.delete(aid, { ...options, ...program.opts() });
  });

const devices = program.command('devices').description('Manage network devices');

devices
  .command('list')
  .description('List devices on a specific box')
  .option('--box <name|gid>', 'Box Name or GID')
  .option('--online', 'Only show online devices')
  .option('--offline', 'Only show offline devices')
  .option('--group <name>', 'Filter by group name (e.g. "Quarantine")')
  .option('--network <name>', 'Filter by network name (e.g. "LAN 1")')
  .option('--type <type>', 'Filter by device type (e.g. "camera", "phone")')
  .option('--query <query>', 'Search by name, IP, MAC, or vendor (substring)')
  .option('--params <json>', 'Raw API parameters')
  .action((options) => {
    Devices.list({ ...options, ...program.opts() });
  });

devices
  .command('get <id>')
  .description('Get a device by MAC address, IP, or name')
  .option('--box <name|gid>', 'Box Name or GID')
  .action((id, options) => {
    Devices.get(id, { ...options, ...program.opts() });
  });

devices
  .command('rename <id> <name>')
  .description('Rename a device (resolve by MAC, IP, or current name)')
  .option('--box <name|gid>', 'Box Name or GID')
  .action((id, name, options) => {
    Devices.rename(id, name, { ...options, ...program.opts() });
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
  .option('--all', 'Fetch all results via auto-pagination (ignores limit)')
  .option('--groupBy <fields>', 'Group results (e.g., "domain,box")')
  .option('--sortBy <fields>', 'Sort results (e.g., "ts:desc,total:asc")')
  .option('--limit <n>', 'Max results (auto-paginates if >500, default 200)')
  .option('--cursor <cursor>', 'Pagination cursor')
  .option('--params <json>', 'Raw API parameters')
  .action((options) => {
    Flows.list({ ...options, ...program.opts() });
  });

program.parse(process.argv);
