#!/usr/bin/env python
"""
ssh_bruteforce_watcher_py2.py
-------------------------------
Same job as ssh_bruteforce_watcher.py, rewritten to run on Python 2.5
(Metasploitable2's stock interpreter, from 2007). No f-strings, no
`json` module (2.5 doesn't have one built in), no `urllib.request`
(that's Python 3 only) - just urllib2 and hand-built JSON strings,
since the payload shape here is small and fixed.
"""

import os
import re
import socket
import sys
import time
import urllib2
from collections import defaultdict

SOC_URL = os.environ.get("SOC_URL", "").strip()
INGEST_KEY = os.environ.get("INGEST_KEY", "").strip()
ENDPOINT_CODE = os.environ.get("ENDPOINT_CODE", "EP-001").strip()
AUTH_LOG = os.environ.get("AUTH_LOG", "/var/log/auth.log").strip()
WINDOW_SECONDS = float(os.environ.get("WINDOW_SECONDS", "60"))
REPORT_THRESHOLD = int(os.environ.get("REPORT_THRESHOLD", "5"))
REPORT_COOLDOWN = float(os.environ.get("REPORT_COOLDOWN", "10"))

FAILED_PW_RE = re.compile(
    r"Failed password for (?:invalid user )?(?P<user>\S+) from (?P<ip>\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}) port \d+"
)

attempts_by_ip = defaultdict(list)
last_reported_at = defaultdict(lambda: 0.0)


def log(msg):
    print "[%s] %s" % (time.strftime("%Y-%m-%d %H:%M:%S"), msg)


def json_escape(s):
    return s.replace("\\", "\\\\").replace('"', '\\"')


def report_burst(ip, count):
    payload = (
        '{"endpointCode": "%s", "sourceIp": "%s", '
        '"failedLoginCount": %d, "windowSeconds": %s}'
    ) % (json_escape(ENDPOINT_CODE), json_escape(ip), count, WINDOW_SECONDS)

    req = urllib2.Request(SOC_URL, data=payload)
    req.add_header("Content-Type", "application/json")
    req.add_header("x-ingest-key", INGEST_KEY)

    try:
        resp = urllib2.urlopen(req)
        body = resp.read()
        resp.close()
        if '"alertCreated": true' in body or '"alertCreated":true' in body:
            log("  -> reported to dashboard: ALERT CREATED")
        else:
            log("  -> reported to dashboard: acknowledged (below alert threshold)")
    except urllib2.HTTPError, e:
        try:
            err_body = e.read()
        except Exception:
            err_body = ""
        log("  -> dashboard rejected the report: HTTP %s %s" % (e.code, err_body))
    except urllib2.URLError, e:
        log("  -> could not reach dashboard at %s: %s" % (SOC_URL, e.reason))


def prune_old(ip, now):
    attempts_by_ip[ip] = [t for t in attempts_by_ip[ip] if now - t <= WINDOW_SECONDS]


def handle_failed_login(ip, user, now):
    attempts_by_ip[ip].append(now)
    prune_old(ip, now)
    count = len(attempts_by_ip[ip])
    log("Failed SSH login: user=%r from %s  (window count: %d/%d)" % (user, ip, count, REPORT_THRESHOLD))

    if count >= REPORT_THRESHOLD and (now - last_reported_at[ip]) >= REPORT_COOLDOWN:
        log("Burst detected from %s: %d failed logins in the last %.0fs - reporting." % (ip, count, WINDOW_SECONDS))
        report_burst(ip, count)
        last_reported_at[ip] = now


def follow(path):
    f = open(path, "r")
    f.seek(0, 2)
    inode = os.fstat(f.fileno()).st_ino
    while True:
        line = f.readline()
        if line:
            yield line
            continue
        time.sleep(0.5)
        try:
            if os.stat(path).st_ino != inode:
                f.close()
                f = open(path, "r")
                inode = os.fstat(f.fileno()).st_ino
        except OSError:
            pass


def main():
    socket.setdefaulttimeout(5)

    if not SOC_URL or not INGEST_KEY:
        log("SOC_URL and INGEST_KEY environment variables are required.")
        sys.exit(1)
    if not os.path.exists(AUTH_LOG):
        log("Auth log not found at %s." % AUTH_LOG)
        sys.exit(1)

    log("Watching %s for real SSH brute-force attempts." % AUTH_LOG)
    log("Reporting bursts of >= %d failed logins/%.0fs as endpoint %s to %s"
        % (REPORT_THRESHOLD, WINDOW_SECONDS, ENDPOINT_CODE, SOC_URL))

    for line in follow(AUTH_LOG):
        m = FAILED_PW_RE.search(line)
        if m:
            handle_failed_login(m.group("ip"), m.group("user"), time.time())


if __name__ == "__main__":
    main()