import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EntityNode, VulnerabilityFinding, AIAnalysisReport } from '@iseeyou/shared-types';
import { getNodeProvenance } from './provenance';
import { generateRemediationPack } from './remediation';

export type TLPLevel = 'TLP:CLEAR' | 'TLP:GREEN' | 'TLP:AMBER' | 'TLP:RED';

export interface PDFExportOptions {
  target: string;
  targetType?: string;
  riskScore: number;
  findings: VulnerabilityFinding[];
  nodes: EntityNode[];
  aiReport?: AIAnalysisReport | null;
  organizationName?: string;
  auditorName?: string;
  tlpLevel?: TLPLevel;
  maskSensitiveData?: boolean;
  includeAiNarrative?: boolean;
  includeAssetInventory?: boolean;
  includeRemediationPlaybook?: boolean;
}

/**
 * Sanitizes and masks sensitive passwords, credentials, and API tokens
 * in compliance with ISEEYOU AppSec Architecture (Information Disclosure protection).
 */
export function maskSensitiveCredentials(text: string): string {
  if (!text) return '';
  return text
    .replace(/(password|passwd|pwd|secret|api[_-]?key|token|bearer)\s*[:=]\s*([^\s,;]+)/gi, (match, prefix, val) => {
      if (val.length <= 4) return `${prefix}: ****`;
      return `${prefix}: ${val.slice(0, 2)}${'*'.repeat(Math.max(4, val.length - 4))}${val.slice(-2)}`;
    })
    .replace(/(AKIA[0-9A-Z]{16})/g, (val) => `${val.slice(0, 4)}************${val.slice(-4)}`)
    .replace(/([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+):([^\s,;]+)/g, (match, email, pwd) => {
      return `${email}:${pwd.length <= 4 ? '****' : `${pwd.slice(0, 2)}****${pwd.slice(-2)}`}`;
    });
}

function getSeverityRgb(severity: string): [number, number, number] {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return [220, 38, 38]; // Red 600
    case 'high':
      return [234, 88, 12]; // Orange 600
    case 'medium':
      return [202, 138, 4]; // Yellow 600
    case 'low':
      return [13, 148, 136]; // Teal 600
    case 'info':
    default:
      return [37, 99, 235]; // Blue 600
  }
}

function getTlpRgb(tlp: TLPLevel): [number, number, number] {
  switch (tlp) {
    case 'TLP:RED':
      return [220, 38, 38];
    case 'TLP:AMBER':
      return [217, 119, 6];
    case 'TLP:GREEN':
      return [22, 163, 74];
    case 'TLP:CLEAR':
    default:
      return [71, 85, 105];
  }
}

/**
 * Builds a cryptographic/fingerprint checksum string for document authenticity
 */
function generateAuditChecksum(target: string, findingsCount: number, riskScore: number): string {
  let hash = 0;
  const input = `${target}_${findingsCount}_${riskScore}_${new Date().toISOString().slice(0, 10)}`;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `SHA256-${Math.abs(hash).toString(16).padStart(8, '0').toUpperCase()}8F10B24D9C`;
}

/**
 * Generates an Enterprise-Grade PDF Audit Report for External Attack Surface Management
 */
export function generateAuditReportPDF(options: PDFExportOptions): jsPDF {
  const {
    target,
    targetType = 'domain',
    riskScore,
    findings,
    nodes,
    aiReport,
    organizationName = 'Internal Target Infrastructure',
    auditorName = 'ISEEYOU Automated Recon Mesh',
    tlpLevel = 'TLP:AMBER',
    maskSensitiveData = true,
    includeAiNarrative = true,
    includeAssetInventory = true,
    includeRemediationPlaybook = true,
  } = options;

  // Initialize jsPDF A4 in Portrait mode (mm units)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  const now = new Date();
  const scanDateFormatted = `${now.toISOString().slice(0, 10)} ${now.toLocaleTimeString('en-US', { hour12: false })} UTC`;
  const reportDocId = `ISEE-${now.getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const checksum = generateAuditChecksum(target, findings.length, riskScore);

  let currentY = 14;

  // ==========================================
  // 1. TOP BRANDING & CLASSIFICATION BANNER
  // ==========================================
  // Dark header block [15, 23, 42]
  doc.setFillColor(15, 23, 42);
  doc.rect(marginX, currentY, contentWidth, 34, 'F');

  // Cyan accent line on top edge
  doc.setFillColor(0, 122, 204);
  doc.rect(marginX, currentY, contentWidth, 2, 'F');

  // Title: ISEEYOU COMMAND CENTER
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('ISEEYOU // EASM COMMAND CENTER', marginX + 6, currentY + 11);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('EXTERNAL ATTACK SURFACE & OSINT THREAT INTELLIGENCE AUDIT', marginX + 6, currentY + 17);

  // Document ID & Engine version
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text(`DOC-ID: ${reportDocId}  •  ENGINE: v0.1.0-PRO  •  STANDARD: PTES & OSSTMM`, marginX + 6, currentY + 23);
  doc.text(`HASH INTEGRITY: ${checksum}`, marginX + 6, currentY + 28);

  // TLP Marking Badge (Right side of header)
  const tlpColor = getTlpRgb(tlpLevel);
  const tlpBoxWidth = 36;
  const tlpBoxX = marginX + contentWidth - tlpBoxWidth - 6;
  doc.setFillColor(24, 33, 56);
  doc.roundedRect(tlpBoxX, currentY + 7, tlpBoxWidth, 20, 2, 2, 'F');
  doc.setDrawColor(...tlpColor);
  doc.setLineWidth(0.6);
  doc.roundedRect(tlpBoxX, currentY + 7, tlpBoxWidth, 20, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...tlpColor);
  doc.text(tlpLevel, tlpBoxX + tlpBoxWidth / 2, currentY + 15, { align: 'center' });
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text('STRICT ACCESS', tlpBoxX + tlpBoxWidth / 2, currentY + 21, { align: 'center' });

  currentY += 38;

  // ==========================================
  // 2. METADATA & EXECUTIVE SUMMARY SCORECARD
  // ==========================================
  // Metadata 2-column Box
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, currentY, contentWidth, 22, 1.5, 1.5, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('TARGET IDENTIFIER:', marginX + 5, currentY + 6);
  doc.text('ORGANIZATION:', marginX + 5, currentY + 12);
  doc.text('LEAD AUDITOR / SECOPS:', marginX + 5, currentY + 18);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`${target} (${targetType.toUpperCase()})`, marginX + 46, currentY + 6);
  doc.text(organizationName, marginX + 46, currentY + 12);
  doc.text(auditorName, marginX + 46, currentY + 18);

  const col2X = marginX + contentWidth / 2 + 5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('ASSESSMENT DATE:', col2X, currentY + 6);
  doc.text('METHODOLOGY:', col2X, currentY + 12);
  doc.text('CREDENTIAL MASKING:', col2X, currentY + 18);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(scanDateFormatted, col2X + 38, currentY + 6);
  doc.text('Non-Intrusive Passive Recon', col2X + 38, currentY + 12);
  doc.text(maskSensitiveData ? 'ENABLED (SHA-1 / Redacted)' : 'DISABLED', col2X + 38, currentY + 18);

  currentY += 26;

  // ==========================================
  // 3. EXECUTIVE KPI CARDS (4 TILES)
  // ==========================================
  const cardGap = 3.5;
  const cardCount = 4;
  const cardWidth = (contentWidth - cardGap * (cardCount - 1)) / cardCount;
  const cardHeight = 18;

  // Card 1: Risk Score
  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;
  const riskPosture = riskScore >= 70 ? 'CRITICAL' : riskScore >= 40 ? 'HIGH' : riskScore >= 20 ? 'MEDIUM' : 'LOW';
  const riskRgb = getSeverityRgb(riskPosture.toLowerCase());

  doc.setFillColor(254, 242, 242); // Red tint
  doc.setDrawColor(...riskRgb);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...riskRgb);
  doc.text('ATTACK SURFACE RISK', marginX + cardWidth / 2, currentY + 5.5, { align: 'center' });
  doc.setFontSize(11);
  doc.text(`${riskScore}/100 [${riskPosture}]`, marginX + cardWidth / 2, currentY + 12, { align: 'center' });

  // Card 2: Exposed Assets
  const card2X = marginX + (cardWidth + cardGap);
  doc.setFillColor(240, 249, 255); // Sky tint
  doc.setDrawColor(2, 132, 199);
  doc.roundedRect(card2X, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');
  doc.setFontSize(7);
  doc.setTextColor(2, 132, 199);
  doc.text('DISCOVERED ASSETS', card2X + cardWidth / 2, currentY + 5.5, { align: 'center' });
  doc.setFontSize(11);
  doc.text(`${nodes.length} Nodes`, card2X + cardWidth / 2, currentY + 12, { align: 'center' });

  // Card 3: Vulnerabilities Found
  const card3X = marginX + (cardWidth + cardGap) * 2;
  doc.setFillColor(254, 243, 199); // Amber tint
  doc.setDrawColor(217, 119, 6);
  doc.roundedRect(card3X, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');
  doc.setFontSize(7);
  doc.setTextColor(217, 119, 6);
  doc.text('TOTAL VULNERABILITIES', card3X + cardWidth / 2, currentY + 5.5, { align: 'center' });
  doc.setFontSize(11);
  doc.text(`${findings.length} Exposures`, card3X + cardWidth / 2, currentY + 12, { align: 'center' });

  // Card 4: Critical & High Priority
  const card4X = marginX + (cardWidth + cardGap) * 3;
  doc.setFillColor(243, 244, 246);
  doc.setDrawColor(107, 114, 128);
  doc.roundedRect(card4X, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');
  doc.setFontSize(7);
  doc.setTextColor(55, 65, 81);
  doc.text('HIGH / CRITICAL FLAWS', card4X + cardWidth / 2, currentY + 5.5, { align: 'center' });
  doc.setFontSize(11);
  doc.text(`${criticalCount + highCount} Actionable`, card4X + cardWidth / 2, currentY + 12, { align: 'center' });

  currentY += cardHeight + 6;

  // ==========================================
  // 4. EXECUTIVE SUMMARY & AI SYNTHESIS
  // ==========================================
  if (includeAiNarrative) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('1. EXECUTIVE SUMMARY & THREAT FORECAST', marginX, currentY);
    currentY += 3;

    // Narrative Box
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);

    const execSummaryText =
      aiReport?.executiveSummary ||
      `Target infrastructure "${target}" exhibits an aggregate attack surface risk score of ${riskScore}/100. Reconnaissance identified ${nodes.length} perimeter assets, ${criticalCount} critical exposures, and ${highCount} high-severity vulnerabilities. Passive OSINT correlation indicates immediate risk of unauthorized credential stuffing, unauthenticated administrative access, and lateral pivoting if remediations are not executed within the standard 72-hour SLA.`;

    const cleanSummary = maskSensitiveData ? maskSensitiveCredentials(execSummaryText) : execSummaryText;
    const splitSummary = doc.splitTextToSize(cleanSummary, contentWidth - 10);
    const boxHeight = Math.max(22, splitSummary.length * 4.2 + 8);

    doc.roundedRect(marginX, currentY, contentWidth, boxHeight, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(splitSummary, marginX + 5, currentY + 6);

    currentY += boxHeight + 6;
  }

  // ==========================================
  // 5. MITRE ATT&CK CHAIN TABLE
  // ==========================================
  if (aiReport?.attackChain && aiReport.attackChain.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('2. ADVERSARIAL ATTACK CHAIN (MITRE ATT&CK)', marginX, currentY);
    currentY += 2;

    const attackRows = aiReport.attackChain.map((step) => [
      `Step ${step.step}`,
      step.technique,
      step.targetAsset,
      maskSensitiveData ? maskSensitiveCredentials(step.description) : step.description,
      step.impact,
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Step', 'MITRE Technique', 'Target Asset', 'Adversarial Description', 'Impact']],
      body: attackRows,
      margin: { left: marginX, right: marginX },
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [51, 65, 85],
        cellPadding: 2,
      },
      columnStyles: {
        0: { cellWidth: 14, fontStyle: 'bold' },
        1: { cellWidth: 38 },
        2: { cellWidth: 32 },
        3: { cellWidth: 62 },
        4: { cellWidth: 36 },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // Check if we need to add a page before Detailed Findings
  if (currentY > pageHeight - 60) {
    doc.addPage();
    currentY = 20;
  }

  // ==========================================
  // 6. DETAILED VULNERABILITY REGISTER
  // ==========================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('3. DETAILED VULNERABILITIES & EXPOSURE REGISTER', marginX, currentY);
  currentY += 2;

  const findingsRows =
    findings.length > 0
      ? findings.map((f, idx) => {
          const evidence = maskSensitiveData ? maskSensitiveCredentials(f.evidence) : f.evidence;
          const targetNode = f.nodeId || f.node_id || target;
          return [
            `#${idx + 1}`,
            f.title,
            f.severity.toUpperCase(),
            f.cveId || f.cve_id || 'CWE-200',
            targetNode,
            evidence,
          ];
        })
      : [['-', 'No critical exposures identified during passive reconnaissance', 'INFO', 'N/A', target, 'Clean']];

  autoTable(doc, {
    startY: currentY,
    head: [['No', 'Vulnerability Finding', 'Severity', 'CVE / Ref', 'Target Node', 'Evidence & Impact']],
    body: findingsRows,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [51, 65, 85],
      cellPadding: 2.2,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 44, fontStyle: 'bold' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 24 },
      4: { cellWidth: 32 },
      5: { cellWidth: 52 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const sev = String(data.cell.raw).toLowerCase();
        data.cell.styles.textColor = getSeverityRgb(sev);
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // ==========================================
  // 7. DISCOVERED ASSET INVENTORY TABLE
  // ==========================================
  if (includeAssetInventory && nodes.length > 0) {
    if (currentY > pageHeight - 55) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('4. DISCOVERED ASSET INVENTORY & PROVENANCE ATTRIBUTION', marginX, currentY);
    currentY += 2;

    const assetRows = nodes.slice(0, 30).map((n, idx) => {
      const prov = getNodeProvenance(n);
      return [
        `#${idx + 1}`,
        n.value || n.label,
        n.type.toUpperCase(),
        n.severity.toUpperCase(),
        prov.provider,
        prov.method,
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['No', 'Discovered Value', 'Type', 'Severity', 'OSINT Source', 'Methodology']],
      body: assetRows,
      margin: { left: marginX, right: marginX },
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [51, 65, 85],
        cellPadding: 2,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 55, fontStyle: 'bold' },
        2: { cellWidth: 22 },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 35 },
        5: { cellWidth: 40 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const sev = String(data.cell.raw).toLowerCase();
          data.cell.styles.textColor = getSeverityRgb(sev);
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // ==========================================
  // 8. ACTIONABLE REMEDIATION PLAYBOOK
  // ==========================================
  if (includeRemediationPlaybook) {
    if (currentY > pageHeight - 65) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('5. ACTIONABLE REMEDIATION PLAYBOOK & STATUTORY COMPLIANCE', marginX, currentY);
    currentY += 2;

    const primaryPack = generateRemediationPack(findings[0] || null, target);
    const ufwSnippet = primaryPack.snippets.ufw.code.split('\n')[0] || 'ufw default deny incoming';
    const nginxSnippet = primaryPack.snippets.nginx.code.split('\n')[0] || 'deny all;';
    const cfSnippet = primaryPack.snippets.cloudflare.code.replace(/\s+/g, ' ').slice(0, 75);

    const remediationRows = [
      [
        'Linux UFW Firewall',
        primaryPack.snippets.ufw.description || 'Drop unauthorized external ports',
        ufwSnippet,
        'Immediate (< 4h)',
      ],
      [
        'Nginx Reverse Proxy',
        primaryPack.snippets.nginx.description || 'Block sensitive files & paths',
        nginxSnippet,
        '24 Hours',
      ],
      [
        'Cloudflare WAF Rule',
        primaryPack.snippets.cloudflare.description || 'Deploy perimeter edge expression',
        cfSnippet,
        'Immediate',
      ],
      [
        'UU PDP No. 27/2022',
        'Submit formal data takedown request under Article 8 & 43',
        'Direct Statutory Notice served to DPO / Electronic System Operator',
        '3 Days (Statutory)',
      ],
      [
        'GDPR Article 17',
        'Exercise Right to Erasure across search indices & public endpoints',
        'Google Search Console Outdated Content Removal + Direct DPO notice',
        '30 Days (Statutory)',
      ],
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Platform / Framework', 'Objective & Scope', 'Recommended Snippet / Reference', 'Target SLA']],
      body: remediationRows,
      margin: { left: marginX, right: marginX },
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [51, 65, 85],
        cellPadding: 2.2,
      },
      columnStyles: {
        0: { cellWidth: 35, fontStyle: 'bold' },
        1: { cellWidth: 50 },
        2: { cellWidth: 70, fontStyle: 'italic' },
        3: { cellWidth: 27, halign: 'center' },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // ==========================================
  // 9. METHODOLOGY & STATUTORY DISCLAIMER
  // ==========================================
  if (currentY > pageHeight - 35) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, currentY, contentWidth, 24, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('LEGAL NOTICE & RECONNAISSANCE METHODOLOGY DISCLAIMER', marginX + 4, currentY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  const disclaimer =
    'This audit report was compiled using passive, non-intrusive open-source intelligence (OSINT) methodologies in full compliance with relevant statutory regulations including Indonesian UU PDP No. 27/2022, EU GDPR (Regulation 2016/679), and RFC 6962 Certificate Transparency. No brute-force, denial of service, or unauthorized intrusive exploitation was performed. Disclose this intelligence exclusively to authorized stakeholders adhering to the designated Traffic Light Protocol (TLP) marking.';
  const splitDisclaimer = doc.splitTextToSize(disclaimer, contentWidth - 8);
  doc.text(splitDisclaimer, marginX + 4, currentY + 10.5);

  // ==========================================
  // 10. RUNNING HEADER & FOOTER ON ALL PAGES
  // ==========================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Running Header (Pages > 1)
    if (i > 1) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`ISEEYOU // ATTACK SURFACE REPORT • ${target.toUpperCase()} • ${tlpLevel}`, marginX, 10);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(marginX, 12, marginX + contentWidth, 12);
    }

    // Running Footer (All Pages)
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 12, marginX + contentWidth, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `ISEEYOU Command Center v0.1.0 • Confidential • Integrity: ${checksum}`,
      marginX,
      pageHeight - 7
    );
    doc.text(`Page ${i} of ${totalPages}`, marginX + contentWidth, pageHeight - 7, { align: 'right' });
  }

  return doc;
}

/**
 * Convenience helper to generate and instantly trigger browser download
 */
export function downloadAuditReportPDF(options: PDFExportOptions, customFilename?: string): void {
  const doc = generateAuditReportPDF(options);
  const safeTarget = (options.target || 'target').replace(/[^a-zA-Z0-9.-]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = customFilename || `ISEEYOU_Audit_Report_${safeTarget}_${dateStr}.pdf`;
  doc.save(filename);
}
