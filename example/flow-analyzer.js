#!/usr/bin/env node
/**
 * Firewalla Flow Analyzer with AI Analysis
 * 
 * Fetches network flows and analyzes them with AI for anomalies,
 * suspicious traffic patterns, and security insights.
 */

const axios = require('axios');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load config
const configPath = path.join(__dirname, 'config.json');
if (!fs.existsSync(configPath)) {
  console.error('Error: config.json not found. Copy config.example.json to config.json and fill in your settings.');
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

/**
 * Call AI to analyze flows
 */
async function analyzeFlows(flows) {
  if (!config.baseUrl) {
    throw new Error('config.json must include baseUrl');
  }

  const prompt = `You are a network security analyst. Analyze these network flows and identify anomalies, suspicious activity, and security concerns.

Flow data (summary):
${JSON.stringify(flows.slice(0, 50), null, 2)}

Respond with ONLY a JSON object (no markdown, no explanation) using this exact structure:
{
  "summary": "<brief overview of traffic patterns>",
  "anomalies": [
    {
      "device": "<device name or IP>",
      "issue": "<description of suspicious activity>",
      "risk_score": <number 0-10>,
      "recommendation": "<action to take>"
    }
  ],
  "top_talkers": [
    {
      "device": "<device name>",
      "total_bytes": <number>,
      "description": "<what they're doing>"
    }
  ],
  "concerns": ["<list of security concerns>"]
}

Guidelines:
- Look for unusual data transfers (large uploads, connections to suspicious regions)
- Flag devices communicating with known bad categories (vpn, gamble, etc.)
- Identify potential data exfiltration (large uploads at odd hours)
- Note any blocked traffic patterns that might indicate malware`;

  try {
    const response = await axios.post(`${config.baseUrl}/chat/completions`, {
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1
    }, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    const content = response.data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }
    
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('AI analysis failed:', err.message);
    return null;
  }
}

/**
 * Fetch flows using the fw CLI
 */
function fetchFlows(query = '') {
  try {
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
    
    const output = execSync(`node ${path.join(__dirname, '..', 'cli', 'src', 'index.js')} flows list ${query}`, {
      encoding: 'utf8',
      env: { ...process.env, ...env }
    });
    const data = JSON.parse(output);
    return data.results || [];
  } catch (err) {
    console.error('Failed to fetch flows:', err.message);
    return [];
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value !== undefined ? value : process.argv[++i];
    }
  }
  return args;
}

/**
 * Format bytes to human-readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Main function
 */
async function main() {
  const cliArgs = parseArgs();
  
  console.log('Firewalla Flow Analyzer');
  console.log('=======================\n');
  console.log(`Model: ${config.model}\n`);
  
  // Build query
  let query = '';
  if (cliArgs.query) {
    query = `--query "${cliArgs.query}"`;
  }
  if (cliArgs.limit) {
    query += ` --limit ${cliArgs.limit}`;
  }
  
  console.log('Fetching flows...');
  const flows = fetchFlows(query);
  
  if (flows.length === 0) {
    console.log('No flows found.');
    return;
  }
  
  console.log(`Found ${flows.length} flows.\n`);
  
  // Quick stats
  let totalDownload = 0;
  let totalUpload = 0;
  const devices = new Set();
  const domains = new Set();
  
  for (const flow of flows) {
    totalDownload += flow.download || 0;
    totalUpload += flow.upload || 0;
    if (flow.device?.name) devices.add(flow.device.name);
    if (flow.destination?.name) domains.add(flow.destination.name);
  }
  
  console.log('--- Quick Stats ---');
  console.log(`Devices: ${devices.size}`);
  console.log(`Unique destinations: ${domains.size}`);
  console.log(`Total download: ${formatBytes(totalDownload)}`);
  console.log(`Total upload: ${formatBytes(totalUpload)}\n`);
  
  // AI analysis
  console.log('Analyzing with AI...');
  const analysis = await analyzeFlows(flows);
  
  if (analysis) {
    console.log('\n--- AI Analysis ---');
    console.log(`Summary: ${analysis.summary}\n`);
    
    if (analysis.anomalies?.length > 0) {
      console.log('⚠️  Anomalies detected:');
      for (const a of analysis.anomalies) {
        console.log(`\n  Device: ${a.device}`);
        console.log(`  Issue: ${a.issue}`);
        console.log(`  Risk: ${a.risk_score}/10`);
        console.log(`  Recommendation: ${a.recommendation}`);
      }
    }
    
    if (analysis.top_talkers?.length > 0) {
      console.log('\n📊 Top Talkers:');
      for (const t of analysis.top_talkers) {
        console.log(`  ${t.device}: ${formatBytes(t.total_bytes)} - ${t.description}`);
      }
    }
    
    if (analysis.concerns?.length > 0) {
      console.log('\n🔒 Security Concerns:');
      for (const c of analysis.concerns) {
        console.log(`  - ${c}`);
      }
    }
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}

module.exports = { analyzeFlows, fetchFlows };