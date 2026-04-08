# Firewalla MSP CLI — Usage Reference

A Node.js CLI for the Firewalla MSP API. All commands output JSON.

## Setup

```bash
export FIREWALLA_MSP_TOKEN="your_msp_api_token"
export FIREWALLA_MSP_ID="company.firewalla.net"   # optional if only one box
export FIREWALLA_BOX_GID="your-box-gid"           # optional if only one box
```

Or use a `.env` file in `cli/`.

## Global Options

```
--domain <domain>   MSP domain (e.g. company.firewalla.net)
--debug             Print request debug info
```

---

## alarms

Manage network alarms.

### `fw alarms list`
List alarms from a box.
```bash
fw alarms list
fw alarms list --box mybox
fw alarms list --params '{"status":1}'        # status 1=active, 0/2=archived
```

### `fw alarms archive <aid>`
Archive (soft-dismiss) an alarm by ID.
```bash
fw alarms archive 12345
fw alarms archive 12345 --box mybox
```

### `fw alarms delete <aid>`
Permanently delete an alarm by ID.
```bash
fw alarms delete 12345
```

---

## devices

Manage network devices. The API returns all devices as a flat array; filtering is done client-side.

### `fw devices list`
List all devices with optional filters.
```bash
fw devices list
fw devices list --online
fw devices list --offline
fw devices list --group "Quarantine"
fw devices list --network "LAN 1"
fw devices list --type camera
fw devices list --query "iphone"              # search name, IP, MAC, vendor
fw devices list --online --group "Kids"
```

**Output fields:** `mac`, `ip`, `name`, `online`, `macVendor`, `deviceType`, `group.name`, `network.name`, `totalDownload`, `totalUpload`

### `fw devices get <id>`
Get a single device. Resolves by MAC (exact), IP (exact), name (exact then substring).
```bash
fw devices get 192.168.1.100
fw devices get "AA:BB:CC:DD:EE:FF"
fw devices get "My-iPhone"
```

### `fw devices rename <id> <name>`
Rename a device. Same ID resolution as `get`.
```bash
fw devices rename 192.168.1.100 "Living Room TV"
fw devices rename "AA:BB:CC:DD:EE:FF" "Govee-Sensor-Kitchen"
fw devices rename "Old Name" "New Name"
```

---

## flows

Query network flows.

### `fw flows list`
List flows with flexible filtering and pagination.
```bash
fw flows list
fw flows list --limit 50
fw flows list --query "Device:My-iPhone"
fw flows list --query "Device:192.168.1.100"
fw flows list --query "direction:outbound"
fw flows list --since 2h                      # last 2 hours
fw flows list --since 30m --until 0m          # last 30 min
fw flows list --since "2024-01-01"
fw flows list --blocked                       # only blocked flows
fw flows list --stats                         # aggregated stats
fw flows list --all                           # auto-paginate all results
fw flows list --groupBy domain
fw flows list --groupBy "domain,box"
fw flows list --sortBy "ts:desc"
fw flows list --sortBy "total:desc"
fw flows list --limit 2000                    # auto-paginates beyond 500
fw flows list --cursor <cursor>               # manual pagination
fw flows list --params '{"protocol":"tcp"}'  # raw API params
```

**Output fields:** `ts`, `domain`, `category`, `protocol`, `direction`, `download`, `upload`, `blocked`, `device.name`, `device.ip`

---

## rules

Manage firewall rules.

### `fw rules list`
List all rules with optional filters. Filtering is client-side after full fetch.
```bash
fw rules list
fw rules list --action block
fw rules list --action allow
fw rules list --action disturb
fw rules list --action timelimit
fw rules list --status active
fw rules list --status paused
fw rules list --target-type domain
fw rules list --target-type app
fw rules list --target-type category
fw rules list --target-type ip
fw rules list --target-type internet
fw rules list --target-type remotePort
fw rules list --target-type targetlist
fw rules list --target-type intranet
fw rules list --scope-type device
fw rules list --scope-type group
fw rules list --scope-type network
fw rules list --scope-type user
fw rules list --hits                          # only rules with at least 1 hit
fw rules list --query "roblox"               # search target value or notes
fw rules list --action block --status active --hits
```

**Output fields:** `id` (composite `gid:num`), `action`, `direction`, `status`, `target.type`, `target.value`, `scope.type`, `scope.value`, `hit.count`, `hit.lastHitTs`, `notes`, `schedule`, `timeUsage`

**Rule ID:** The numeric portion after the colon in the `id` field (e.g. `42` from `xxxx...:42`).

### `fw rules get <id>`
Get a single rule by its numeric ID.
```bash
fw rules get 42
```

### `fw rules pause <id>`
Pause an active rule.
```bash
fw rules pause 42
```

### `fw rules resume <id>`
Resume a paused rule.
```bash
fw rules resume 42
```

---

## target-lists

Manage target lists (domain/IP blocklists used in rules).

### `fw target-lists list`
List all target lists.
```bash
fw target-lists list
fw target-lists list --owner firewalla       # built-in Firewalla lists only
fw target-lists list --owner global          # user-created lists only
fw target-lists list --query hagezi          # search by name, ID, or notes
```

**Output fields:** `id`, `name`, `type`, `count`, `blockMode`, `owner`, `notes`, `beta`, `lastUpdated`

**Built-in list IDs:** `doh`, `apple_privacy_relay`, `dshield`, `log4j`, `oisd`, `tor_exit`, `tor_full`, `crypto_nl`, `google_vpn`, `gambling`, `hagezi-multipro`, `hagezi-intelfeed`, `nrd`, `vpn-blocklist`, `hagezi-normal`, `aws`, `ai-nsfw`, `ai-sites`

### `fw target-lists get <id>`
Get full detail of a target list including its `targets` array. Resolves by ID or name (exact then substring).
```bash
fw target-lists get doh
fw target-lists get "HaGeZi"
fw target-lists get "TL-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### `fw target-lists create`
Create a new user-owned target list.
```bash
fw target-lists create --name "My Block List" --targets "malware.com,phish.com"
fw target-lists create --name "My Block List" --targets '["malware.com","phish.com"]'
fw target-lists create --name "My Block List" --targets "malware.com" --block-mode domainOnly --notes "Created by security scan"
```

**blockMode values:** `domainOnly` (DNS blocking only), `default` (full block)

### `fw target-lists update <id>`
Update a target list. Resolves by ID or name.
```bash
# Replace entire targets array
fw target-lists update "My Block List" --targets "new1.com,new2.com"

# Add entries (merges with existing)
fw target-lists update "My Block List" --add "new-threat.com"
fw target-lists update "My Block List" --add "a.com,b.com,c.com"

# Remove entries
fw target-lists update "My Block List" --remove "old-threat.com"
fw target-lists update "My Block List" --remove "a.com,b.com"

# Update metadata
fw target-lists update "My Block List" --name "Renamed List" --notes "Updated description"
fw target-lists update "My Block List" --block-mode domainOnly
```

### `fw target-lists delete <id>`
Delete a user-owned target list. Cannot delete built-in Firewalla lists.
```bash
fw target-lists delete "My Block List"
fw target-lists delete "TL-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

---

## API Notes

- **Base URL:** `https://{domain}/v2`
- **Auth:** `Authorization: Token {FIREWALLA_MSP_TOKEN}`
- **Box GID:** resolved automatically from `FIREWALLA_BOX_GID` env var, or from the `--box` option, or auto-selected if only one box exists
- **Alarm mutations:** use v1 API — `POST /v1/alarm/archive/{gid}/{aid}`
- **Rule mutations:** use composite ID — `POST /v2/rules/{gid}:{id}/pause|resume`
- **Device rename:** `PATCH /v2/boxes/{gid}/devices/{url-encoded-mac}`
- **Target list CRUD:** `GET|POST /v2/target-lists`, `GET|PATCH|DELETE /v2/target-lists/{id}`
- **Rule delete:** not supported by the MSP REST API
