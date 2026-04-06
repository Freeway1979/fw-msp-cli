# Firewalla MSP API CLI Design

**MSP API Documentation:** https://docs.firewalla.net/

## Global CLI Behavior

- **JSON by Default:** All resource-fetching commands output raw, structured JSON to stdout by default. No `--json` flag is required.
- **Smart Box Routing:** If the authenticated MSP account only has one Firewalla box, the CLI automatically routes all requests to that box. If the account manages multiple boxes, the user/agent must pass the `--box <gid>` flag to specify the target.

> The examples below assume a single-box environment or that the `FIREWALLA_BOX_GID` environment variable is set.

---

## Alarms

**Docs:** https://docs.firewalla.net/data-models/alarm/  
**API Reference:** `GET /v2/alarms` https://docs.firewalla.net/api-reference/alarm/

### List Recent Alarms

**Input:** `fw alarms list --params '{"limit": 25}'`  
**API:** `GET /v2/alarms?limit=25`  
**Output:** Display a chronological list of the 25 most recent alarms triggered on the box.

```json
{
  "results": [
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
      "vpn": {
        "deviceCount": 0,
        "id": "vpn_example",
        "name": "Example VPN",
        "strict": false,
        "subType": "",
        "type": "ipsec"
      },
      "message": "3rd-Party VPN (IPsec) to Example VPN is restored. Internet access on 0 device(s) is resumed."
    }
  ],
  "next_cursor": "example_cursor_value",
  "count": 1
}
```

### Limited Number of Alarms

**Input:** `fw alarms list --params '{"limit": 5}'`  
**API:** `GET /v2/alarms?limit=5`  
**Output:** Fetch a specific number of recent alarms (in this case, the 5 most recent).

**Note:** The API supports pagination via `limit` and `cursor` parameters. Device-based and status-based filtering are not supported by the Firewalla MSP API.

---

## Flows

**Docs:** https://docs.firewalla.net/data-models/flow/  
**API Reference:** `GET /v2/flows` https://docs.firewalla.net/api-reference/flow/

### List Recent Flows

**Input:** `fw flows list`  
**API:** `GET /v2/flows?gid=xxx`  
**Output:** Display recent network flows.

```json
{
  "results": [
    {
      "ts": 1730447700.000,
      "gid": "00000000-0000-0000-0000-000000000000",
      "protocol": "tcp",
      "direction": "outbound",
      "block": false,
      "download": 1024000,
      "upload": 51200,
      "duration": 30,
      "count": 5,
      "device": {
        "id": "AA:BB:CC:DD:EE:FF",
        "ip": "192.168.1.50",
        "name": "iPhone"
      },
      "destination": {
        "id": "google.com",
        "name": "google.com",
        "ip": "142.250.80.46"
      },
      "region": "US",
      "category": "search",
      "network": {
        "id": "00000000-1111-1111-1111-000000000000",
        "name": "Main Network"
      }
    }
  ],
  "next_cursor": "example_cursor_value",
  "count": 1
}
```

### Filtered Flows

**Input:** `fw flows list --query "Device:iphone direction:outbound"`  
**API:** `GET /v2/flows?gid=xxx&query=Device:iphone+direction:outbound`  
**Output:** Flows matching the query.

### Grouped & Sorted Flows

**Input:** `fw flows list --groupBy domain --sortBy total:desc --limit 50`  
**API:** `GET /v2/flows?gid=xxx&groupBy=domain&sortBy=total:desc&limit=50`  
**Output:** Top 50 domains by total traffic.

### Flow Query Qualifiers

| Qualifier | Alias | Example |
|-----------|-------|---------|
| `ts` | | `ts:<1695196894` |
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
| `download` | Download | `Download:>10MB` |
| `upload` | Upload | `Upload:>10MB` |
| `total` | Total | `Total:>50MB` |

### Flow Data Model

| Field | Type | Description |
|-------|------|-------------|
| `ts` | Number | Unix timestamp when flow ended |
| `gid` | String | Firewalla box unique identifier |
| `protocol` | String | `tcp` or `udp` |
| `direction` | String | `inbound`, `outbound`, or `local` |
| `block` | Boolean | Whether this is a blocked flow |
| `blockType` | String | `ip` or `dns` (only on blocked flows) |
| `download` | Number | Bytes downloaded (regular flows only) |
| `upload` | Number | Bytes uploaded (regular flows only) |
| `duration` | Number | Duration in seconds (regular flows only) |
| `count` | Number | TCP connections/UDP sessions or block count |
| `device` | Object | Device info (id, ip, name) |
| `source` | Object | Source host info (optional) |
| `destination` | Object | Destination host info (optional) |
| `region` | String | 2-letter ISO country code |
| `category` | String | Host category (ad, edu, games, vpn, etc.) |
| `network` | Object | Network info (id, name) |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `FIREWALLA_MSP_TOKEN` | Your MSP access token |
| `FIREWALLA_MSP_ID` | Your MSP domain (e.g., `your_subdomain.firewalla.net`) |
| `FIREWALLA_BOX_GID` | Your Firewalla box GID (optional if only one box) |
