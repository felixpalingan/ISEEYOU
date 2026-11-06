"""
Security Hardening & Anti-SSRF Defense Tests (Task 5.3)
Verifies:
1. Input sanitization (schemes, paths, queries, ports, null bytes, control chars).
2. Anti-SSRF blocking of loopback, RFC1918 private subnets, and cloud metadata.
3. DNS Rebinding detection for wildcard domains (*.nip.io, *.sslip.io).
4. Injection token rejection (shell metacharacters, HTML injection).
5. Sliding-window rate limiter enforcement.
6. API endpoint protection on /api/v1/scan and /api/v1/scan/stream/direct.
"""

import unittest
from fastapi.testclient import TestClient

from engine.core.security import (
    sanitize_target_input,
    is_safe_ip,
    is_safe_hostname,
    validate_target_security,
    SecurityValidationError,
    InMemoryRateLimiter,
    scan_rate_limiter,
)
from engine.main import app


class TestSecuritySanitization(unittest.TestCase):
    def test_protocol_scheme_stripping(self):
        self.assertEqual(sanitize_target_input("https://example.com"), "example.com")
        self.assertEqual(sanitize_target_input("http://target.org"), "target.org")
        self.assertEqual(sanitize_target_input("ftp://files.target.com"), "files.target.com")

    def test_path_query_and_hash_stripping(self):
        self.assertEqual(
            sanitize_target_input("https://example.com/admin/login?debug=1#section"),
            "example.com",
        )
        self.assertEqual(sanitize_target_input("sub.example.com/?q=test"), "sub.example.com")

    def test_port_stripping_from_hostname(self):
        self.assertEqual(sanitize_target_input("example.com:8080"), "example.com")
        self.assertEqual(sanitize_target_input("https://acme.io:443/test"), "acme.io")

    def test_null_byte_and_control_char_removal(self):
        self.assertEqual(sanitize_target_input("example.com\x00"), "example.com")
        self.assertEqual(sanitize_target_input("  target.com\r\n\t  "), "target.com")


class TestAntiSSRFProtection(unittest.TestCase):
    def test_loopback_ip_blocked(self):
        loopback_ips = ["127.0.0.1", "127.0.0.2", "127.100.50.1", "::1"]
        for ip in loopback_ips:
            safe, reason = is_safe_ip(ip)
            self.assertFalse(safe, f"Loopback IP {ip} should be blocked")
            self.assertIn("loopback", reason.lower())

    def test_private_rfc1918_ip_blocked(self):
        private_ips = [
            "10.0.0.1",
            "10.254.254.254",
            "172.16.0.1",
            "172.24.0.10",
            "172.31.255.255",
            "192.168.0.1",
            "192.168.100.50",
            "fc00::1",
            "fd00::1",
        ]
        for ip in private_ips:
            safe, reason = is_safe_ip(ip)
            self.assertFalse(safe, f"Private IP {ip} should be blocked")
            self.assertIn("private", reason.lower())

    def test_cloud_metadata_and_link_local_blocked(self):
        metadata_ips = [
            "169.254.169.254",  # AWS/GCP/Azure instance metadata service
            "169.254.1.1",
            "fe80::1",
        ]
        for ip in metadata_ips:
            safe, reason = is_safe_ip(ip)
            self.assertFalse(safe, f"Metadata/Link-local IP {ip} should be blocked")
            self.assertIn("link-local", reason.lower())

    def test_public_ips_allowed(self):
        public_ips = [
            "8.8.8.8",
            "1.1.1.1",
            "93.184.216.34",
            "2606:4700:4700::1111",
        ]
        for ip in public_ips:
            safe, reason = is_safe_ip(ip)
            self.assertTrue(safe, f"Public IP {ip} should be allowed. Reason: {reason}")
            self.assertEqual(reason, "")

    def test_internal_hostnames_blocked(self):
        blocked_hosts = [
            "localhost",
            "localhost.localdomain",
            "ip6-localhost",
            "metadata.google.internal",
            "instance-data",
            "server.local",
            "intranet.internal",
            "gateway.lan",
            "database.corp",
        ]
        for host in blocked_hosts:
            safe, reason = is_safe_hostname(host)
            self.assertFalse(safe, f"Host {host} should be blocked")

    def test_dns_rebinding_domains_blocked(self):
        rebinding_hosts = [
            "127.0.0.1.nip.io",
            "10.0.0.1.sslip.io",
            "192.168.1.1.xip.io",
            "169.254.169.254.nip.io",
            "test.127.0.0.1.nip.io",
        ]
        for host in rebinding_hosts:
            safe, reason = is_safe_hostname(host)
            self.assertFalse(safe, f"DNS rebinding host {host} should be blocked")
            self.assertIn("rebinding", reason.lower())

    def test_public_domains_allowed(self):
        allowed_domains = [
            "example.com",
            "sub.defense.io",
            "security.org",
            "github.com",
        ]
        for domain in allowed_domains:
            safe, reason = is_safe_hostname(domain)
            self.assertTrue(safe, f"Domain {domain} should be allowed. Reason: {reason}")


class TestTargetSecurityValidator(unittest.TestCase):
    def test_validate_target_security_success(self):
        self.assertEqual(validate_target_security("https://example.com:443/"), "example.com")
        self.assertEqual(validate_target_security("8.8.8.8"), "8.8.8.8")
        self.assertEqual(validate_target_security("admin@defense.io"), "admin@defense.io")

    def test_validate_target_security_ssrf_rejection(self):
        with self.assertRaises(SecurityValidationError):
            validate_target_security("127.0.0.1")

        with self.assertRaises(SecurityValidationError):
            validate_target_security("http://169.254.169.254/latest/meta-data/")

        with self.assertRaises(SecurityValidationError):
            validate_target_security("localhost")

        with self.assertRaises(SecurityValidationError):
            validate_target_security("127.0.0.1.nip.io")

    def test_validate_target_security_injection_rejection(self):
        dangerous_targets = [
            "example.com; rm -rf /",
            "target.com && whoami",
            "<script>alert(1)</script>",
            "target.com|cat /etc/passwd",
            "example.com`id`",
        ]
        for target in dangerous_targets:
            with self.assertRaises(SecurityValidationError, msg=f"Target {target} should be rejected"):
                validate_target_security(target)


class TestRateLimiter(unittest.TestCase):
    def test_rate_limiter_allows_and_blocks(self):
        limiter = InMemoryRateLimiter(max_requests=3, window_seconds=10.0)
        ip = "192.0.2.1"

        # First 3 allowed
        self.assertTrue(limiter.is_allowed(ip)[0])
        self.assertTrue(limiter.is_allowed(ip)[0])
        self.assertTrue(limiter.is_allowed(ip)[0])

        # 4th blocked
        allowed, retry_after = limiter.is_allowed(ip)
        self.assertFalse(allowed)
        self.assertGreater(retry_after, 0)

        # Different IP allowed
        self.assertTrue(limiter.is_allowed("198.51.100.1")[0])


class TestAPIEndpointSecurity(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        scan_rate_limiter.reset()

    def test_post_scan_blocks_loopback(self):
        response = self.client.post("/api/v1/scan", json={"seed_input": "127.0.0.1"})
        self.assertIn(response.status_code, (400, 422))
        self.assertIn("loopback", response.text.lower())

    def test_post_scan_blocks_cloud_metadata(self):
        response = self.client.post("/api/v1/scan", json={"seed_input": "169.254.169.254"})
        self.assertIn(response.status_code, (400, 422))
        self.assertIn("metadata", response.text.lower())

    def test_post_scan_blocks_localhost(self):
        response = self.client.post("/api/v1/scan", json={"seed_input": "localhost"})
        self.assertIn(response.status_code, (400, 422))
        self.assertIn("internal hostname", response.text.lower())

    def test_post_scan_allows_legitimate_target(self):
        response = self.client.post("/api/v1/scan", json={"seed_input": "example.com"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["seed_input"], "example.com")
        self.assertEqual(data["status"], "running")

    def test_direct_stream_blocks_ssrf(self):
        response = self.client.get("/api/v1/scan/stream/direct?target=127.0.0.1")
        self.assertEqual(response.status_code, 400)
        self.assertIn("loopback", response.text.lower())


if __name__ == "__main__":
    unittest.main()
