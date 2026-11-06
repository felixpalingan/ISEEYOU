import { VulnerabilityFinding } from '@iseeyou/shared-types';

export type RemediationPlatform = 'ufw' | 'nginx' | 'apache' | 'cloudflare' | 'dns';

export interface RemediationSnippet {
  platform: RemediationPlatform;
  label: string;
  iconName: string;
  filename: string;
  language: 'bash' | 'nginx' | 'apache' | 'json';
  code: string;
  description: string;
  verificationCommand: string;
}

export interface RemediationPack {
  findingId?: string;
  title: string;
  target: string;
  severity: string;
  summary: string;
  snippets: Record<RemediationPlatform, RemediationSnippet>;
}

/**
 * Generates tailored, production-ready remediation snippets across 5 major platforms:
 * 1. Linux UFW (Uncomplicated Firewall)
 * 2. Nginx Web Server configuration
 * 3. Apache HTTP Server (.htaccess)
 * 4. Cloudflare WAF Expression Rule (Terraform / API / Dashboard JSON)
 * 5. DNS & Cloud Platform Takedown Playbook
 */
export function generateRemediationPack(
  finding: VulnerabilityFinding | null,
  target: string
): RemediationPack {
  const title = (finding?.title || '').toLowerCase();
  const evidence = (finding?.evidence || '').toLowerCase();
  const targetClean = target.replace(/^https?:\/\//, '').split('/')[0];

  // 1. Database Port Exposures (MySQL, Postgres, Redis, MongoDB, MSSQL)
  if (
    title.includes('mysql') ||
    title.includes('3306') ||
    title.includes('postgres') ||
    title.includes('5432') ||
    title.includes('redis') ||
    title.includes('6379') ||
    title.includes('mongodb') ||
    title.includes('27017')
  ) {
    let port = '3306';
    let service = 'MySQL';
    if (title.includes('postgres') || title.includes('5432')) {
      port = '5432';
      service = 'PostgreSQL';
    } else if (title.includes('redis') || title.includes('6379')) {
      port = '6379';
      service = 'Redis';
    } else if (title.includes('mongodb') || title.includes('27017')) {
      port = '27017';
      service = 'MongoDB';
    }

    return {
      findingId: finding?.id,
      title: finding?.title || `Exposed ${service} Database Port`,
      target: targetClean,
      severity: finding?.severity || 'HIGH',
      summary: `Publicly exposed ${service} service on port ${port}/tcp detected. Immediate inbound isolation is required to prevent unauthorized data exfiltration or remote code execution.`,
      snippets: {
        ufw: {
          platform: 'ufw',
          label: 'UFW Firewall',
          iconName: 'Shield',
          filename: `ufw-block-${service.toLowerCase()}.sh`,
          language: 'bash',
          description: `Denies all public inbound traffic to ${service} while whitelisting private RFC 1918 VPC addresses.`,
          code: `# 1. Deny public external access to ${service} port ${port}
sudo ufw deny ${port}/tcp

# 2. Allow access only from trusted private VPC subnets (e.g., 10.0.0.0/8)
sudo ufw allow from 10.0.0.0/8 to any port ${port} proto tcp

# 3. Reload firewall and verify active rules
sudo ufw reload
sudo ufw status verbose | grep ${port}`,
          verificationCommand: `nc -zv -w3 ${targetClean} ${port} # Expected: Connection timed out / refused`,
        },
        nginx: {
          platform: 'nginx',
          label: 'Nginx Block',
          iconName: 'Server',
          filename: `nginx-${service.toLowerCase()}-guard.conf`,
          language: 'nginx',
          description: `Blocks external web proxying to ${service} administrative and internal management endpoints.`,
          code: `# Block access to database management endpoints
location ~* /(phpmyadmin|pma|adminer|pgadmin|redis-commander|db-admin) {
    deny all;
    return 403 "Forbidden: Direct database management ingress disabled by ISEEYOU.";
}

# Deny access to sensitive database dumps and connection files
location ~* \\.(sql|sqlite|db|dump|sql\\.gz|env)$ {
    deny all;
    return 404;
}`,
          verificationCommand: `sudo nginx -t && sudo systemctl reload nginx`,
        },
        apache: {
          platform: 'apache',
          label: 'Apache .htaccess',
          iconName: 'FileCode',
          filename: '.htaccess',
          language: 'apache',
          description: `Protects Apache document roots from database backup leaks and admin console ingress.`,
          code: `# Block database backup leaks and config files
<FilesMatch "(?i)\\.(sql|sqlite|db|env|conf|ini|dump)$">
    Require all denied
</FilesMatch>

# Block known database web admin paths
RewriteEngine On
RewriteCond %{REQUEST_URI} ^/(phpmyadmin|pma|adminer|pgadmin) [NC]
RewriteRule ^ - [F,L]`,
          verificationCommand: `curl -I https://${targetClean}/phpmyadmin # Expected: HTTP 403 Forbidden`,
        },
        cloudflare: {
          platform: 'cloudflare',
          label: 'Cloudflare WAF',
          iconName: 'Cloud',
          filename: `cloudflare-waf-${service.toLowerCase()}.json`,
          language: 'json',
          description: `Cloudflare Edge Custom Rule to drop malicious scanner probes targeting database endpoints.`,
          code: `{
  "name": "ISEEYOU - Block Exposed ${service} & DB Admin Scanners",
  "action": "block",
  "description": "Block database reconnaissance probes against ${targetClean}",
  "expression": "(http.request.uri.path contains \\"phpmyadmin\\" or http.request.uri.path contains \\"pma\\" or http.request.uri.path contains \\"adminer\\" or http.request.uri.path contains \\".sql\\" or tcp.port in {${port}})"
}`,
          verificationCommand: `curl -I https://${targetClean}/test.sql # Expected: Cloudflare 403 / 1020 Ray Block`,
        },
        dns: {
          platform: 'dns',
          label: 'Bind / Config Hardening',
          iconName: 'Lock',
          filename: `${service.toLowerCase()}-bind.conf`,
          language: 'bash',
          description: `Binds the ${service} daemon to localhost loopback so it refuses external network packets.`,
          code: `# Edit service configuration to bind to localhost only (127.0.0.1)
# File: /etc/${service.toLowerCase()}/${service.toLowerCase()}.conf
sudo sed -i 's/^bind-address.*/bind-address = 127.0.0.1/' /etc/${service.toLowerCase()}/${service.toLowerCase()}.conf

# Restart daemon to apply loopback binding
sudo systemctl restart ${service.toLowerCase()}
sudo ss -tulpn | grep :${port}`,
          verificationCommand: `sudo lsof -i :${port} # Should show 127.0.0.1:${port} (NOT 0.0.0.0:${port})`,
        },
      },
    };
  }

  // 2. Dangling CNAME / Subdomain Takeover Vulnerabilities
  if (
    title.includes('takeover') ||
    title.includes('cname') ||
    title.includes('dangling') ||
    evidence.includes('dangling')
  ) {
    const sub = finding?.node_id || targetClean;
    return {
      findingId: finding?.id,
      title: finding?.title || 'Dangling CNAME Subdomain Takeover',
      target: sub,
      severity: finding?.severity || 'CRITICAL',
      summary: `Dangling CNAME pointer detected on '${sub}'. An external adversary could register the unclaimed cloud resource (S3 bucket, GitHub Pages, Heroku, Azure) and hijack the subdomain to serve malware or steal session cookies.`,
      snippets: {
        ufw: {
          platform: 'ufw',
          label: 'UFW Firewall',
          iconName: 'Shield',
          filename: 'ufw-quarantine-subdomain.sh',
          language: 'bash',
          description: 'Quarantines network traffic intended for the vulnerable origin IP.',
          code: `# Isolate traffic from the vulnerable subdomain resolver IP
sudo ufw reject from any to any port 80,443 proto tcp
sudo ufw reload`,
          verificationCommand: `sudo ufw status`,
        },
        nginx: {
          platform: 'nginx',
          label: 'Nginx Block',
          iconName: 'Server',
          filename: 'nginx-subdomain-takedown.conf',
          language: 'nginx',
          description: 'Serves an immediate 404/410 Gone stub for the hijacked host header.',
          code: `# Sinkhole dangling subdomain traffic immediately
server {
    listen 80;
    listen 443 ssl;
    server_name ${sub};

    return 410 "ISEEYOU ASM: Subdomain decommissioned and pending DNS de-registration.";
}`,
          verificationCommand: `curl -I -H "Host: ${sub}" http://localhost # Expected: HTTP 410 Gone`,
        },
        apache: {
          platform: 'apache',
          label: 'Apache .htaccess',
          iconName: 'FileCode',
          filename: '.htaccess',
          language: 'apache',
          description: 'Rejects requests routing through the stale subdomain.',
          code: `RewriteEngine On
RewriteCond %{HTTP_HOST} ^${sub.replace('.', '\\.')}$ [NC]
RewriteRule ^ - [G,L] # Return 410 Gone`,
          verificationCommand: `curl -I https://${sub}`,
        },
        cloudflare: {
          platform: 'cloudflare',
          label: 'Cloudflare WAF',
          iconName: 'Cloud',
          filename: 'cloudflare-drop-host.json',
          language: 'json',
          description: 'Cloudflare WAF rule to immediately drop all ingress to the vulnerable hostname.',
          code: `{
  "name": "ISEEYOU - Drop Traffic to Dangling Host ${sub}",
  "action": "block",
  "description": "Block traffic while stale CNAME is pruned in authoritative DNS",
  "expression": "(http.host eq \\"${sub}\\")"
}`,
          verificationCommand: `curl -I https://${sub} # Expected: Cloudflare 403 or Block page`,
        },
        dns: {
          platform: 'dns',
          label: 'DNS Remediation CLI',
          iconName: 'Lock',
          filename: 'dns-prune.sh',
          language: 'bash',
          description: 'Commands to verify, purge, and re-claim the dangling CNAME pointer.',
          code: `# 1. Verify current canonical name and unresolved target
dig +short CNAME ${sub}

# 2. Re-claim resource in cloud provider (e.g. AWS S3 bucket)
# aws s3api create-bucket --bucket ${sub} --region us-east-1

# 3. OR remove stale record via Cloudflare / Route53 CLI
# cloudflare-cli dns delete --name "${sub}"`,
          verificationCommand: `host ${sub} # Expected: Host ${sub} not found: 3(NXDOMAIN)`,
        },
      },
    };
  }

  // 3. Compromised Credentials / Breached Passwords
  if (
    title.includes('credential') ||
    title.includes('breach') ||
    title.includes('pwned') ||
    title.includes('password')
  ) {
    return {
      findingId: finding?.id,
      title: finding?.title || 'Compromised Credential Exposure',
      target: targetClean,
      severity: finding?.severity || 'CRITICAL',
      summary: `Exposed password hash match detected via HaveIBeenPwned k-anonymity database. Adversaries actively automate credential stuffing and password spraying against corporate portals using these breach dictionaries.`,
      snippets: {
        ufw: {
          platform: 'ufw',
          label: 'UFW Firewall',
          iconName: 'Shield',
          filename: 'ufw-rate-limit-auth.sh',
          language: 'bash',
          description: 'Rate-limits SSH and administrative login ports to defeat brute-force spraying.',
          code: `# Enforce rate-limiting on SSH port 22 (max 6 connections / 30 sec)
sudo ufw limit 22/tcp

# Drop aggressive continuous sprayers
sudo iptables -I INPUT -p tcp --dport 22 -m state --state NEW -m recent --set
sudo iptables -I INPUT -p tcp --dport 22 -m state --state NEW -m recent --update --seconds 60 --hitcount 4 -j DROP`,
          verificationCommand: `sudo iptables -L -n -v | grep dport`,
        },
        nginx: {
          platform: 'nginx',
          label: 'Nginx Block',
          iconName: 'Server',
          filename: 'nginx-auth-ratelimit.conf',
          language: 'nginx',
          description: 'Applies token-bucket rate limiting and brute-force mitigation on authentication endpoints.',
          code: `# Define rate-limiting zone for login attempts (5 requests per minute per IP)
limit_req_zone $binary_remote_addr zone=login_spray:10m rate=5r/m;

location ~* /(api/v1/auth|login|signin|oauth/token|wp-login\\.php) {
    limit_req zone=login_spray burst=3 nodelay;
    limit_req_status 429;
    
    # Optional: Deny known proxy headers without trusted upstream
    proxy_set_header X-Forwarded-For $remote_addr;
}`,
          verificationCommand: `ab -n 10 -c 1 https://${targetClean}/login # Expected: 429 Too Many Requests after 5`,
        },
        apache: {
          platform: 'apache',
          label: 'Apache .htaccess',
          iconName: 'FileCode',
          filename: '.htaccess',
          language: 'apache',
          description: 'Blocks XML-RPC and brute-force credential vectors.',
          code: `# Block WordPress xmlrpc.php multi-auth amplification attack
<Files "xmlrpc.php">
    Require all denied
</Files>

# Require SSL and enforce secure headers on authentication
<LocationMatch "(?i)/(login|auth|signin)">
    Require ssl
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
</LocationMatch>`,
          verificationCommand: `curl -I https://${targetClean}/xmlrpc.php # Expected: HTTP 403 Forbidden`,
        },
        cloudflare: {
          platform: 'cloudflare',
          label: 'Cloudflare WAF',
          iconName: 'Cloud',
          filename: 'cloudflare-credential-stuffing-rule.json',
          language: 'json',
          description: 'Challenges suspicious bot-like login attempts using Cloudflare Managed Challenge.',
          code: `{
  "name": "ISEEYOU - Defend Login Endpoints Against Credential Stuffing",
  "action": "managed_challenge",
  "description": "Trigger interactive challenge when high-threat IP accesses authentication forms",
  "expression": "(http.request.uri.path contains \\"login\\" or http.request.uri.path contains \\"auth\\") and (cf.threat_score gt 10 or cf.client.bot)"
}`,
          verificationCommand: `curl -I https://${targetClean}/login # Bot user-agent will trigger challenge`,
        },
        dns: {
          platform: 'dns',
          label: 'IAM & SSO Playbook',
          iconName: 'Lock',
          filename: 'enforce-mfa-playbook.sh',
          language: 'bash',
          description: 'Immediate identity lifecycle actions to revoke leaked tokens and enforce MFA.',
          code: `# 1. Revoke active JWT session tokens and refresh tokens
# vault-cli token revoke -mode=prefix user_sessions/

# 2. Force mandatory password reset on affected identity
# okta-cli users update --id <USER_ID> --force-password-reset

# 3. Enforce FIDO2 / WebAuthn hardware key enrollment for all privileged users
# identity-provider policy set --mfa=enforce --allowed-factors=fido2,webauthn`,
          verificationCommand: `vault status || okta-cli check-compliance`,
        },
      },
    };
  }

  // 4. Insecure Remote Admin Ports (Telnet 23, FTP 21, RDP 3389, SMB 445)
  if (
    title.includes('telnet') ||
    title.includes('23') ||
    title.includes('rdp') ||
    title.includes('3389') ||
    title.includes('smb') ||
    title.includes('445') ||
    title.includes('ftp') ||
    title.includes('21')
  ) {
    let port = '23';
    let proto = 'Telnet';
    if (title.includes('rdp') || title.includes('3389')) {
      port = '3389';
      proto = 'RDP';
    } else if (title.includes('smb') || title.includes('445')) {
      port = '445';
      proto = 'SMB';
    } else if (title.includes('ftp') || title.includes('21')) {
      port = '21';
      proto = 'FTP';
    }

    return {
      findingId: finding?.id,
      title: finding?.title || `Insecure ${proto} Protocol Exposed`,
      target: targetClean,
      severity: finding?.severity || 'CRITICAL',
      summary: `Insecure or legacy administrative protocol (${proto} port ${port}/tcp) exposed to public internet. Attackers can sniff cleartext traffic or deploy ransomware payloads (e.g. EternalBlue on SMB).`,
      snippets: {
        ufw: {
          platform: 'ufw',
          label: 'UFW Firewall',
          iconName: 'Shield',
          filename: `ufw-block-${proto.toLowerCase()}.sh`,
          language: 'bash',
          description: `Completely shuts down public internet access to ${proto} port ${port}.`,
          code: `# Drop public inbound access to ${proto} (${port}/tcp)
sudo ufw deny ${port}/tcp

# Drop related UDP channels if applicable
sudo ufw deny ${port}/udp

# Verify firewall status
sudo ufw reload && sudo ufw status verbose`,
          verificationCommand: `nc -zv -w3 ${targetClean} ${port} # Expected: Connection timed out / refused`,
        },
        nginx: {
          platform: 'nginx',
          label: 'Nginx Block',
          iconName: 'Server',
          filename: 'nginx-drop-scanners.conf',
          language: 'nginx',
          description: 'Blocks common network scanning user-agents attempting protocol negotiation.',
          code: `# Block port scanner user agents probing edge proxies
if ($http_user_agent ~* (masscan|zgrab|nmap|nikto|shodan|censys)) {
    return 444; # Nginx special code: Close connection without response
}`,
          verificationCommand: `curl -A "masscan" http://${targetClean} # Expected: Empty response / connection closed`,
        },
        apache: {
          platform: 'apache',
          label: 'Apache .htaccess',
          iconName: 'FileCode',
          filename: '.htaccess',
          language: 'apache',
          description: 'Rejects requests from automated vulnerability scanners.',
          code: `RewriteEngine On
RewriteCond %{HTTP_USER_AGENT} (masscan|nmap|nikto|shodan|censys) [NC]
RewriteRule ^ - [F,L]`,
          verificationCommand: `curl -A "nikto" https://${targetClean}`,
        },
        cloudflare: {
          platform: 'cloudflare',
          label: 'Cloudflare WAF',
          iconName: 'Cloud',
          filename: `cloudflare-block-${proto.toLowerCase()}.json`,
          language: 'json',
          description: 'Blocks non-HTTP port traffic and scanner user-agents at Cloudflare edge.',
          code: `{
  "name": "ISEEYOU - Drop Scanners & Non-HTTP Probes for ${proto}",
  "action": "block",
  "description": "Block vulnerability scanner agents targeting ${proto}",
  "expression": "(http.user_agent contains \\"masscan\\" or http.user_agent contains \\"shodan\\" or http.user_agent contains \\"nmap\\")"
}`,
          verificationCommand: `curl -I https://${targetClean}`,
        },
        dns: {
          platform: 'dns',
          label: 'Daemon Shutdown',
          iconName: 'Lock',
          filename: `disable-${proto.toLowerCase()}.sh`,
          language: 'bash',
          description: `Disables the insecure ${proto} service daemon completely.`,
          code: `# Stop and disable insecure service
sudo systemctl stop ${proto.toLowerCase()} 2>/dev/null || sudo service ${proto.toLowerCase()} stop
sudo systemctl disable ${proto.toLowerCase()} 2>/dev/null

# Verify port is closed
sudo ss -tulpn | grep :${port}`,
          verificationCommand: `sudo ss -tulpn | grep :${port} # Should return empty`,
        },
      },
    };
  }

  // 5. Default General Security Hardening Pack
  return {
    findingId: finding?.id,
    title: finding?.title || 'Perimeter Defense & Rate-Limiting Hardening',
    target: targetClean,
    severity: finding?.severity || 'LOW',
    summary: `Baseline perimeter hardening configuration across Linux UFW, Nginx web proxy, Apache HTTP Server, and Cloudflare WAF to minimize reconnaissance visibility and rate-limit untrusted traffic.`,
    snippets: {
      ufw: {
        platform: 'ufw',
        label: 'UFW Firewall',
        iconName: 'Shield',
        filename: 'ufw-baseline-hardening.sh',
        language: 'bash',
        description: 'Enforces default-deny incoming firewall policy and allows only HTTP/HTTPS and SSH.',
        code: `# Default deny incoming policy
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow standard web traffic
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Restrict SSH (recommend port change or VPN whitelist)
sudo ufw limit 22/tcp

# Enable firewall
sudo ufw --force enable
sudo ufw status verbose`,
        verificationCommand: `sudo ufw status verbose`,
      },
      nginx: {
        platform: 'nginx',
        label: 'Nginx Block',
        iconName: 'Server',
        filename: 'nginx-security-headers.conf',
        language: 'nginx',
        description: 'Injects modern cybersecurity response headers and disables server version disclosure.',
        code: `# Hide Nginx server version header
server_tokens off;

# Enforce modern security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

# Block dotfiles (e.g. .git, .env)
location ~ /\\.(?!well-known) {
    deny all;
}`,
        verificationCommand: `curl -I http://localhost | grep -i server`,
      },
      apache: {
        platform: 'apache',
        label: 'Apache .htaccess',
        iconName: 'FileCode',
        filename: '.htaccess',
        language: 'apache',
        description: 'Hardens Apache with security headers and suppresses signature disclosure.',
        code: `# Suppress server signature
ServerSignature Off

# Prevent directory indexing
Options -Indexes

# Security Headers
<IfModule mod_headers.c>
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>

# Block hidden files (.git, .env, .htaccess)
<FilesMatch "^\\.">
    Require all denied
</FilesMatch>`,
        verificationCommand: `curl -I https://${targetClean}`,
      },
      cloudflare: {
        platform: 'cloudflare',
        label: 'Cloudflare WAF',
        iconName: 'Cloud',
        filename: 'cloudflare-baseline-waf.json',
        language: 'json',
        description: 'Baseline Cloudflare WAF rule to challenge low-reputation IPs and automated scanners.',
        code: `{
  "name": "ISEEYOU - Baseline Edge Hardening for ${targetClean}",
  "action": "managed_challenge",
  "description": "Challenge automated scanners and requests with high threat score",
  "expression": "(cf.threat_score gt 25) or (http.request.uri.path contains \\"/.env\\") or (http.request.uri.path contains \\"/.git\\")"
}`,
        verificationCommand: `curl -I https://${targetClean}/.env # Expected: Cloudflare Challenge or Block`,
      },
      dns: {
        platform: 'dns',
        label: 'DNS CAA & SPF',
        iconName: 'Lock',
        filename: 'dns-security-records.txt',
        language: 'bash',
        description: 'Authoritative DNS security records (CAA, DMARC, SPF) to prevent domain spoofing.',
        code: `# CAA Record: Restrict certificate issuance to Let's Encrypt and DigiCert
${targetClean}. IN CAA 0 issue "letsencrypt.org"
${targetClean}. IN CAA 0 issue "digicert.com"
${targetClean}. IN CAA 0 iodef "mailto:security@${targetClean}"

# DMARC Record: Reject unauthorized spoofed emails
_dmarc.${targetClean}. IN TXT "v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s; rua=mailto:dmarc-reports@${targetClean}"`,
        verificationCommand: `dig +short CAA ${targetClean}`,
      },
    },
  };
}
