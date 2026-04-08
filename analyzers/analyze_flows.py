#!/usr/bin/env python3
"""
Security flow analyzer — flags suspicious patterns without loading everything into memory.
"""
import json, sys, collections, ipaddress

FILE = "/tmp/flows_2026-04-08.ndjson"

# Known-good categories / domains to suppress noise
NOISE_TAGS = {"noise"}
TRUSTED_DOMAINS = {
    "apple.com", "cdn-apple.com", "icloud.com", "icloud-content.com",
    "google.com", "googleapis.com", "gstatic.com", "youtube.com",
    "amazon.com", "amazonaws.com", "amazon.dev", "ring.com", "rings.solutions",
    "slack.com", "microsoft.com", "office.com", "msftconnecttest.com",
    "firewalla.com", "firewalla.net", "zendesk.com",
    "brilliant.tech", "netflix.com", "nflxvideo.net",
    "akamaiedge.net", "akadns.net", "cloudfront.net", "fastly.net",
    "digicert.com", "letsencrypt.org", "ocsp.apple.com",
}

def get_root_domain(domain):
    if not domain:
        return None
    parts = domain.strip(".").split(".")
    if len(parts) >= 2:
        return ".".join(parts[-2:])
    return domain

def is_private_ip(ip):
    try:
        return ipaddress.ip_address(ip).is_private
    except Exception:
        return False

def is_trusted(domain):
    rd = get_root_domain(domain)
    return rd in TRUSTED_DOMAINS if rd else False

suspicious = []
blocked_flows = []
raw_ip_large = []
unusual_ports = []
high_volume = []
non_us = []
rare_domains = collections.Counter()
device_bytes = collections.defaultdict(int)
domain_bytes = collections.defaultdict(int)
blocked_by_device = collections.Counter()
total = 0
errors = 0

UNUSUAL_PORT_WHITELIST = {80, 443, 53, 123, 8080, 8443, 5228, 5353}

with open(FILE) as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            flow = json.loads(line)
        except Exception:
            errors += 1
            continue

        total += 1
        tags = set(flow.get("flowTags") or [])
        blocked = flow.get("block", False)
        domain = flow.get("domain", "") or ""
        dest = flow.get("destination", {}) or {}
        dest_ip = dest.get("ip", "") or ""
        direction = flow.get("direction", "")
        upload = flow.get("upload", 0) or 0
        download = flow.get("download", 0) or 0
        total_bytes = flow.get("total", 0) or upload + download
        region = flow.get("region", "US") or "US"
        protocol = flow.get("protocol", "") or ""
        device = flow.get("device", {}) or {}
        device_name = device.get("name", "unknown")
        device_ip = device.get("ip", "") or ""
        port_info = dest.get("portInfo", {}) or {}
        dest_port = port_info.get("port", 0) or 0
        root_domain = get_root_domain(domain)

        # Track per-device upload volume
        device_bytes[device_name] += upload

        # Track domain bandwidth
        if root_domain:
            domain_bytes[root_domain] += total_bytes

        # 1. Blocked flows
        if blocked:
            blocked_flows.append({
                "device": device_name,
                "dest": domain or dest_ip,
                "upload_kb": round(upload/1024, 1),
                "region": region,
                "blockedby": flow.get("blockedby", ""),
            })
            blocked_by_device[device_name] += 1

        # Skip noise-tagged flows for further checks
        if NOISE_TAGS & tags:
            continue

        # 2. Large upload to raw IP (no domain, direction outbound)
        if direction == "outbound" and not domain and dest_ip and upload > 5*1024*1024:
            if not is_private_ip(dest_ip):
                raw_ip_large.append({
                    "device": device_name,
                    "dest_ip": dest_ip,
                    "upload_mb": round(upload/1024/1024, 2),
                    "region": region,
                    "port": dest_port,
                    "protocol": protocol,
                })

        # 3. Non-US traffic to untrusted domains with significant upload
        if region not in ("US", "", None) and not is_trusted(domain) and upload > 500*1024:
            non_us.append({
                "device": device_name,
                "dest": domain or dest_ip,
                "region": region,
                "upload_mb": round(upload/1024/1024, 2),
                "download_mb": round(download/1024/1024, 2),
            })

        # 4. Unusual destination ports (not in whitelist, not ephemeral)
        if dest_port and dest_port not in UNUSUAL_PORT_WHITELIST and dest_port < 1024 and not blocked:
            if not is_trusted(domain):
                unusual_ports.append({
                    "device": device_name,
                    "dest": domain or dest_ip,
                    "port": dest_port,
                    "protocol": protocol,
                    "upload_kb": round(upload/1024, 1),
                })

        # 5. Very high upload to untrusted domain (>50MB)
        if upload > 50*1024*1024 and not is_trusted(domain) and direction == "outbound":
            high_volume.append({
                "device": device_name,
                "dest": domain or dest_ip,
                "upload_mb": round(upload/1024/1024, 2),
                "region": region,
            })

        # 6. Rare/unknown domains with any upload
        if root_domain and not is_trusted(domain) and upload > 100*1024:
            rare_domains[root_domain] += 1


# Top uploaders
top_uploaders = sorted(device_bytes.items(), key=lambda x: -x[1])[:10]
top_domains = sorted(domain_bytes.items(), key=lambda x: -x[1])[:10]

print(f"=== FLOW SECURITY ANALYSIS ===")
print(f"Total flows analyzed: {total:,}  |  Parse errors: {errors}")
print()

print(f"--- BLOCKED FLOWS ({len(blocked_flows)}) ---")
for b in blocked_flows[:20]:
    print(f"  [{b['device']}] -> {b['dest']} | upload {b['upload_kb']} KB | region {b['region']} | by {b['blockedby']}")
if len(blocked_flows) > 20:
    print(f"  ... and {len(blocked_flows)-20} more")
print()

print(f"--- LARGE UPLOADS TO RAW IPs (no domain, >5MB) ({len(raw_ip_large)}) ---")
for r in raw_ip_large[:20]:
    print(f"  [{r['device']}] -> {r['dest_ip']}:{r['port']} ({r['protocol']}) | {r['upload_mb']} MB | region {r['region']}")
if len(raw_ip_large) > 20:
    print(f"  ... and {len(raw_ip_large)-20} more")
print()

print(f"--- NON-US TRAFFIC TO UNTRUSTED DESTINATIONS (>500KB upload) ({len(non_us)}) ---")
for n in non_us[:20]:
    print(f"  [{n['device']}] -> {n['dest']} | region {n['region']} | up {n['upload_mb']} MB / down {n['download_mb']} MB")
if len(non_us) > 20:
    print(f"  ... and {len(non_us)-20} more")
print()

print(f"--- UNUSUAL LOW PORTS (not 80/443/53, <1024, untrusted) ({len(unusual_ports)}) ---")
for u in unusual_ports[:20]:
    print(f"  [{u['device']}] -> {u['dest']}:{u['port']} ({u['protocol']}) | {u['upload_kb']} KB")
if len(unusual_ports) > 20:
    print(f"  ... and {len(unusual_ports)-20} more")
print()

print(f"--- HIGH VOLUME UPLOADS TO UNTRUSTED DOMAINS (>50MB) ({len(high_volume)}) ---")
for h in high_volume[:20]:
    print(f"  [{h['device']}] -> {h['dest']} | {h['upload_mb']} MB | region {h['region']}")
if len(high_volume) > 20:
    print(f"  ... and {len(high_volume)-20} more")
print()

print(f"--- TOP 10 DEVICES BY UPLOAD ---")
for name, b in top_uploaders:
    print(f"  {name}: {round(b/1024/1024, 1)} MB")
print()

print(f"--- TOP 10 DOMAINS BY TOTAL TRAFFIC ---")
for domain, b in top_domains:
    print(f"  {domain}: {round(b/1024/1024, 1)} MB")
print()

print(f"--- RARE UNTRUSTED DOMAINS WITH UPLOADS (top 20) ---")
for domain, cnt in sorted(rare_domains.items(), key=lambda x: -x[1])[:20]:
    print(f"  {domain}: {cnt} flows")
