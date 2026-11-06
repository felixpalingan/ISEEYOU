export type LegalJurisdiction = 'uupdp' | 'gdpr' | 'dmca';

export interface LegalTakedownParams {
  subjectName: string;
  subjectEmail: string;
  subjectPhone?: string;
  controllerName: string;
  controllerEmail: string;
  target: string;
  exposedDataItems: string[];
  evidenceUrls: string[];
  customNotes?: string;
}

export interface LegalTakedownResult {
  jurisdiction: LegalJurisdiction;
  title: string;
  governingLaw: string;
  statutoryDeadline: string;
  subjectHeader: string;
  letterBody: string;
  googleDeindexUrl: string;
  bingDeindexUrl: string;
  mailtoUrl: string;
}

export const OFFICIAL_REMOVAL_RESOURCES = {
  googlePiiRemoval: 'https://support.google.com/websearch/troubleshooter/3111061',
  googleOutdatedContent: 'https://search.google.com/search-console/remove-outdated-content',
  bingContentRemoval: 'https://www.bing.com/webmasters/contentremoval',
  waybackExclusion: 'https://archive.org/about/exclude.php',
};

/**
 * Generates official legal takedown notices compliant with:
 * 1. UU Pelindungan Data Pribadi (UU PDP No. 27 Tahun 2022 - Indonesia)
 * 2. General Data Protection Regulation (GDPR Article 17 - European Union)
 * 3. DMCA & Trade Secret Infringement Notification (17 U.S.C. § 512)
 */
export function generateTakedownDraft(
  jurisdiction: LegalJurisdiction,
  params: LegalTakedownParams
): LegalTakedownResult {
  const currentDate = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const currentDateEn = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const exposedListId = params.exposedDataItems.length > 0
    ? params.exposedDataItems.map((item, idx) => `  ${idx + 1}. ${item}`).join('\n')
    : `  1. Kredensial dan data identitas yang terafiliasi dengan target: ${params.target}`;

  const exposedListEn = params.exposedDataItems.length > 0
    ? params.exposedDataItems.map((item, idx) => `  ${idx + 1}. ${item}`).join('\n')
    : `  1. Exposed credentials and personal identifiers affiliated with target: ${params.target}`;

  const evidenceList = params.evidenceUrls.length > 0
    ? params.evidenceUrls.map((url) => `  - ${url}`).join('\n')
    : `  - https://${params.target}`;

  if (jurisdiction === 'uupdp') {
    const subjectHeader = `PERMOHONAN PENGHAPUSAN DAN PEMUSNAHAN DATA PRIBADI - UU PDP NO. 27/2022 (Ref: ${params.target})`;
    const letterBody = `Nomor       : LAW/PDP/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}
Lampiran    : 1 (satu) Berkas Bukti Temuan Reconnaissance
Perihal     : Permohonan Penghapusan dan Pemusnahan Data Pribadi Berdasarkan 
              Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)

Tanggal     : ${currentDate}

Kepada Yth.
Pejabat Pelindung Data Pribadi (Data Protection Officer / DPO) / Pimpinan Manajemen
${params.controllerName || 'Pengendali Data Pribadi'}
Alamat / Email: ${params.controllerEmail || 'dpo@' + params.target}

Dengan hormat,

Saya yang bertanda tangan di bawah ini:
Nama Lengkap      : ${params.subjectName || '[Nama Pemohon / Subjek Data]'}
Email / Kontak    : ${params.subjectEmail || '[Email Pemohon]'} ${params.subjectPhone ? `| Telp: ${params.subjectPhone}` : ''}
Kapasitas Hukum   : Subjek Data Pribadi (Data Subject)

Berdasarkan hasil pemantauan Attack Surface Management platform ISEEYOU terhadap domain/aset '${params.target}', ditemukan bahwa Data Pribadi milik saya/organisasi kami telah terpublikasi, bocor, atau dapat diakses secara tanpa hak pada sistem dan/atau jaringan publik di bawah pengawasan Saudara.

Rincian Data Pribadi yang Terpapar:
${exposedListId}

Tautan / Bukti Publikasi Tanpa Hak:
${evidenceList}

DASAR HUKUM DAN TUNTUTAN HUKUM:
1. Pasal 8 Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP):
   "Subjek Data Pribadi berhak mengakhiri pemrosesan, menghapus, dan/atau memusnahkan Data Pribadi tentang dirinya sesuai dengan ketentuan peraturan perundang-undangan."
2. Pasal 43 ayat (1) UU PDP:
   "Pengendali Data Pribadi wajib menghapus Data Pribadi dalam hal: Subjek Data Pribadi telah menarik kembali persetujuan pemrosesan Data Pribadi; atau Data Pribadi telah diperoleh dan/atau diproses secara melawan hukum."
3. Pasal 44 UU PDP:
   "Pengendali Data Pribadi wajib memusnahkan Data Pribadi dalam hal telah habis masa retensinya atau atas permintaan Subjek Data Pribadi."

TUNTUTAN TINDAKAN:
Sehubungan dengan hal tersebut di atas, kami meminta Pengendali Data Pribadi untuk:
1. Menghapus, mencabut, dan memusnahkan seluruh rekaman data pribadi tersebut di atas dari server publik, basis data, cache, repositori git, serta indeks mesin pencari Saudara.
2. Menghentikan segala bentuk pemrosesan, penyebarluasan, atau komersialisasi lanjutan atas data pribadi tersebut.
3. Memberikan konfirmasi tertulis secara resmi kepada kami paling lambat 3 x 24 jam (tiga hari kerja) kalender sejak diterimanya surat permohonan ini, sebagaimana diamanatkan dalam standar kepatuhan UU PDP.

Apabila dalam batas waktu tersebut di atas Saudara mengabaikan atau tidak memenuhi kewajiban pelindungan data ini, kami akan meneruskan laporan resmi dugaan pelanggaran pelindungan data pribadi kepada Lembaga Pengawas Pelindungan Data Pribadi Republik Indonesia dan instansi penegak hukum terkait, yang dapat mengenakan sanksi administratif (Pasal 57 UU PDP) berupa ganti rugi perdata dan/atau denda administratif hingga 2% dari pendapatan tahunan.

Demikian permohonan resmi ini kami sampaikan dengan itikad baik untuk diselesaikan secara tertib hukum. Atas perhatian dan kerja sama Saudara, kami ucapkan terima kasih.

Hormat kami,

(Tanda Tangan Digital)

${params.subjectName || '[Nama Pemohon / Subjek Data]'}
Subjek Data Pribadi yang Sah
`;

    const mailtoUrl = `mailto:${encodeURIComponent(params.controllerEmail || 'privacy@' + params.target)}?subject=${encodeURIComponent(subjectHeader)}&body=${encodeURIComponent(letterBody)}`;

    return {
      jurisdiction: 'uupdp',
      title: 'Permohonan Hapus Data Pribadi (UU PDP No. 27/2022)',
      governingLaw: 'UU Republik Indonesia No. 27 Tahun 2022 tentang Pelindungan Data Pribadi',
      statutoryDeadline: 'Maksimal 3 x 24 Jam Kerja (Pasal 43 UU PDP)',
      subjectHeader,
      letterBody,
      googleDeindexUrl: OFFICIAL_REMOVAL_RESOURCES.googlePiiRemoval,
      bingDeindexUrl: OFFICIAL_REMOVAL_RESOURCES.bingContentRemoval,
      mailtoUrl,
    };
  }

  if (jurisdiction === 'gdpr') {
    const subjectHeader = `GDPR ARTICLE 17 RIGHT TO ERASURE (REQUEST TO BE FORGOTTEN) - Ref: ${params.target}`;
    const letterBody = `FORMAL NOTICE OF RIGHT TO ERASURE UNDER GDPR ARTICLE 17
Date: ${currentDateEn}

To:
Data Protection Officer / Legal Counsel
${params.controllerName || 'Data Controller'}
Email: ${params.controllerEmail || 'dpo@' + params.target}

Dear Data Protection Officer,

I am writing to formally exercise my Right to Erasure (Right to be Forgotten) pursuant to Article 17 of the General Data Protection Regulation (Regulation (EU) 2016/679 - GDPR).

DATA SUBJECT INFORMATION:
Name: ${params.subjectName || '[Full Name]'}
Contact Email: ${params.subjectEmail || '[Email Address]'}

STATEMENT OF CLAIM & EXPOSED DATA:
Through external cybersecurity attack surface reconnaissance performed via ISEEYOU, personal identifiers and credentials originating from/affiliated with '${params.target}' are currently exposed without legal basis under GDPR Article 6:

Exposed Personal Data Categories:
${exposedListEn}

Evidence / Location URLs:
${evidenceList}

STATUTORY GROUNDS (GDPR Article 17(1)):
1. The personal data is no longer necessary in relation to the purposes for which it was originally collected (Art. 17(1)(a)).
2. I hereby withdraw any and all explicit consent on which the processing may have been based (Art. 17(1)(b)).
3. The personal data has been unlawfully processed and publicly exposed in breach of security obligations under Article 32 GDPR (Art. 17(1)(d)).

ACTIONS REQUIRED:
1. Erase all instances of the specified personal data from your active production databases, backup archives, public search caches, and logs without undue delay.
2. In accordance with Article 19 GDPR, notify any third-party processors, search engine indexing bots, or recipients to whom the personal data has been disclosed of this erasure request.
3. Provide formal confirmation of complete erasure within one calendar month of receipt of this notice, as prescribed under GDPR Article 12(3).

Failure to comply with this statutory request may result in a formal complaint lodged with the competent European Supervisory Authority (Data Protection Authority), which holds enforcement powers under Article 83 GDPR (administrative fines up to €20,000,000 or 4% of total worldwide annual turnover).

Yours sincerely,

${params.subjectName || '[Full Name]'}
Data Subject
`;

    const mailtoUrl = `mailto:${encodeURIComponent(params.controllerEmail || 'dpo@' + params.target)}?subject=${encodeURIComponent(subjectHeader)}&body=${encodeURIComponent(letterBody)}`;

    return {
      jurisdiction: 'gdpr',
      title: 'GDPR Article 17 Right to Erasure Notice',
      governingLaw: 'Regulation (EU) 2016/679 (General Data Protection Regulation)',
      statutoryDeadline: 'Within 1 Calendar Month (Article 12(3) GDPR)',
      subjectHeader,
      letterBody,
      googleDeindexUrl: OFFICIAL_REMOVAL_RESOURCES.googlePiiRemoval,
      bingDeindexUrl: OFFICIAL_REMOVAL_RESOURCES.bingContentRemoval,
      mailtoUrl,
    };
  }

  // DMCA / Trade Secret & Credential Leak Notice
  const subjectHeader = `NOTICE OF UNLICENSED CREDENTIAL & ASSET LEAK (17 U.S.C. § 512) - Ref: ${params.target}`;
  const letterBody = `DMCA TAKEDOWN NOTICE & UNLICENSED ASSET REMOVAL REQUEST
Date: ${currentDateEn}

To Designated Copyright & Abuse Agent:
${params.controllerName || 'Platform Operator'}
Contact: ${params.controllerEmail || 'abuse@' + params.target}

Dear Abuse / Legal Agent,

This letter serves as formal notification pursuant to 17 U.S.C. Section 512(c) and the Computer Fraud and Abuse Act (CFAA) that proprietary credentials, source tokens, or copyrighted intellectual property belonging to our organization have been publicly posted on services under your operational control.

1. IDENTIFICATION OF EXPOSED PROPRIETARY ASSETS:
${exposedListEn}

2. LOCATION OF INFRINGING MATERIAL:
${evidenceList}

3. CONTACT INFORMATION OF CLAIMANT:
Name: ${params.subjectName || '[Claimant Name / Authorized Agent]'}
Email: ${params.subjectEmail || '[Claimant Email]'}
Target Domain: ${params.target}

4. GOOD FAITH STATEMENT:
I have a good faith belief that the use and public disclosure of the proprietary material identified above is not authorized by the copyright owner, its agent, or the law.

5. ACCURACY STATEMENT:
The information in this notification is accurate. Under penalty of perjury, I confirm that I am the owner or an agent authorized to act on behalf of the owner of an exclusive right that is infringed.

Please remove or disable access to the infringing material expeditiously upon receipt of this notice.

Sincerely,

${params.subjectName || '[Claimant Name]'}
Authorized Cybersecurity & Incident Response Representative
`;

  const mailtoUrl = `mailto:${encodeURIComponent(params.controllerEmail || 'abuse@' + params.target)}?subject=${encodeURIComponent(subjectHeader)}&body=${encodeURIComponent(letterBody)}`;

  return {
    jurisdiction: 'dmca',
    title: 'DMCA & Proprietary Asset Removal Notice',
    governingLaw: '17 U.S.C. § 512(c) / Digital Millennium Copyright Act',
    statutoryDeadline: 'Expeditious Removal upon Receipt',
    subjectHeader,
    letterBody,
    googleDeindexUrl: OFFICIAL_REMOVAL_RESOURCES.googleOutdatedContent,
    bingDeindexUrl: OFFICIAL_REMOVAL_RESOURCES.bingContentRemoval,
    mailtoUrl,
  };
}
