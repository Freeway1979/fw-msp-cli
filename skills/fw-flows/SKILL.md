# Firewalla MSP CLI - Flows Skill

## Description
This skill enables the agent to interact with Firewalla network flow data. You can query traffic patterns, filter by device/domain/region, detect anomalies, and analyze upload activity for potential data exfiltration.

## Core Rules
1. **Server-side filtering:** All filtering happens on the server. Use `--query`, `--since`, `--until`, `--blocked` flags. Never fetch all data and filter locally.
2. **Box Routing:** If the user has multiple boxes, you MUST append `--box <gid>` to every command. If they have only one box, it will automatically route.
3. **JSON Output:** All `list` commands return structured JSON. Parse it to extract insights.
4. **Use --stats for summaries:** For large datasets, use `--stats` to get aggregated statistics instead of raw flow data.
5. **Use --all for complete data:** When you need ALL results (not just the first 200-500), use `--all` for auto-pagination.

## Commands

### List Flows
Fetches network flows with flexible filtering.

**Syntax:** `fw flows list [flags]`

**Filtering Flags:**
| Flag | Description | Example |
|------|-------------|---------|
| `--query` | Search query with qualifiers | `--query "Device:iphone direction:outbound"` |
| `--since` | Time filter | `--since 2h`, `--since 1d`, `--since 2024-01-01` |
| `--until` | End time filter | `--until 2024-01-02` |
| `--blocked` | Only blocked flows | `--blocked` |
| `--box` | Target specific box | `--box MyFirewalla` |

**Output Flags:**
| Flag | Description | Example |
|------|-------------|---------|
| `--limit` | Max results (auto-paginates if >500) | `--limit 1000` |
| `--stats` | Aggregated statistics | `--stats` |
| `--all` | Fetch ALL results via pagination | `--all` |
| `--groupBy` | Group by field | `--groupBy device` |
| `--sortBy` | Sort order | `--sortBy upload:desc` |

**Query Qualifiers:**
| Qualifier | Alias | Example |
|-----------|-------|---------|
| `ts` | | `ts:>1700000000` |
| `status` | | `status:ok` |
| `direction` | | `direction:outbound` |
| `box.name` | Box | `Box:FirewallaGold` |
| `device.id` | Mac | `Mac:"AA:BB:CC:DD:EE:FF"` |
| `device.name` | Device | `Device:iphone` |
| `network.name` | Network | `Network:Guest` |
| `category` | Category | `Category:vpn,game` |
| `domain` | Domain | `Domain:google.com` |
| `region` | Region | `Region:US` |
| `sport` | SourcePort | `SourcePort:123` |
| `dport` | DestinationPort | `DestinationPort:443` |
| `download` | Download | `download:>1000000` |
| `upload` | Upload | `upload:>1000000` |
| `total` | Total | `total:>5000000` |

**Operators:** `:>`, `:<`, `:>=`, `:<=` for numeric fields. Combine multiple qualifiers with spaces.

**Examples:**
* Get 24-hour traffic stats (compact, efficient):
  `fw flows list --since 24h --stats --all`
* Find device with most traffic:
  `fw flows list --since 24h --groupBy device --sortBy total:desc --limit 10`
* Check blocked traffic patterns:
  `fw flows list --since 24h --blocked --limit 100`
* Find high-upload flows:
  `fw flows list --since 24h --sortBy upload:desc --limit 100`
* Query specific device traffic:
  `fw flows list --since 24h --query "Device:iphone direction:outbound"`

## Typical Agent Workflow

### Security Analysis
If a user asks you to "check for security issues" or "analyze network traffic":
1. Run `fw flows list --since 24h --stats --all` to get overview
2. Run `fw flows list --since 24h --sortBy upload:desc --limit 100` to check uploads
3. Analyze the results for:
   - High intel/malware category counts
   - Unusual regions or protocols
   - Suspicious upload patterns
   - Devices with abnormal traffic
4. If concerns found, drill down with specific queries:
   - `fw flows list --since 24h --query "Category:intel" --limit 100`
   - `fw flows list --since 24h --query "Region:CN" --limit 100`

### Upload Anomaly Detection
If a user asks about "unusual uploads" or "data exfiltration":
1. Run `fw flows list --since 24h --sortBy upload:desc --limit 100`
2. Look for:
   - Large uploads to unusual destinations
   - Frequent small uploads to suspicious regions (beaconing)
   - Unknown devices with significant upload volume
3. Flag anything to intel/VPN/suspicious categories

### Traffic Summary
If a user asks "what's happening on the network":
1. Run `fw flows list --since 24h --stats --all`
2. Run `fw flows list --since 24h --groupBy device --sortBy total:desc --limit 10`
3. Summarize: total flows, blocked count, top devices, notable patterns