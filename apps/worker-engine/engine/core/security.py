"""
Security Hardening & Anti-SSRF Defense Engine (Task 5.3)
Implements:
1. Strict input sanitization (strips schemes, paths, queries, ports, null bytes, control chars).
2. Comprehensive Anti-SSRF validation:
   - Blocks loopback (127.0.0.0/8, ::1)
   - Blocks RFC1918 private subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
   - Blocks Link-local and Cloud Metadata addresses (169.254.169.254, fe80::/10)
   - Blocks Multicast, Unspecified (0.0.0.0), and CGNAT (100.64.0.0/10)
   - Blocks internal TLDs (.local, .internal, .lan, etc.) and DNS rebinding domains (*.nip.io)
3. IP sliding-window rate limiter for DoS mitigation.
"""

import ipaddress
import re
import socket
import time
from typing import Tuple, Dict, List, Optional, Any
from collections import defaultdict


class SecurityValidationError(ValueError):
    """Raised when an input violates Anti-SSRF or sanitization security policies."""
    pass


# Prohibited hostnames and cloud metadata services
BLOCKED_HOSTNAMES = {
    "localhost",
    "localhost.localdomain",
    "ip6-localhost",
    "ip6-loopback",
    "metadata.google.internal",
    "instance-data",
}

BLOCKED_INTERNAL_TLDS = (
    ".local",
    ".internal",
    ".lan",
    ".home",
    ".corp",
    ".localhost",
)

# DNS Rebinding patterns pointing to private/loopback IPs
RE_REBINDING = re.compile(
    r"(?:^|\.)(?:127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+)\.(?:nip|sslip|xip)\.io$",
    re.IGNORECASE,
)

# Forbidden shell metacharacters and script injection tokens
RE_FORBIDDEN_CHARS = re.compile(r"[<>'\"`;|&$*\\{}]")

# CGNAT network (RFC 6598)
CGNAT_NETWORK = ipaddress.ip_network("100.64.0.0/10")


def sanitize_target_input(raw: str) -> str:
    """
    Sanitizes raw target string:
    - Strips leading/trailing whitespace
    - Strips control characters and null bytes
    - Strips protocol scheme (http://, https://, ftp://, etc.)
    - Strips user authentication (user:pass@)
    - Strips URL paths, query parameters, and hash fragments
    - Strips port numbers if attached to domain/hostname
    """
    if not raw:
        return ""

    target = raw.strip()

    # Remove null bytes and control chars
    target = re.sub(r"[\x00-\x1F\x7F]", "", target)

    # Strip protocol scheme (e.g. http://, https://)
    target = re.sub(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", "", target)

    # Strip user credentials (e.g. admin:pass@target.com)
    if "@" in target and "/" in target:
        at_idx = target.index("@")
        slash_idx = target.index("/")
        if at_idx < slash_idx:
            target = target[at_idx + 1:]

    # Strip URL path, query params, and fragment
    target = target.split("/")[0].split("?")[0].split("#")[0]

    # Strip port number if domain/hostname (e.g. example.com:8080 -> example.com)
    # Avoid stripping IPv6 addresses which contain multiple colons
    if ":" in target and target.count(":") == 1:
        target = target.split(":")[0]

    return target.strip()


def is_safe_ip(ip_str: str) -> Tuple[bool, str]:
    """
    Validates whether an IP address is a safe public routable target.
    Returns (True, '') if safe, or (False, reason) if blocked.
    """
    try:
        ip = ipaddress.ip_address(ip_str.strip())
    except ValueError:
        return False, f"Invalid IP address format: '{ip_str}'."

    # 1. Loopback addresses (127.0.0.0/8, ::1)
    if ip.is_loopback:
        return False, f"Loopback address '{ip}' is blocked to prevent local server compromise (SSRF Defense)."

    # 2. Link-local & Cloud Metadata (169.254.0.0/16, fe80::/10)
    if ip.is_link_local or str(ip) == "169.254.169.254":
        return False, f"Link-local / Cloud Metadata address '{ip}' is strictly blocked."

    # 3. Private subnets (RFC 1918: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, fc00::/7)
    if ip.is_private:
        return False, f"Private RFC1918 IP address '{ip}' is blocked to prevent internal network scanning."

    # 4. Multicast addresses (224.0.0.0/4, ff00::/8)
    if ip.is_multicast:
        return False, f"Multicast address '{ip}' is blocked."

    # 5. Reserved / Unspecified (0.0.0.0, 240.0.0.0/4, ::)
    if ip.is_reserved or ip.is_unspecified:
        return False, f"Reserved or unspecified address '{ip}' is blocked."

    # 6. Carrier-Grade NAT (CGNAT 100.64.0.0/10)
    if ip.version == 4 and ip in CGNAT_NETWORK:
        return False, f"Carrier-Grade NAT address '{ip}' is blocked."

    return True, ""


def is_safe_hostname(hostname: str, check_dns_resolution: bool = False) -> Tuple[bool, str]:
    """
    Validates whether a domain or hostname is safe from SSRF.
    Returns (True, '') if safe, or (False, reason) if blocked.
    """
    clean_host = hostname.strip().lower()

    if not clean_host:
        return False, "Hostname cannot be empty."

    # 1. Check exact blocked internal hostnames
    if clean_host in BLOCKED_HOSTNAMES:
        return False, f"Internal hostname '{clean_host}' is blocked by Anti-SSRF policy."

    # 2. Check internal TLDs
    for tld in BLOCKED_INTERNAL_TLDS:
        if clean_host.endswith(tld):
            return False, f"Internal domain TLD '{tld}' is blocked to prevent local network reconnaissance."

    # 3. Check DNS Rebinding wildcard domains
    if RE_REBINDING.search(clean_host):
        return False, f"DNS Rebinding target '{clean_host}' pointing to internal network is blocked."

    # 4. Optional DNS resolution check (protects against custom domains resolving to 127.0.0.1)
    if check_dns_resolution:
        try:
            resolved_ips = socket.getaddrinfo(clean_host, None, proto=socket.IPPROTO_TCP)
            for item in resolved_ips:
                sockaddr = item[4]
                resolved_ip = sockaddr[0]
                is_safe, reason = is_safe_ip(resolved_ip)
                if not is_safe:
                    return False, f"Domain '{clean_host}' resolves to unsafe IP {resolved_ip}: {reason}"
        except socket.gaierror:
            # Unresolvable domains can still proceed to crt.sh / passive OSINT
            pass

    return True, ""


def validate_target_security(raw_target: str, check_dns_resolution: bool = False) -> str:
    """
    Full security validation and sanitization gate for any incoming target seed.
    Raises SecurityValidationError on violation, or returns sanitized target string.
    """
    clean = sanitize_target_input(raw_target)

    if not clean:
        raise SecurityValidationError("Target input cannot be empty.")

    if len(clean) > 253:
        raise SecurityValidationError("Target exceeds maximum allowed length of 253 characters.")

    if RE_FORBIDDEN_CHARS.search(clean):
        raise SecurityValidationError("Target contains illegal shell metacharacters or script injection tokens.")

    # Determine if clean target is an IP literal or hostname/domain
    is_ip = False
    try:
        ipaddress.ip_address(clean)
        is_ip = True
    except ValueError:
        is_ip = False

    if is_ip:
        safe, reason = is_safe_ip(clean)
        if not safe:
            raise SecurityValidationError(reason)
    else:
        # If it looks like an email, validate the domain part
        if "@" in clean:
            domain_part = clean.split("@")[-1]
            safe, reason = is_safe_hostname(domain_part, check_dns_resolution=check_dns_resolution)
            if not safe:
                raise SecurityValidationError(f"Email domain '{domain_part}' is invalid: {reason}")
        else:
            safe, reason = is_safe_hostname(clean, check_dns_resolution=check_dns_resolution)
            if not safe:
                raise SecurityValidationError(reason)

    return clean


class InMemoryRateLimiter:
    """
    Sliding-window in-memory rate limiter to protect OSINT endpoints from DoS and abuse.
    Tracks request timestamps per client IP.
    """

    def __init__(self, max_requests: int = 30, window_seconds: float = 60.0):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(self, client_ip: str) -> Tuple[bool, int]:
        """
        Checks whether client_ip is within the allowed request rate.
        Returns (is_allowed, retry_after_seconds).
        """
        now = time.time()
        cutoff = now - self.window_seconds

        # Clean old timestamps
        history = [t for t in self.requests[client_ip] if t > cutoff]
        self.requests[client_ip] = history

        if len(history) >= self.max_requests:
            earliest = history[0]
            retry_after = int(self.window_seconds - (now - earliest)) + 1
            return False, max(1, retry_after)

        self.requests[client_ip].append(now)
        return True, 0

    def reset(self):
        """Resets all tracked client histories (useful for testing)"""
        self.requests.clear()


# Global rate limiter instance: 30 scans per minute per client IP
scan_rate_limiter = InMemoryRateLimiter(max_requests=30, window_seconds=60.0)


def extract_client_ip(request: Any) -> str:
    """
    Extracts and validates client IP address from FastAPI Request object.
    Supports trusted reverse proxy headers (CF-Connecting-IP, X-Forwarded-For)
    with strict IP format validation to prevent header injection or spoofing.
    Falls back safely to direct socket client host or loopback.
    """
    if request is None:
        return "127.0.0.1"

    headers = getattr(request, "headers", None) or {}

    # 1. Cloudflare Connecting IP header
    cf_ip = headers.get("cf-connecting-ip") or headers.get("CF-Connecting-IP")
    if cf_ip and isinstance(cf_ip, str):
        candidate = cf_ip.strip()
        try:
            ipaddress.ip_address(candidate)
            return candidate
        except ValueError:
            pass

    # 2. X-Forwarded-For header (first hop is the original client IP)
    xff = headers.get("x-forwarded-for") or headers.get("X-Forwarded-For")
    if xff and isinstance(xff, str):
        hops = [h.strip() for h in xff.split(",") if h.strip()]
        for hop in hops:
            try:
                ipaddress.ip_address(hop)
                return hop
            except ValueError:
                continue

    # 3. Direct socket connection client host
    client = getattr(request, "client", None)
    if client and getattr(client, "host", None):
        candidate = str(client.host).strip()
        try:
            ipaddress.ip_address(candidate)
            return candidate
        except ValueError:
            pass

    return "127.0.0.1"

