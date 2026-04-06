# fw-msp-cli (Work in Progress)

A new CLI for all of Firewalla MSP to simplify your MSP API.

> [!NOTE]
> This is **not** an officially supported Firewalla product.

Designed for both human operators and AI agents, `fw` outputs structured JSON by default, and relies on RESTful 1:1 API mappings.

## Quick Start

```bash
# List alarms
fw alarms list --box <name>

# List flows with filtering
fw flows list --limit 1000
fw flows list --since 2h --stats
fw flows list --query "region:CN" --blocked
```

---

## Authentication

The `fw` CLI requires a valid Firewalla MSP API token to authenticate requests. You can provide your token using one of the following methods:

### Method 1: Environment Variable (Recommended for AI Agents & CI/CD)
Export your PAT (Personal Access Token) directly into your shell environment. AI agents should be configured to inject this variable into their execution environment. This is the cleanest method for headless environments as it leaves no credential files on the disk.

```
bash
export FIREWALLA_MSP_TOKEN=your_msp_api_token_here
export FIREWALLA_MSP_ID=your_subdomain.firewalla.net
fw boxes list
```

### Method 2: The .env File (Recommended for Humans)
Create a .env file in your project root. The CLI will automatically load your token from this file if it is not already set in your environment.

```
.env
```
```
FIREWALLA_MSP_TOKEN=your_msp_api_token_here
FIREWALLA_MSP_ID=your_subdomain.firewalla.net
# Optional: Set a default box so you can stop typing --box every 5 seconds
FIREWALLA_BOX_GID=your_box_gid_here
```
