# Firewalla MSP CLI - Alarms Skill

## Description
This skill enables the agent to interact with Firewalla security alarms. You can fetch recent alarms, filter by device, status, or alarm type, and analyze security events on the network.

The alarms CLI is a **security event query interface** for the Firewalla MSP platform. Use it to pull alarm data for incident response, security audits, or network monitoring.

## Core Rules
1. **Use `--params` for filtering:** All filter parameters are passed via a valid JSON string (e.g., `--params '{"status": "active"}'`). Do not hallucinate flags like `--active`.
2. **Box Routing:** If the user has multiple boxes, you MUST append `--box <gid>` to every command. If they have only one box, it will automatically route.
3. **JSON Output:** All `list` commands return structured JSON. Parse it to extract insights.
4. **Supported params:** `limit`, `cursor`, `query`, `groupBy`, `sortBy`

## Commands

### List Alarms
Fetches security alarms with flexible filtering.

**Syntax:** `fw alarms list [flags]`

---

## Filtering via --params

Pass a JSON string with any of these parameters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `limit` | Max results | `{"limit": 25}` |
| `cursor` | Pagination cursor | `{"cursor": "abc123"}` |
| `query` | Search query with qualifiers | `{"query": "device.id:AA:BB:CC:DD:EE:FF"}` |
| `groupBy` | Group by field | `{"groupBy": "type"}` |
| `sortBy` | Sort order | `{"sortBy": "ts:desc"}` |

---

## Query Qualifiers

Use with `query` inside `--params` to filter alarms. Combine multiple qualifiers with spaces.

### Device & Network
| Qualifier | Alias | Example |
|-----------|-------|---------|
| `device.id` | Mac | `device.id:"AA:BB:CC:DD:EE:FF"` |
| `device.name` | Device | `device.name:iphone` |
| `box.name` | Box | `box.name:FirewallaGold` |
| `box.group.id` | | `box.group.id:1` |

### Alarm Properties
| Qualifier | Alias | Example |
|-----------|-------|---------|
| `type` | AlarmType | `type:1,2,3` or `AlarmType:"Security Activity"` |
| `status` | | `status:active`, `status:archived` |

### Destination Intelligence
| Qualifier | Alias | Example |
|-----------|-------|---------|
| `remote.category` | Category | `remote.category:vpn,game` |
| `remote.domain` | Domain | `remote.domain:google.com` |
| `remote.region` | Region | `remote.region:US` |

### Data Volume
| Qualifier | Alias | Example |
|-----------|-------|---------|
| `transfer.download` | Download | `download:>10MB` |
| `transfer.upload` | Upload | `upload:>10MB` |
| `transfer.total` | Total | `total:>50MB` |

### Timestamp
| Qualifier | Example |
|-----------|---------|
| `ts` | `ts:<1695196894`, `ts:>1695100000` |

---

## Common Alarm Types

Alarm types are identified by the `_type` field or numeric `type` ID. To see all alarm types in your environment:

```bash
fw alarms list --params '{"groupBy": "type", "limit": 50}'
```

**Verified alarm types in this environment:**

| Type ID | Description |
|---------|-------------|
| 1 | Security Activity |
| 2 | Abnormal Upload |
| 5 | Device Online |
| 12 | VPN Restored |
| 13 | VPN Disconnected |
| 15 | (varies) |

> Note: Alarm type IDs and names may vary by environment. Always use `groupBy: type` to discover available types.

---

## Common Query Patterns

### Status-Based Filtering
```bash
# Active (unresolved) alarms only
fw alarms list --params '{"status": "active"}'

# Archived (resolved) alarms
fw alarms list --params '{"status": "archived"}'
```

### Device-Specific Alarms
```bash
# Alarms for a specific device by MAC
fw alarms list --params '{"query": "device.id:AA:BB:CC:DD:EE:FF"}'

# Alarms for a specific device by name
fw alarms list --params '{"query": "device.name:iphone"}'
```

### Alarm Type Filtering
```bash
# Security activity alarms only
fw alarms list --params '{"query": "type:1"}'

# Multiple alarm types
fw alarms list --params '{"query": "type:1,2,3"}'

# By alarm type name
fw alarms list --params '{"query": "AlarmType:\"Security Activity\""}'
```

### Time-Based Queries
```bash
# Recent alarms (by timestamp)
fw alarms list --params '{"query": "ts:>1700000000"}'

# Alarms before a specific time
fw alarms list --params '{"query": "ts:<1700100000"}'
```

### Region & Category Filtering
```bash
# Alarms related to specific regions
fw alarms list --params '{"query": "remote.region:CN"}'

# Alarms related to specific categories
fw alarms list --params '{"query": "remote.category:vpn"}'
```

### Combined Filters
```bash
# Active security alarms for a specific device, limit 10
fw alarms list --params '{"status": "active", "query": "type:1 device.id:AA:BB:CC:DD:EE:FF", "limit": 10}'

# Recent alarms with high bandwidth usage
fw alarms list --params '{"query": "type:3 ts:>1700000000", "limit": 20}'
```

---

## Aggregation Patterns

### Group By Alarm Type
```bash
# Alarm breakdown by type
fw alarms list --params '{"groupBy": "type", "limit": 50}'
```

### Group By Device
```bash
# Alarms per device
fw alarms list --params '{"groupBy": "device.id", "limit": 50}'
```

### Sort By Time
```bash
# Most recent alarms first (default)
fw alarms list --params '{"sortBy": "ts:desc", "limit": 25}'

# Oldest alarms first
fw alarms list --params '{"sortBy": "ts:asc", "limit": 25}'
```

---

## Typical Agent Workflows

### Security Check
If a user asks you to "check for security issues" or "any security alerts":
1. Run `fw alarms list --params '{"status": "active", "query": "type:1", "limit": 25}'`
2. Analyze the returned alarms for:
   - Malware or intrusion attempts
   - Suspicious device behavior
   - Connections to known bad destinations
3. Report findings with device names, timestamps, and severity

### Device Investigation
If a user asks "what alarms are there for [device]":
1. Run `fw alarms list --params '{"query": "device.name:[name]", "limit": 50}'`
2. If no results, try MAC address: `fw alarms list --params '{"query": "device.id:AA:BB:CC:DD:EE:FF", "limit": 50}'`
3. Report: alarm types, timestamps, status, and descriptions

### Recent Events Summary
If a user asks "what happened on the network recently":
1. Run `fw alarms list --params '{"limit": 50, "sortBy": "ts:desc"}'`
2. Summarize: total alarms, active vs archived, most common types
3. Highlight any critical or unusual events

### Alarm Type Analysis
If a user asks "what kind of alarms are most common":
1. Run `fw alarms list --params '{"groupBy": "type", "limit": 50}'`
2. Report: breakdown by type with counts
3. Identify patterns (e.g., frequent device offline events)

### Regional Threat Analysis
If a user asks "are there alarms from specific countries":
1. Run `fw alarms list --params '{"query": "remote.region:CN", "limit": 25}'`
2. Run `fw alarms list --params '{"query": "remote.region:RU", "limit": 25}'`
3. Report: alarm counts by region, types of events

---

## Alarm Object Structure

```json
{
  "gid": "00000000-0000-0000-0000-000000000000",
  "aid": 12345,
  "status": 1,
  "ts": 1730447700.000,
  "type": 12,
  "count": 1,
  "_type": "ALARM_VPN_RESTORE",
  "activeTs": 1730447700.000,
  "cloudaction": "",
  "message": "VPN restored message"
}
```

| Field | Description |
|-------|-------------|
| `gid` | Alarm unique identifier |
| `aid` | Alarm ID number |
| `status` | 1 = active, 0 = archived |
| `ts` | Timestamp when alarm occurred |
| `type` | Alarm type number |
| `_type` | Alarm type string name |
| `message` | Human-readable description |
| `count` | Number of occurrences |

---

## Response Format for Analysis

When analyzing alarms, provide:
- **Summary:** Brief overview of alarm situation
- **Key Findings:** Notable alarms, patterns, concerns
- **Affected Devices:** List of devices involved
- **Recommendations:** Actionable items
- **Follow-up Commands:** Specific fw commands to investigate further