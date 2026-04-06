# Firewalla MSP CLI - Flows Skill

## Description
This skill enables the agent to interact with Firewalla network flow data. You can query traffic patterns, filter by device/domain/region, detect anomalies, and analyze upload activity for potential data exfiltration.

The flows CLI is a **database-like query interface** for network traffic. Use it to pull any flow data needed for analysis, security checks, or troubleshooting.

## Core Rules
1. **Server-side filtering:** All filtering happens on the server. Use `--query`, `--since`, `--until`, `--blocked` flags. Never fetch all data and filter locally.
2. **Box Routing:** If the user has multiple boxes, you MUST append `--box <gid>` to every command. If they have only one box, it will automatically route.
3. **JSON Output:** All `list` commands return structured JSON. Parse it to extract insights.
4. **Use --stats for summaries:** For large datasets, use `--stats` to get aggregated statistics instead of raw flow data. This is token-efficient.
5. **Use --all for complete data:** When you need ALL results (not just the first 200-500), use `--all` for auto-pagination.
6. **Combine flags strategically:** Mix filtering, sorting, and grouping to get exactly the data needed.

## Commands

### List Flows
Fetches network flows with flexible filtering.

**Syntax:** `fw flows list [flags]`

---

## Filtering Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--query` | Search query with qualifiers | `--query "Device:iphone direction:outbound"` |
| `--since` | Time filter (relative or absolute) | `--since 2h`, `--since 1d`, `--since 2024-01-01` |
| `--until` | End time filter | `--until 2024-01-02` |
| `--blocked` | Only blocked flows | `--blocked` |
| `--box` | Target specific box | `--box MyFirewalla` |

### Time Formats for --since / --until
- Relative: `30s`, `5m`, `2h`, `1d` (seconds, minutes, hours, days)
- Absolute: `2024-01-01`, `2024-01-01T12:00:00`

---

## Output Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--limit` | Max results (auto-paginates if >500) | `--limit 1000` |
| `--stats` | Aggregated statistics (compact) | `--stats` |
| `--all` | Fetch ALL results via pagination | `--all` |
| `--groupBy` | Group by field | `--groupBy device`, `--groupBy category` |
| `--sortBy` | Sort order | `--sortBy upload:desc`, `--sortBy total:asc` |
| `--cursor` | Manual pagination cursor | `--cursor "abc123"` |

---

## Query Qualifiers

Use with `--query` to filter flows. Combine multiple qualifiers with spaces.

### Device & Network
| Qualifier | Alias | Example |
|-----------|-------|---------|
| `device.id` | Mac | `Mac:"AA:BB:CC:DD:EE:FF"` |
| `device.name` | Device | `Device:iphone` |
| `network.name` | Network | `Network:Guest` |
| `network.id` | | `network.id:00000000-1111-1111-1111-000000000000` |

### Traffic Properties
| Qualifier | Alias | Example |
|-----------|-------|---------|
| `direction` | | `direction:outbound`, `direction:inbound`, `direction:local` |
| `status` | | `status:ok`, `status:blocked` |
| `protocol` | | `protocol:tcp`, `protocol:udp` |
| `block` | | `block:true`, `block:false` |

### Destination Intelligence
| Qualifier | Alias | Example |
|-----------|-------|---------|
| `domain` | Domain | `Domain:google.com` |
| `category` | Category | `Category:vpn,game,intel` |
| `region` | Region | `Region:US,CN,RU` |

### Ports
| Qualifier | Alias | Example |
|-----------|-------|---------|
| `sport` | SourcePort | `SourcePort:123` |
| `dport` | DestinationPort | `DestinationPort:443` |

### Data Volume (bytes)
| Qualifier | Alias | Example |
|-----------|-------|---------|
| `download` | Download | `download:>1000000` |
| `upload` | Upload | `upload:>1000000` |
| `total` | Total | `total:>5000000` |

### Timestamp
| Qualifier | Example |
|-----------|---------|
| `ts` | `ts:>1700000000`, `ts:<1700100000` |

### Operators for Numeric Fields
- `:>` - Greater than
- `:<` - Less than
- `:>=` - Greater than or equal
- `:<=` - Less than or equal

---

## Common Query Patterns

### Device-Specific Traffic
```bash
# All traffic from a specific device
fw flows list --query "Device:iphone" --limit 100

# Outbound traffic from a device
fw flows list --query "Device:iphone direction:outbound" --limit 100

# Traffic from a device by MAC address
fw flows list --query "Mac:AA:BB:CC:DD:EE:FF" --limit 100
```

### Domain & Category Analysis
```bash
# Traffic to specific domain
fw flows list --query "Domain:google.com" --limit 100

# Traffic to specific categories
fw flows list --query "Category:intel" --limit 100
fw flows list --query "Category:vpn,gambling" --limit 100

# Blocked intel traffic
fw flows list --query "Category:intel block:true" --limit 100
```

### Region-Based Filtering
```bash
# Traffic to/from specific countries
fw flows list --query "Region:CN" --limit 100
fw flows list --query "Region:RU direction:inbound" --limit 100
```

### Port Analysis
```bash
# Traffic on specific ports
fw flows list --query "DestinationPort:443" --limit 100
fw flows list --query "DestinationPort:22" --limit 100  # SSH
fw flows list --query "DestinationPort:3389" --limit 100  # RDP
```

### Volume-Based Filtering
```bash
# High download flows (>10MB)
fw flows list --query "download:>10000000" --sortBy download:desc --limit 50

# High upload flows (>1MB)
fw flows list --query "upload:>1000000" --sortBy upload:desc --limit 50

# Large total transfers (>50MB)
fw flows list --query "total:>50000000" --sortBy total:desc --limit 50
```

### Time-Based Queries
```bash
# Flows in the last hour
fw flows list --since 1h --limit 100

# Flows between specific times
fw flows list --since "2024-01-01" --until "2024-01-02" --limit 100

# Recent blocked traffic
fw flows list --since 30m --blocked --limit 50
```

---

## Aggregation Patterns

### Group By Device
```bash
# Top devices by total traffic
fw flows list --since 24h --groupBy device --sortBy total:desc --limit 10

# Top devices by upload
fw flows list --since 24h --groupBy device --sortBy upload:desc --limit 10
```

### Group By Category
```bash
# Traffic breakdown by category
fw flows list --since 24h --groupBy category --stats --all
```

### Group By Region
```bash
# Traffic breakdown by region
fw flows list --since 24h --groupBy region --stats --all
```

### Full Statistics
```bash
# Complete 24h stats (most efficient)
fw flows list --since 24h --stats --all
```

---

## Typical Agent Workflows

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
   - `fw flows list --since 24h --query "Region:RU" --limit 100`

### Upload Anomaly Detection
If a user asks about "unusual uploads" or "data exfiltration":
1. Run `fw flows list --since 24h --sortBy upload:desc --limit 100`
2. Look for:
   - Large uploads to unusual destinations
   - Frequent small uploads to suspicious regions (beaconing)
   - Unknown devices with significant upload volume
3. Flag anything to intel/VPN/suspicious categories
4. Drill down: `fw flows list --since 24h --query "upload:>1000000" --limit 50`

### Traffic Summary
If a user asks "what's happening on the network":
1. Run `fw flows list --since 24h --stats --all`
2. Run `fw flows list --since 24h --groupBy device --sortBy total:desc --limit 10`
3. Summarize: total flows, blocked count, top devices, notable patterns

### Device Investigation
If a user asks "what is [device] doing on the network":
1. Run `fw flows list --since 24h --query "Device:[name]" --limit 100`
2. Run `fw flows list --since 24h --query "Device:[name]" --groupBy domain --stats`
3. Report: destinations, categories, regions, data volume

### Blocked Traffic Analysis
If a user asks "what's being blocked":
1. Run `fw flows list --since 24h --blocked --limit 100`
2. Run `fw flows list --since 24h --blocked --groupBy region --stats`
3. Report: top source regions, categories, patterns

### High-Bandwidth Detection
If a user asks "who's using the most bandwidth":
1. Run `fw flows list --since 24h --groupBy device --sortBy total:desc --limit 10`
2. Run `fw flows list --since 24h --query "total:>100000000" --sortBy total:desc --limit 20`
3. Report: top consumers, their destinations, and traffic types

---

## Response Format for Analysis

When analyzing flows, provide:
- **Overall Risk Rating:** 0-10
- **Summary:** Brief overview of traffic patterns
- **Key Findings:** Notable patterns, anomalies, concerns
- **Recommendations:** Actionable items
- **Follow-up Commands:** Specific fw commands to investigate further