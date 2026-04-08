#!/usr/bin/env python3
"""
Security alarm analyzer — identifies patterns, risks, and network health.

Usage:
  python3 analyze_alarms.py [file]     # defaults to /tmp/alarms.json
  python3 analyze_alarms.py /tmp/alarms_1000.json
"""
import json, collections, datetime, re, sys

def redact_ips(text):
    """Replace IPv4 with [x.x.x.x] and IPv6 with [ipv6] in freeform text."""
    text = re.sub(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', '[x.x.x.x]', str(text))
    text = re.sub(r'([0-9a-fA-F]{1,4}:){3,}[0-9a-fA-F:/]+', '[ipv6]', text)
    return text

FILE = sys.argv[1] if len(sys.argv) > 1 else "/tmp/alarms.json"

with open(FILE) as f:
    alarms = json.load(f)

total = len(alarms)

# Status mapping
STATUS = {0: "archived", 1: "active", 2: "archived"}

# Counters
by_type = collections.Counter()
by_status = collections.Counter()
by_device = collections.Counter()
by_cloudaction = collections.Counter()
active_by_type = collections.Counter()
non_us = []
blocked_alarms = []
security_alarms = []
large_uploads = []
device_online_offline = collections.Counter()
unknown_devices = []
raw_ip_alarms = []
interesting = []

for a in alarms:
    _type = a.get("_type", "UNKNOWN")
    status = a.get("status", 0)
    cloud = a.get("cloudaction", "") or ""
    ts = a.get("ts", 0)
    aid = a.get("aid")
    msg = a.get("message", "")
    device = a.get("device", {}) or {}
    device_name = device.get("name", "unknown")
    remote = a.get("remote", {}) or {}
    region = remote.get("region", "US") or "US"
    domain = remote.get("domain", "") or ""
    remote_ip = remote.get("ip", "") or ""
    transfer = a.get("transfer", {}) or {}
    upload = transfer.get("upload", 0) or 0
    dt = datetime.datetime.fromtimestamp(ts).strftime("%m-%d %H:%M") if ts else "?"

    by_type[_type] += 1
    by_status[STATUS.get(status, str(status))] += 1
    by_cloudaction[cloud or "(none)"] += 1

    if status == 1:
        active_by_type[_type] += 1
        by_device[device_name] += 1

    # Security activity alarms (type 1)
    if a.get("type") == 1 or _type == "ALARM_SECURITY":
        security_alarms.append({"aid": aid, "device": device_name, "msg": redact_ips(msg), "ts": dt, "cloud": cloud, "region": region})

    # Large uploads (type 2 / 16)
    if _type in ("ALARM_LARGE_UPLOAD", "ALARM_LARGE_UPLOAD_2"):
        upload_mb = round(upload / 1024 / 1024, 1)
        if not domain and remote_ip:
            raw_ip_alarms.append({"aid": aid, "device": device_name, "dest": redact_ips(remote_ip), "upload_mb": upload_mb, "region": region, "ts": dt})
        if _type == "ALARM_LARGE_UPLOAD_2":
            large_uploads.append({"aid": aid, "device": device_name, "dest": redact_ips(domain or remote_ip), "upload_mb": upload_mb, "ts": dt})

    # Non-US remote
    if region and region not in ("US", ""):
        non_us.append({"aid": aid, "type": _type, "device": device_name, "dest": redact_ips(domain or remote_ip), "region": region, "ts": dt, "cloud": cloud, "status": STATUS.get(status)})

    # Unknown/unidentified devices
    if device_name in ("unknown", "") and status == 1:
        unknown_devices.append({"aid": aid, "type": _type, "msg": redact_ips(msg)[:80], "ts": dt})

    # Active alarms with no cloud verdict — needs manual review
    if status == 1 and cloud == "":
        interesting.append({"aid": aid, "type": _type, "device": device_name, "msg": redact_ips(msg)[:100], "ts": dt})

# Summarize non-US by region
non_us_by_region = collections.Counter(n["region"] for n in non_us)
non_us_types = collections.Counter(n["type"] for n in non_us)

print("=== ALARM SECURITY ANALYSIS ===")
print(f"Total alarms: {total}")
print(f"Active: {by_status.get('active', 0)}  |  Archived: {by_status.get('archived', 0)}")
print()

print("--- ALARM TYPES BREAKDOWN ---")
for t, c in by_type.most_common():
    active = active_by_type.get(t, 0)
    print(f"  {t}: {c} total  ({active} active)")
print()

print("--- CLOUD ACTION VERDICTS ---")
for ca, c in by_cloudaction.most_common():
    print(f"  '{ca}': {c}")
print()

print(f"--- ACTIVE ALARMS BY DEVICE (top 15) ---")
for d, c in by_device.most_common(15):
    print(f"  {d}: {c} active alarms")
print()

print(f"--- SECURITY ACTIVITY ALARMS (type=1) ({len(security_alarms)}) ---")
for s in security_alarms[:20]:
    print(f"  [aid:{s['aid']}] [{s['ts']}] [{s['region']}] {s['device']} | {s['msg'][:100]} | cloud:{s['cloud'] or '(none)'}")
if len(security_alarms) > 20:
    print(f"  ... and {len(security_alarms)-20} more")
print()

print(f"--- LARGE UPLOADS 2 / ANOMALOUS VOLUME ({len(large_uploads)}) ---")
for u in large_uploads[:15]:
    print(f"  [aid:{u['aid']}] [{u['ts']}] {u['device']} -> {u['dest']} | {u['upload_mb']} MB")
print()

print(f"--- UPLOADS TO RAW IPs (no domain) ({len(raw_ip_alarms)}) ---")
for r in raw_ip_alarms[:15]:
    print(f"  [aid:{r['aid']}] [{r['ts']}] {r['device']} -> {r['dest']} | {r['upload_mb']} MB | {r['region']}")
print()

print(f"--- NON-US TRAFFIC ALARMS ({len(non_us)}) ---")
print(f"  By region: {dict(non_us_by_region.most_common())}")
print(f"  By type:   {dict(non_us_types.most_common())}")
for n in non_us[:15]:
    print(f"  [aid:{n['aid']}] [{n['ts']}] [{n['region']}] {n['device']} -> {n['dest']} | {n['type']} | cloud:{n['cloud']} | {n['status']}")
if len(non_us) > 15:
    print(f"  ... and {len(non_us)-15} more")
print()

print(f"--- ACTIVE ALARMS WITH NO CLOUD VERDICT (needs review) ({len(interesting)}) ---")
for i in interesting[:20]:
    print(f"  [aid:{i['aid']}] [{i['ts']}] {i['type']} | {i['device']} | {i['msg']}")
if len(interesting) > 20:
    print(f"  ... and {len(interesting)-20} more")
print()

print(f"--- UNKNOWN DEVICE ALARMS (active) ({len(unknown_devices)}) ---")
for u in unknown_devices[:10]:
    print(f"  [aid:{u['aid']}] [{u['ts']}] {u['type']} | {u['msg']}")
print()
