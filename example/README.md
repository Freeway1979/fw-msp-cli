# AI Analysis Examples

AI-powered analysis examples for Firewalla alarms and flows.

## Configuration

Edit `config.json`:

```json
{
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "your-api-key",
  "model": "gpt-5.4"
}
```

### Required Fields

| Field | Description |
|-------|-------------|
| `baseUrl` | API endpoint (OpenAI-compatible format) |
| `apiKey` | Your API key |
| `model` | Model name to use |

### Provider Examples

All providers use OpenAI-compatible format:

#### OpenAI
```json
{
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-...",
  "model": "gpt-5.4"
}
```

#### OpenRouter (Free Models Available)
```json
{
  "baseUrl": "https://openrouter.ai/api/v1",
  "apiKey": "sk-or-...",
  "model": "nvidia/nemotron-3-super-120b-a12b:free"
}
```

#### Anthropic Claude
```json
{
  "baseUrl": "https://api.anthropic.com/v1",
  "apiKey": "sk-ant-...",
  "model": "claude-3-7-sonnet-20250219"
}
```

#### Google Gemini
```json
{
  "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
  "apiKey": "AIza...",
  "model": "gemini-3.1-pro"
}
```

#### Ollama (Local)
```json
{
  "baseUrl": "http://localhost:11434/v1",
  "apiKey": "ollama",
  "model": "llama3.3"
}
```

#### Custom Provider
```json
{
  "baseUrl": "https://your-llm.example.com/v1",
  "apiKey": "your-key",
  "model": "your-model"
}
```

---

# Alarm Processor

Reads alarms, analyzes them with AI, and recommends actions.

## Quick Start

```bash
cd example
cp config.example.json config.json
# Edit config.json with your AI provider settings
node alarm-processor.js        # Get all alarms
node alarm-processor.js --limit=20  # Get only 20 alarms
```

## How It Works

1. Fetches alarms using `fw alarms list`
2. Sends each alarm to AI for analysis
3. AI returns risk score (0-10) and recommended action
4. Outputs analysis results

---

# Flow Analyzer

Analyzes network flows with AI for anomalies and security insights.

## Quick Start

```bash
cd example
cp config.example.json config.json
# Edit config.json with your AI provider settings
node flow-analyzer.js                    # Analyze recent flows
node flow-analyzer.js --limit=100        # Analyze 100 flows
node flow-analyzer.js --query "region:CN"  # Analyze China traffic
```

## How It Works

1. Fetches flows using `fw flows list`
2. Sends flow data to AI for analysis
3. AI identifies anomalies, suspicious traffic, and security concerns
4. Outputs risk scores and recommendations

## Adding Custom LLMs

Any LLM with an OpenAI-compatible API will work. Simply specify:
- `baseUrl`: The API endpoint
- `apiKey`: Your authentication token
- `model`: The model identifier
