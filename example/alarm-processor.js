#!/usr/bin/env node
/**
 * Firewalla Alarm Processor with AI Analysis
 *
 * Reads alarms, analyzes them with AI, and takes action based on risk score.
 * Supports multiple AI providers: OpenAI, Anthropic, OpenRouter, Ollama
 */

const axios = require('axios');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load config
const configPath = path.join(process.env.HOME, 'llm_config.json');
if (!fs.existsSync(configPath)) {
  console.error('Error: config.json not found. Copy config.example.json to config.json and fill in your settings.');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Normalize config: support both single provider and providers array
const providers = config.providers || [{ name: config.model, ...config }];

/**
 * Call AI to analyze an alarm using a specific provider
 */
async function analyzeAlarm(alarm, provider) {
  if (!provider.baseUrl) {
    throw new Error('provider must include baseUrl');
  }

  const prompt = `You are a network security analyst. Analyze this Firewalla alarm and respond with ONLY a JSON object (no markdown, no explanation).

Alarm data:
${JSON.stringify(alarm, null, 2)}

Respond with this exact JSON structure:
{
  "risk_score": <number 0-10>,
  "action": "<block|delete|ignore>",
  "reason": "<brief explanation>"
}

Guidelines:
- risk_score 0-3: Low risk, usually safe activity
- risk_score 4-6: Medium risk, investigate further
- risk_score 7-10: High risk, likely malicious
- "block" for high-risk threats that should be blocked
- "delete" for false positives or resolved issues
- "ignore" for low-risk or informational alarms`;

  let delay = 2000;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const response = await callOpenAICompatible(provider, prompt);

      // Parse the AI response
      const content = response.choices?.[0]?.message?.content || response.content?.[0]?.text || '';

      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      if (err.response?.status === 429 && attempt < 5) {
        console.warn(`[${provider.name}] Rate limited, retrying in ${delay / 1000}s... (attempt ${attempt}/5)`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      } else {
        console.error(`[${provider.name}] AI analysis failed:`, err.message);
        return { risk_score: 5, action: 'ignore', reason: 'AI analysis failed' };
      }
    }
  }
}

/**
 * Call OpenAI-compatible API (OpenAI, OpenRouter, Ollama, etc.)
 */
async function callOpenAICompatible(provider, prompt) {
  const response = await axios.post(`${provider.baseUrl}/chat/completions`, {
    model: provider.model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1
  }, {
    headers: {
      'Authorization': `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
}


/**
 * Fetch alarms using the fw CLI
 */
function fetchAlarms(limitParam = '') {
  try {
    const output = execSync(`node ${path.join(__dirname, '..', 'cli', 'src', 'index.js')} alarms list ${limitParam}`, {
      encoding: 'utf8',
      env: { ...process.env, ...loadEnv() }
    });
    const data = JSON.parse(output);
    return data.results || [];
  } catch (err) {
    console.error('Failed to fetch alarms:', err.message);
    return [];
  }
}

/**
 * Load environment variables from .env file
 */
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const env = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        env[match[1].trim()] = match[2].trim();
      }
    }
  }
  return env;
}


/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--help' || arg === '-h') {
      console.log(`
Firewalla Alarm Processor - AI-powered alarm analysis

USAGE:
  node alarm-processor.js [options]

OPTIONS:
  --limit=N              Process only the N most recent alarms (default: all)
  --alarm_type=TYPE      Filter alarms by number or description:
                            1  Security Activity
                            2  Abnormal Upload
                            3  Large Bandwidth Usage
                            4  Monthly Data Plan
                            5  New Device
                            6  Device Back Online
                            7  Device Offline
                            8  Video Activity
                            9  Gaming Activity
                           10  Porn Activity
                           11  VPN Activity
                           12  VPN Connection Restored
                           13  VPN Connection Error
                           14  Open Port
                           15  Internet Connectivity Update
                           16  Large Upload
  --alarm_subtype=TYPE   Filter by _type string (client-side). Known subtypes for type 1:
                           ALARM_INTEL
                           ALARM_CUSTOMIZED_SECURITY
  --help, -h             Show this help message

SETUP:
  Requires ~/llm_config.json - single provider:
    {
      "baseUrl": "https://api.anthropic.com/v1",
      "apiKey":  "your-api-key",
      "model":   "claude-sonnet-4-6"
    }

  Or multiple providers for comparison:
    {
      "providers": [
        { "name": "Claude", "baseUrl": "https://api.anthropic.com/v1", "apiKey": "sk-ant-...", "model": "claude-sonnet-4-6" },
        { "name": "GPT-4",  "baseUrl": "https://api.openai.com/v1",    "apiKey": "sk-...",     "model": "gpt-4o" }
      ]
    }

  Requires environment variables:
    FIREWALLA_MSP_TOKEN   Your Firewalla MSP API token
    FIREWALLA_MSP_ID      Your MSP domain (e.g. company.firewalla.net)

EXAMPLES:
  node alarm-processor.js                                              # Analyze all alarms
  node alarm-processor.js --limit=10                                   # Analyze 10 most recent alarms
  node alarm-processor.js --alarm_type=9                               # Gaming alarms
  node alarm-processor.js --alarm_type=1                               # All security alarms
  node alarm-processor.js --alarm_type=1 --alarm_subtype=ALARM_INTEL  # Intel security alarms only
  node alarm-processor.js --limit=20 --alarm_type=16                  # Combined
`);
      process.exit(0);
    }
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (value !== undefined) {
        args[key] = value;
      } else {
        // Next argument is the value
        args[key] = process.argv[++i];
      }
    }
  }
  return args;
}

/**
 * Main function
 */
async function main() {
  // Parse command line arguments
  const cliArgs = parseArgs();

  console.log('Firewalla Alarm Processor');
  console.log('========================\n');
  console.log(`Providers: ${providers.map(p => p.name).join(', ')}\n`);

  // Build API params
  const apiParams = {};
  let limitLog = 'all';

  if (cliArgs.limit !== undefined) {
    const limit = parseInt(cliArgs.limit);
    if (!isNaN(limit) && limit > 0) {
      apiParams.limit = limit;
      limitLog = limit.toString();
    } else {
      console.error('Invalid limit value. Must be a positive integer.');
      process.exit(1);
    }
  }

  const alarmType = cliArgs.alarm_type;
  const alarmTypeNum = alarmType !== undefined ? parseInt(alarmType) : NaN;
  if (alarmType) {
    apiParams.query = `type:${!isNaN(alarmTypeNum) ? alarmTypeNum : alarmType}`;
  }

  const limitParam = Object.keys(apiParams).length ? `--params '${JSON.stringify(apiParams)}'` : '';

  const alarmSubtype = cliArgs.alarm_subtype;

  console.log(`Fetching ${limitLog} alarms${alarmType ? ` of type ${alarmType}` : ''}${alarmSubtype ? ` / subtype ${alarmSubtype}` : ''}...`);
  let alarms = fetchAlarms(limitParam);

  if (alarmSubtype) {
    alarms = alarms.filter(a => a._type === alarmSubtype);
  }

  if (alarms.length === 0) {
    console.log('No alarms found.');
    return;
  }

  console.log(`Found ${alarms.length} alarms.\n`);

  // Process each alarm
  for (let i = 0; i < alarms.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 1000));
    const alarm = alarms[i];

    // Run all providers in parallel
    const results = await Promise.all(providers.map(p => analyzeAlarm(alarm, p)));

    console.log(`\n--- Alarm ${alarm.aid} ---`);
    console.log(`Type: ${alarm._type}`);
    console.log(`Message: ${alarm.message}`);

    results.forEach((analysis, idx) => {
      console.log(`\n  [${providers[idx].name}]`);
      console.log(`    Risk Score:       ${analysis.risk_score}/10`);
      console.log(`    Suggested Action: ${analysis.action}`);
      console.log(`    Reason:           ${analysis.reason}`);
    });
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}

module.exports = { analyzeAlarm, fetchAlarms };
