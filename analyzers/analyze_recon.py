#!/usr/bin/env python3
"""
Reconnaissance / threat-actor analysis of inbound flows.

Surfaces scanner behavior, port-targeting patterns, threat-intel hits,
and the most aggressive source IPs from a flows NDJSON file.

Usage:
  python3 analyze_recon.py [file]   # defaults to flows_<today>.ndjson in /tmp
"""
import json, sys, collections, ipaddress, datetime

DEFAULT_FILE = f"/tmp/flows_{datetime.date.today()}.ndjson"
FILE = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_FILE

# Known dangerous ports targeted by attackers
SCANNER_PORTS = {
    21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP",
    135: "RPC/DCOM", 139: "NetBIOS", 445: "SMB",
    1433: "MSSQL", 1521: "Oracle", 3306: "MySQL", 3389: "RDP",
    5432: "Postgres", 5900: "VNC", 6379: "Redis",
    8080: "HTTP-alt", 8443: "HTTPS-alt", 9200: "Elasticsearch",
    11211: "Memcached", 27017: "MongoDB", 50050: "Cobalt Strike",
    4444: "Metasploit", 5555: "ADB/Android", 7777: "Various RAT",
    23023: "Mirai variant", 37777: "Dahua DVR", 52869: "Realtek SDK",
    5060: "SIP", 5061: "SIP-TLS", 8728: "MikroTik",
    2222: "SSH-alt", 2323: "Telnet-alt", 8000: "Web-alt",
    8888: "Web-alt", 81: "Web-alt", 88: "Kerberos",
    161: "SNMP", 623: "IPMI", 1900: "UPnP",
    5000: "UPnP/Web", 7547: "TR-069 (CWMP)", 9000: "Web/PHP-FPM",
    2375: "Docker API", 2376: "Docker TLS", 6443: "Kubernetes",
    32400: "Plex", 9001: "Tor", 10001: "Various",
    47808: "BACnet", 102: "Siemens S7", 44818: "Ethernet/IP",
}

src_ips = collections.Counter()
src_ports_per_ip = collections.defaultdict(set)
src_country = {}
country_attacks = collections.Counter()
port_targets = collections.Counter()
high_risk_ports = collections.Counter()
top_attackers_detail = collections.defaultdict(lambda: {"flows": 0, "ports": set(), "country": "", "blocked": 0, "category": collections.Counter()})
intel_sources = collections.Counter()
unblocked_inbound = []
mass_scanners = []

n_total = 0
n_inbound = 0
n_blocked_inbound = 0
n_unblocked_inbound = 0

with open(FILE) as f:
    for line in f:
        try:
            flow = json.loads(line)
        except:
            continue
        n_total += 1
        if flow.get("direction") != "inbound":
            continue
        n_inbound += 1

        src = flow.get("source", {})
        dst = flow.get("destination", {})
        src_ip = src.get("ip", "")
        if not src_ip:
            continue

        # skip private/internal
        try:
            ip_obj = ipaddress.ip_address(src_ip)
            if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
                continue
        except:
            continue

        country = flow.get("country", "??")
        category = flow.get("category", "")
        blocked = flow.get("block", False)
        dst_port = (dst.get("portInfo") or {}).get("port")

        src_ips[src_ip] += 1
        if dst_port:
            src_ports_per_ip[src_ip].add(dst_port)
            port_targets[dst_port] += 1
            if dst_port in SCANNER_PORTS:
                high_risk_ports[(dst_port, SCANNER_PORTS[dst_port])] += 1

        src_country[src_ip] = country
        country_attacks[country] += 1

        d = top_attackers_detail[src_ip]
        d["flows"] += 1
        if dst_port:
            d["ports"].add(dst_port)
        d["country"] = country
        if blocked:
            d["blocked"] += 1
            n_blocked_inbound += 1
        else:
            n_unblocked_inbound += 1
            unblocked_inbound.append({
                "src": src_ip, "country": country, "port": dst_port,
                "category": category, "ts": flow.get("ts"),
            })
        if category:
            d["category"][category] += 1
        if category == "intel":
            intel_sources[src_ip] += 1

# Identify mass scanners (hit many distinct ports)
for ip, ports in src_ports_per_ip.items():
    if len(ports) >= 5:
        mass_scanners.append((ip, len(ports), src_ips[ip], src_country.get(ip, "??")))
mass_scanners.sort(key=lambda x: (-x[1], -x[2]))

print("="*70)
print("  RECONNAISSANCE / THREAT INTELLIGENCE ANALYSIS")
print("="*70)
print(f"  Total flows         : {n_total:,}")
print(f"  Inbound from public : {n_inbound:,}")
print(f"  Blocked at edge     : {n_blocked_inbound:,}")
print(f"  Reached internal    : {n_unblocked_inbound:,}")
print(f"  Unique attacker IPs : {len(src_ips):,}")
print(f"  Threat-intel hits   : {sum(intel_sources.values()):,} from {len(intel_sources):,} IPs")

print("\n" + "─"*70)
print("  TOP 20 ATTACKER SOURCE IPs (by connection volume)")
print("─"*70)
print(f"  {'flows':>7} {'ports':>6} {'cc':>4}  IP")
for ip, count in src_ips.most_common(20):
    n_ports = len(src_ports_per_ip[ip])
    cc = src_country.get(ip, "??")
    intel_flag = " 🚨INTEL" if ip in intel_sources else ""
    print(f"  {count:>7,} {n_ports:>6} {cc:>4}  {ip}{intel_flag}")

print("\n" + "─"*70)
print("  TOP ATTACKER COUNTRIES (by inbound connection count)")
print("─"*70)
for cc, count in country_attacks.most_common(15):
    pct = 100 * count / n_inbound
    print(f"  {cc:>4}  {count:>8,}  ({pct:5.1f}%)")

print("\n" + "─"*70)
print("  TOP TARGETED PORTS (what attackers are probing)")
print("─"*70)
for port, count in port_targets.most_common(25):
    name = SCANNER_PORTS.get(port, "")
    flag = " ⚠️" if port in SCANNER_PORTS else ""
    print(f"  port {port:>6}  {count:>8,} attempts  {name}{flag}")

print("\n" + "─"*70)
print("  HIGH-RISK PORT TARGETING (known attack vectors)")
print("─"*70)
for (port, name), count in sorted(high_risk_ports.items(), key=lambda x: -x[1])[:25]:
    print(f"  {port:>6}  {name:<24}  {count:>6,} attempts")

print("\n" + "─"*70)
print("  MASS PORT SCANNERS (single IP hitting 5+ distinct ports)")
print("─"*70)
print(f"  {'ports':>6} {'flows':>7} {'cc':>4}  IP")
for ip, n_ports, n_flows, cc in mass_scanners[:25]:
    intel_flag = " 🚨INTEL" if ip in intel_sources else ""
    print(f"  {n_ports:>6} {n_flows:>7,} {cc:>4}  {ip}{intel_flag}")
print(f"\n  Total mass scanners: {len(mass_scanners)}")

print("\n" + "─"*70)
print("  THREAT INTEL FEED HITS (Firewalla flagged as known-bad)")
print("─"*70)
print(f"  {'hits':>7} {'cc':>4}  IP")
for ip, count in intel_sources.most_common(20):
    cc = src_country.get(ip, "??")
    print(f"  {count:>7,} {cc:>4}  {ip}")

print("\n" + "─"*70)
print(f"  UNBLOCKED INBOUND FLOWS ({n_unblocked_inbound})")
print("─"*70)
if unblocked_inbound:
    by_port = collections.Counter()
    by_country = collections.Counter()
    for flow in unblocked_inbound:
        by_port[flow["port"]] += 1
        by_country[flow["country"]] += 1
    print("  Top ports reached:")
    for port, n in by_port.most_common(10):
        name = SCANNER_PORTS.get(port, "")
        print(f"    port {port}: {n} flows  {name}")
    print("  Top source countries:")
    for cc, n in by_country.most_common(10):
        print(f"    {cc}: {n} flows")
else:
    print("  ✓ Every inbound public flow was blocked at the edge")
