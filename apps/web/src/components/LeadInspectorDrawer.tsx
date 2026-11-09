'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Search,
  Sparkles,
  KeyRound,
  Pin,
  ExternalLink,
  Check,
  Copy,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  StickyNote,
  Play,
  Users,
  Mail,
  Globe,
  ShieldAlert,
  Camera,
  Crosshair,
  Radar,
  Fingerprint,
  Languages,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  EntityNode,
  EntityType,
  NodeConfidence,
  TargetDossier,
  AIAnalysisReport,
  AIConfig,
  AIProviderType,
} from '@iseeyou/shared-types';

export type InspectorDrawerTab = 'node' | 'dorks' | 'ai' | 'pin';

export type DorkLanguage = 'en' | 'id' | 'dual' | 'es' | 'de' | 'fr';

export interface DorkLanguageOption {
  id: DorkLanguage;
  label: string;
  flag: string;
  region: string;
}

export const DORK_LANGUAGES: DorkLanguageOption[] = [
  { id: 'en', label: 'English', flag: '🌐', region: 'Global / US / UK' },
  { id: 'id', label: 'Indonesia', flag: '🇮🇩', region: 'ID (.id / Kemdikbud)' },
  { id: 'dual', label: 'Global + ID', flag: '🌍', region: 'Dual / Bilingual' },
  { id: 'es', label: 'Español', flag: '🇪🇸', region: 'ES / LATAM' },
  { id: 'de', label: 'Deutsch', flag: '🇩🇪', region: 'DE / AT / CH' },
  { id: 'fr', label: 'Français', flag: '🇫🇷', region: 'FR / BE / CA' },
];

export function detectInitialDorkLanguage(target: string, locations?: string[]): DorkLanguage {
  const t = (target || '').toLowerCase().trim();
  const locs = (locations || []).join(' ').toLowerCase();

  // Indonesian signals
  if (
    t.endsWith('.id') ||
    t.includes('.ac.id') ||
    t.includes('.go.id') ||
    locs.includes('indonesia') ||
    locs.includes('jakarta') ||
    locs.includes('bali') ||
    locs.includes('surabaya') ||
    locs.includes('bandung') ||
    locs.includes('yogyakarta') ||
    locs.includes('medan') ||
    locs.includes('semarang')
  ) {
    return 'id';
  }

  // Spanish signals
  if (
    t.endsWith('.es') ||
    locs.includes('spain') ||
    locs.includes('españa') ||
    locs.includes('mexico') ||
    locs.includes('colombia') ||
    locs.includes('argentina')
  ) {
    return 'es';
  }

  // German signals
  if (
    t.endsWith('.de') ||
    t.endsWith('.at') ||
    t.endsWith('.ch') ||
    locs.includes('germany') ||
    locs.includes('deutschland') ||
    locs.includes('austria') ||
    locs.includes('switzerland')
  ) {
    return 'de';
  }

  // French signals
  if (
    t.endsWith('.fr') ||
    locs.includes('france') ||
    locs.includes('paris') ||
    locs.includes('quebec') ||
    locs.includes('belgium')
  ) {
    return 'fr';
  }

  return 'en';
}

interface LeadInspectorDrawerProps {
  isOpen: boolean;
  activeTab: InspectorDrawerTab;
  onTabChange: (tab: InspectorDrawerTab) => void;
  onClose: () => void;
  selectedNode: EntityNode | null;
  target: string;
  targetType: EntityType;
  dossier: TargetDossier;
  isScanning: boolean;
  onRunModuleOnNode: (node: EntityNode | null, moduleIds: string[]) => void;
  onPivotLead: (value: string, type: EntityType, modules?: string[], parentNodeId?: string) => void;
  onUpdateNodeAnnotation: (
    nodeId: string,
    updates: { confidence?: NodeConfidence; investigatorNotes?: string }
  ) => void;
  onAddManualLead: (
    type: EntityType,
    value: string,
    label?: string,
    parentNodeId?: string,
    notes?: string
  ) => void;
  aiReport: AIAnalysisReport | null;
  isAIAnalyzing: boolean;
  aiConfig: AIConfig;
  onUpdateAiConfig: (cfg: AIConfig) => void;
  onRunAIAnalysis: (overrideCfg?: AIConfig) => void;
}

export function LeadInspectorDrawer({
  isOpen,
  activeTab,
  onTabChange,
  onClose,
  selectedNode,
  target,
  dossier,
  isScanning,
  onRunModuleOnNode,
  onPivotLead,
  onUpdateNodeAnnotation,
  onAddManualLead,
  aiReport,
  isAIAnalyzing,
  aiConfig,
  onUpdateAiConfig,
  onRunAIAnalysis,
}: LeadInspectorDrawerProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Manual Pin Clue Form State
  const [pinType, setPinType] = useState<EntityType>('username');
  const [pinValue, setPinValue] = useState('');
  const [pinLabel, setPinLabel] = useState('');
  const [pinNotes, setPinNotes] = useState('');

  // Custom Dork Handle Override
  const [customDorkHandle, setCustomDorkHandle] = useState('');

  // Target Dork Language Override (Supports EN, ID, Dual, ES, DE, FR)
  const [dorkLanguage, setDorkLanguage] = useState<DorkLanguage>(() =>
    detectInitialDorkLanguage(target, dossier.locations)
  );
  const hasUserSelectedLang = useRef(false);

  useEffect(() => {
    if (!hasUserSelectedLang.current) {
      setDorkLanguage(detectInitialDorkLanguage(target, dossier.locations));
    }
  }, [target, dossier.locations]);

  // BYOK AI Settings Local State
  const [showByokForm, setShowByokForm] = useState(false);

  // Active handle & name for Tactical Dork Matrix
  const activeHandle = useMemo(() => {
    if (customDorkHandle.trim()) return customDorkHandle.trim().replace(/^@/, '');
    if (selectedNode) {
      const h = selectedNode.metadata?.handle;
      if (typeof h === 'string' && h.trim()) return h.trim().replace(/^@/, '');
      if (selectedNode.type === 'username' || selectedNode.type === 'associate') {
        if (!selectedNode.value.startsWith('http')) return selectedNode.value.replace(/^@/, '');
      }
    }
    return dossier.handles[0] || target.split('@')[0].replace(/^@/, '');
  }, [customDorkHandle, selectedNode, dossier.handles, target]);

  const activeFullName = useMemo(() => {
    if (selectedNode) {
      if (typeof selectedNode.metadata?.full_name === 'string' && selectedNode.metadata.full_name.trim()) {
        return selectedNode.metadata.full_name.trim();
      }
      if (
        (selectedNode.type === 'username' || selectedNode.type === 'associate') &&
        selectedNode.value.trim().includes(' ') &&
        !selectedNode.value.startsWith('http')
      ) {
        return selectedNode.value.trim();
      }
    }
    if (dossier.fullNames[0]) return dossier.fullNames[0];
    if (target.trim().includes(' ') && !target.includes('@')) return target.trim();
    return '';
  }, [selectedNode, dossier.fullNames, target]);

  const activeNameTokens = useMemo(() => {
    const raw = activeFullName.trim();
    if (!raw) return { firstName: '', surname: '', shortName: '' };
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return { firstName: parts[0], surname: parts[0], shortName: parts[0] };
    }
    const firstName = parts[0];
    const surname =
      (selectedNode && typeof selectedNode.metadata?.surname === 'string' && selectedNode.metadata.surname) ||
      parts[parts.length - 1];
    const shortName =
      parts.length >= 3 ? `${parts[parts.length - 2]} ${surname}` : `${firstName} ${surname}`;
    return { firstName, surname, shortName };
  }, [activeFullName, selectedNode]);

  const activeOrg = useMemo(() => {
    if (selectedNode) {
      if (typeof selectedNode.metadata?.company === 'string' && selectedNode.metadata.company.trim()) {
        return selectedNode.metadata.company.trim();
      }
      if (selectedNode.type === 'organization' && selectedNode.value.trim()) {
        return selectedNode.value.trim();
      }
    }
    return dossier.organizations[0] || '';
  }, [selectedNode, dossier.organizations]);

  // Built-in Tactical Google Dorks (14 Formulas: Family/Clan Surname, Jabatan/Career, PDDIKTI/Kampus, Official SK/CV, & Private Social Bypass)
  const tacticalDorks = useMemo(() => {
    const h = activeHandle;
    const nm = activeFullName || h;
    const { firstName, surname, shortName } = activeNameTokens;
    const fam = surname || h;
    const org = activeOrg;
    const em = dossier.emails[0] || '';
    const nameOrShort =
      activeFullName && shortName && shortName.toLowerCase() !== activeFullName.toLowerCase()
        ? `"${activeFullName}" OR "${shortName}"`
        : `"${nm}"`;

    // 1. Family, Surname & Clan Lineage
    let familyClan: { category: string; title: string; query: string; desc: string };
    if (dorkLanguage === 'id') {
      familyClan = {
        category: 'Family, Surname & Clan Lineage (Keluarga & Marga)',
        title: `Family & Relatives Sharing Surname ("${fam}")`,
        query:
          firstName && fam.toLowerCase() !== firstName.toLowerCase()
            ? `"${fam}" -"${firstName}" (site:linkedin.com/in/ OR site:instagram.com OR site:facebook.com OR site:ac.id OR site:go.id OR filetype:pdf)`
            : `"${fam}" (intext:"keluarga" OR intext:"marga" OR site:linkedin.com/in/ OR site:facebook.com)`,
        desc: 'Hunts parents, siblings, and relatives sharing the same family surname/clan across LinkedIn, social media, universities, and public PDFs.',
      };
    } else if (dorkLanguage === 'dual') {
      familyClan = {
        category: 'Family, Surname & Clan Lineage (Global & Indonesia)',
        title: `Family & Relatives Sharing Surname ("${fam}")`,
        query:
          firstName && fam.toLowerCase() !== firstName.toLowerCase()
            ? `"${fam}" -"${firstName}" (site:linkedin.com/in/ OR site:instagram.com OR site:facebook.com OR site:ac.id OR site:go.id OR filetype:pdf)`
            : `"${fam}" (intext:"keluarga" OR intext:"marga" OR intext:"family" OR intext:"relatives" OR site:linkedin.com/in/ OR site:facebook.com)`,
        desc: 'Combines Indonesian clan/marga keywords and global family surnames across social networks and institutional portals.',
      };
    } else if (dorkLanguage === 'es') {
      familyClan = {
        category: 'Linaje Familiar, Apellidos y Parentesco',
        title: `Familiares y Parientes con Apellido ("${fam}")`,
        query:
          firstName && fam.toLowerCase() !== firstName.toLowerCase()
            ? `"${fam}" -"${firstName}" (site:linkedin.com/in/ OR site:instagram.com OR site:facebook.com OR site:es OR filetype:pdf)`
            : `"${fam}" (intext:"familia" OR intext:"apellido" OR intext:"parientes" OR site:linkedin.com/in/ OR site:facebook.com)`,
        desc: 'Rastrea padres, hermanos y parientes que comparten el mismo apellido en redes sociales y registros públicos.',
      };
    } else if (dorkLanguage === 'de') {
      familyClan = {
        category: 'Familienherkunft, Nachname & Verwandtschaft',
        title: `Familienangehörige mit Nachname ("${fam}")`,
        query:
          firstName && fam.toLowerCase() !== firstName.toLowerCase()
            ? `"${fam}" -"${firstName}" (site:linkedin.com/in/ OR site:instagram.com OR site:facebook.com OR site:de OR filetype:pdf)`
            : `"${fam}" (intext:"Familie" OR intext:"Nachname" OR intext:"Verwandte" OR site:linkedin.com/in/ OR site:facebook.com)`,
        desc: 'Sucht nach Eltern, Geschwistern und Verwandten mit demselben Nachnamen auf LinkedIn, sozialen Netzwerken und PDFs.',
      };
    } else if (dorkLanguage === 'fr') {
      familyClan = {
        category: 'Lignée Familiale, Nom de Famille & Proches',
        title: `Famille & Proches Partageant le Nom ("${fam}")`,
        query:
          firstName && fam.toLowerCase() !== firstName.toLowerCase()
            ? `"${fam}" -"${firstName}" (site:linkedin.com/in/ OR site:instagram.com OR site:facebook.com OR site:fr OR filetype:pdf)`
            : `"${fam}" (intext:"famille" OR intext:"nom de famille" OR intext:"proches" OR site:linkedin.com/in/ OR site:facebook.com)`,
        desc: 'Recherche les parents, frères et sœurs et proches partageant le nom de famille sur les réseaux sociaux et registres publics.',
      };
    } else {
      familyClan = {
        category: 'Family, Surname & Clan Lineage',
        title: `Family & Relatives Sharing Surname ("${fam}")`,
        query:
          firstName && fam.toLowerCase() !== firstName.toLowerCase()
            ? `"${fam}" -"${firstName}" (site:linkedin.com/in/ OR site:instagram.com OR site:facebook.com OR site:twitter.com OR site:x.com OR filetype:pdf)`
            : `"${fam}" (intext:"family" OR intext:"relatives" OR intext:"clan" OR site:linkedin.com/in/ OR site:facebook.com)`,
        desc: 'Hunts parents, siblings, and relatives sharing the same family surname/clan across LinkedIn, social media, and public records.',
      };
    }

    // 2. Parents, Siblings, Graduation Books & Civil Lineage
    let familyGraduation: { category: string; title: string; query: string; desc: string };
    if (dorkLanguage === 'id') {
      familyGraduation = {
        category: 'Family, Surname & Clan Lineage (Keluarga & Marga)',
        title: 'Parents, Siblings, Graduation Books & Civil Lineage',
        query: `(${nameOrShort} OR "${fam}") (intext:"anak dari" OR intext:"putra dari" OR intext:"putri dari" OR intext:"bin" OR intext:"binti" OR intext:"suami" OR intext:"istri" OR intext:"wisuda")`,
        desc: 'Uncovers parent names (putra/putri dari, bin/binti), spouse mentions, university graduation books (buku wisuda), and family announcements.',
      };
    } else if (dorkLanguage === 'dual') {
      familyGraduation = {
        category: 'Family, Surname & Clan Lineage (Global & Indonesia)',
        title: 'Parents, Siblings, Graduation Books & Civil Lineage',
        query: `(${nameOrShort} OR "${fam}") (intext:"anak dari" OR intext:"putra dari" OR intext:"son of" OR intext:"daughter of" OR intext:"bin" OR intext:"binti" OR intext:"suami" OR intext:"istri" OR intext:"spouse" OR intext:"wisuda" OR intext:"commencement")`,
        desc: 'Cross-searches bilingual parental lineage, graduation lists (wisuda/commencement), and spouse relationships.',
      };
    } else if (dorkLanguage === 'es') {
      familyGraduation = {
        category: 'Linaje Familiar, Apellidos y Parentesco',
        title: 'Padres, Cónyuge, Graduaciones y Parentesco Civil',
        query: `(${nameOrShort} OR "${fam}") (intext:"hijo de" OR intext:"hija de" OR intext:"padre" OR intext:"madre" OR intext:"esposo" OR intext:"esposa" OR intext:"graduación" OR intext:"orla")`,
        desc: 'Descubre nombres de padres (hijo/hija de), cónyuge, orlas y listas de graduación universitaria.',
      };
    } else if (dorkLanguage === 'de') {
      familyGraduation = {
        category: 'Familienherkunft, Nachname & Verwandtschaft',
        title: 'Eltern, Ehepartner, Abschlusslisten & Abstammung',
        query: `(${nameOrShort} OR "${fam}") (intext:"Sohn von" OR intext:"Tochter von" OR intext:"Vater" OR intext:"Mutter" OR intext:"Ehemann" OR intext:"Ehefrau" OR intext:"Abschluss" OR intext:"Jahrbuch")`,
        desc: 'Findet Elternnamen (Sohn/Tochter von), Ehepartner, Jahrbücher und universitäre Abschlussberichte.',
      };
    } else if (dorkLanguage === 'fr') {
      familyGraduation = {
        category: 'Lignée Familiale, Nom de Famille & Proches',
        title: 'Parents, Conjoint, Promotions & Lignée Civile',
        query: `(${nameOrShort} OR "${fam}") (intext:"fils de" OR intext:"fille de" OR intext:"père" OR intext:"mère" OR intext:"époux" OR intext:"épouse" OR intext:"promotion" OR intext:"annuaire")`,
        desc: 'Identifie les noms des parents (fils/fille de), conjoint, annuaires d\'anciens élèves et avis civils.',
      };
    } else {
      familyGraduation = {
        category: 'Family, Surname & Clan Lineage',
        title: 'Parents, Siblings, Commencement Books & Civil Lineage',
        query: `(${nameOrShort} OR "${fam}") (intext:"son of" OR intext:"daughter of" OR intext:"father" OR intext:"mother" OR intext:"spouse" OR intext:"husband" OR intext:"wife" OR intext:"commencement" OR intext:"yearbook" OR intext:"obituary")`,
        desc: 'Uncovers parent names (son/daughter of), spouse mentions, university commencement books, yearbooks, and family obituaries.',
      };
    }

    // 3. Career, Positions & Executive Roles
    let careerJabatan: { category: string; title: string; query: string; desc: string };
    if (dorkLanguage === 'id') {
      careerJabatan = {
        category: 'Career, Jabatan & Executive Roles',
        title: 'Jabatan, Structural Position, PT/CV & Organization Role',
        query: `(${nameOrShort})${org ? ` "${org}"` : ''} (intext:"Jabatan" OR intext:"Direktur" OR intext:"Komisaris" OR intext:"Manager" OR intext:"Ketua" OR intext:"Divisi" OR intext:"Pengurus" OR intext:"Staff")`,
        desc: 'Pinpoints job titles, organizational committee roles, corporate directorships (AHU/PT/CV), and structural appointments.',
      };
    } else if (dorkLanguage === 'dual') {
      careerJabatan = {
        category: 'Career, Positions & Executive Roles',
        title: 'Jabatan, Structural Position, Executive Roles & Organization Role',
        query: `(${nameOrShort})${org ? ` "${org}"` : ''} (intext:"Jabatan" OR intext:"Direktur" OR intext:"Director" OR intext:"Komisaris" OR intext:"Manager" OR intext:"CEO" OR intext:"Founder" OR intext:"Ketua" OR intext:"Head of")`,
        desc: 'Cross-matches bilingual corporate titles, board appointments, and structural organization hierarchy.',
      };
    } else if (dorkLanguage === 'es') {
      careerJabatan = {
        category: 'Carrera Profesional, Cargos y Directivos',
        title: 'Cargo, Puesto Ejecutivo, Consejo y Dirección de Empresa',
        query: `(${nameOrShort})${org ? ` "${org}"` : ''} (intext:"Cargo" OR intext:"Puesto" OR intext:"Director" OR intext:"Gerente" OR intext:"Presidente" OR intext:"Jefe" OR intext:"Fundador" OR intext:"Ejecutivo")`,
        desc: 'Localiza nombramientos directivos, puestos en consejos de administración y cargos organizativos.',
      };
    } else if (dorkLanguage === 'de') {
      careerJabatan = {
        category: 'Beruflicher Werdegang, Positionen & Vorstand',
        title: 'Position, Geschäftsführung, Vorstand & Leitungsfunktionen',
        query: `(${nameOrShort})${org ? ` "${org}"` : ''} (intext:"Position" OR intext:"Geschäftsführer" OR intext:"Vorstand" OR intext:"Direktor" OR intext:"Leiter" OR intext:"Gründer" OR intext:"Bereichsleiter")`,
        desc: 'Ermittelt Führungspositionen, Vorstandsrollen, Geschäftsführer-Einträge und leitende Funktionen.',
      };
    } else if (dorkLanguage === 'fr') {
      careerJabatan = {
        category: 'Parcours Professionnel, Postes & Direction',
        title: 'Poste, Fonction de Direction, Conseil d\'Administration',
        query: `(${nameOrShort})${org ? ` "${org}"` : ''} (intext:"Poste" OR intext:"Directeur" OR intext:"Gérant" OR intext:"Président" OR intext:"Responsable" OR intext:"Fondateur" OR intext:"Chef")`,
        desc: 'Identifie les fonctions de direction, postes au conseil d\'administration et rôles de gestion.',
      };
    } else {
      careerJabatan = {
        category: 'Career, Positions & Executive Roles',
        title: 'Job Title, Executive Roles, Corporate Board & Organization Position',
        query: `(${nameOrShort})${org ? ` "${org}"` : ''} (intext:"Position" OR intext:"Title" OR intext:"Director" OR intext:"Commissioner" OR intext:"Manager" OR intext:"CEO" OR intext:"Founder" OR intext:"Officer" OR intext:"Head of" OR intext:"Executive")`,
        desc: 'Pinpoints job titles, company executive roles (CEO/Director/Officer), board members, and organizational appointments.',
      };
    }

    // 4. Academic, University & Student Records
    let academicCampus: { category: string; title: string; query: string; desc: string };
    if (dorkLanguage === 'id') {
      academicCampus = {
        category: 'Academic, University & PDDIKTI Records',
        title: 'PDDIKTI, University Repository (.ac.id), NIM & Thesis/Skripsi',
        query: `(${nameOrShort} OR "${h}") (site:ac.id OR site:pddikti.kemdikbud.go.id OR intext:"NIM" OR intext:"NPM" OR intext:"Skripsi" OR intext:"Tesis" OR intext:"Program Studi")`,
        desc: 'Searches Indonesian university domains (.ac.id), PDDIKTI student/lecturer records, student IDs (NIM/NPM), and thesis repositories.',
      };
    } else if (dorkLanguage === 'dual') {
      academicCampus = {
        category: 'Academic, University & Student Records',
        title: 'PDDIKTI, University Repositories (.edu / .ac.id), Student ID & Theses',
        query: `(${nameOrShort} OR "${h}") (site:ac.id OR site:edu OR site:pddikti.kemdikbud.go.id OR intext:"NIM" OR intext:"Student ID" OR intext:"Skripsi" OR intext:"Thesis" OR intext:"Dissertation")`,
        desc: 'Searches both Indonesian (.ac.id/PDDIKTI) and global university archives (.edu) for matriculation IDs and dissertations.',
      };
    } else if (dorkLanguage === 'es') {
      academicCampus = {
        category: 'Registros Universitarios y Tesis Académicas',
        title: 'Repositorios Universitarios (.es / .edu), Matrícula y Tesis',
        query: `(${nameOrShort} OR "${h}") (site:es OR site:edu OR intext:"Matrícula" OR intext:"Tesis" OR intext:"Tesina" OR intext:"Facultad" OR intext:"Grado" OR intext:"Licenciatura")`,
        desc: 'Rastrea matrículas universitarias, grados académicos, memorias y repositorios de tesis en español.',
      };
    } else if (dorkLanguage === 'de') {
      academicCampus = {
        category: 'Akademische Archive, Matrikelnummer & Abschlussarbeiten',
        title: 'Universitätsarchive (.de / .at / .ch), Matrikelnummer & Dissertationen',
        query: `(${nameOrShort} OR "${h}") (site:de OR site:at OR site:ch OR intext:"Matrikelnummer" OR intext:"Masterarbeit" OR intext:"Bachelorarbeit" OR intext:"Dissertation" OR intext:"Fakultät")`,
        desc: 'Durchsucht deutschsprachige Universitätsrepositorien nach Matrikelnummern, Abschlussarbeiten und Fakultäten.',
      };
    } else if (dorkLanguage === 'fr') {
      academicCampus = {
        category: 'Registres Universitaires, Numéro Étudiant & Thèses',
        title: 'Dépôts Universitaires (.fr / .univ.fr), Numéro Étudiant & Thèses',
        query: `(${nameOrShort} OR "${h}") (site:fr OR site:univ.fr OR intext:"Numéro étudiant" OR intext:"Thèse" OR intext:"Mémoire" OR intext:"Faculté" OR intext:"Université")`,
        desc: 'Recherche dans les universités françaises (.univ.fr) les thèses, mémoires, facultés et numéros étudiants.',
      };
    } else {
      academicCampus = {
        category: 'Academic, University & Student Records',
        title: 'University Repositories (.edu / .ac.uk), Student ID, Thesis & Dissertation',
        query: `(${nameOrShort} OR "${h}") (site:edu OR site:ac.uk OR intext:"Student ID" OR intext:"Thesis" OR intext:"Dissertation" OR intext:"Department" OR intext:"Major" OR intext:"Alumni")`,
        desc: 'Searches global university domains (.edu, .ac.uk), alumni directories, student IDs, bachelor/master theses, and dissertations.',
      };
    }

    // 5. Academic Research Papers & Advisors
    let academicScholar: { category: string; title: string; query: string; desc: string };
    if (dorkLanguage === 'id') {
      academicScholar = {
        category: 'Academic, University & PDDIKTI Records',
        title: 'Google Scholar, SINTA, Garuda & Thesis Advisors (Dosen Pembimbing)',
        query: `(${nameOrShort} OR "${fam}") (site:scholar.google.com OR site:garuda.kemdikbud.go.id OR site:sinta.kemdikbud.go.id OR intext:"Dosen Pembimbing" OR intext:"Jurusan" OR intext:"Fakultas")`,
        desc: 'Finds academic journals, co-authors, thesis supervisors (dosen pembimbing), and faculty affiliations.',
      };
    } else if (dorkLanguage === 'dual') {
      academicScholar = {
        category: 'Academic, University & Research Papers',
        title: 'Google Scholar, SINTA, ResearchGate & Thesis Advisors',
        query: `(${nameOrShort} OR "${fam}") (site:scholar.google.com OR site:researchgate.net OR site:garuda.kemdikbud.go.id OR intext:"Dosen Pembimbing" OR intext:"Advisor" OR intext:"Co-author")`,
        desc: 'Searches both Indonesian SINTA/Garuda and international Google Scholar / ResearchGate networks.',
      };
    } else if (dorkLanguage === 'es') {
      academicScholar = {
        category: 'Publicaciones Científicas y Directores de Tesis',
        title: 'Google Scholar, Dialnet, ResearchGate y Directores de Tesis',
        query: `(${nameOrShort} OR "${fam}") (site:scholar.google.com OR site:dialnet.unirioja.es OR site:researchgate.net OR intext:"Director de tesis" OR intext:"Coautor" OR intext:"Departamento")`,
        desc: 'Encuentra artículos científicos, coautores y directores de tesis en Google Scholar y Dialnet.',
      };
    } else if (dorkLanguage === 'de') {
      academicScholar = {
        category: 'Wissenschaftliche Publikationen & Betreuer',
        title: 'Google Scholar, ResearchGate, Koautoren & Doktorvater/Betreuer',
        query: `(${nameOrShort} OR "${fam}") (site:scholar.google.com OR site:researchgate.net OR intext:"Doktorvater" OR intext:"Betreuer" OR intext:"Koautor" OR intext:"Institut")`,
        desc: 'Findet wissenschaftliche Aufsätze, Co-Autoren, Doktorväter und Institutspublikationen.',
      };
    } else if (dorkLanguage === 'fr') {
      academicScholar = {
        category: 'Publications Scientifiques & Directeurs de Recherche',
        title: 'Google Scholar, Theses.fr, ResearchGate & Directeurs de Thèse',
        query: `(${nameOrShort} OR "${fam}") (site:scholar.google.com OR site:theses.fr OR site:researchgate.net OR intext:"Directeur de thèse" OR intext:"Coauteur" OR intext:"Laboratoire")`,
        desc: 'Identifie les articles scientifiques, coauteurs et directeurs de recherche universitaire.',
      };
    } else {
      academicScholar = {
        category: 'Academic, University & Research Papers',
        title: 'Google Scholar, ResearchGate, Co-Authors & Thesis Advisors',
        query: `(${nameOrShort} OR "${fam}") (site:scholar.google.com OR site:researchgate.net OR site:academia.edu OR intext:"Advisor" OR intext:"Supervised by" OR intext:"Co-author" OR intext:"Department")`,
        desc: 'Finds academic research papers, citations, co-authors, thesis advisors, and institutional affiliations on Scholar & ResearchGate.',
      };
    }

    // 6. Government Decrees, Gazettes & Civil Service
    let govDecrees: { category: string; title: string; query: string; desc: string };
    if (dorkLanguage === 'id') {
      govDecrees = {
        category: 'Official Decrees (.go.id), Rosters & Leaked CVs',
        title: 'Government Decrees (.go.id), SK, Civil Service & Court Records',
        query: `(${nameOrShort} OR "${fam}") (site:go.id OR intext:"Surat Keputusan" OR intext:"Lampiran" OR intext:"Pengumuman" OR intext:"Daftar Peserta")`,
        desc: 'Hunts official government websites (.go.id), ministerial decrees (SK), CPNS/BUMN selection rosters, and public registries.',
      };
    } else if (dorkLanguage === 'dual') {
      govDecrees = {
        category: 'Official Decrees (.gov / .go.id) & Public Records',
        title: 'Government Portals (.gov / .go.id), Decrees (SK) & Official Gazettes',
        query: `(${nameOrShort} OR "${fam}") (site:go.id OR site:gov OR intext:"Surat Keputusan" OR intext:"Decree" OR intext:"Pengumuman" OR intext:"Public Notice" OR intext:"Gazette")`,
        desc: 'Combines Indonesian .go.id decrees with global .gov / .gov.uk official registers and public appointments.',
      };
    } else if (dorkLanguage === 'es') {
      govDecrees = {
        category: 'Boletines Oficiales, Decretos y Registros Públicos',
        title: 'Boletín Oficial del Estado (BOE), Resoluciones y Nombramientos',
        query: `(${nameOrShort} OR "${fam}") (site:boe.es OR site:gob.es OR site:gob.* OR intext:"Boletín Oficial" OR intext:"Resolución" OR intext:"Decreto" OR intext:"Nombramiento")`,
        desc: 'Rastrea boletines oficiales (BOE/BOCM), nombramientos públicos, decretos y registros administrativos.',
      };
    } else if (dorkLanguage === 'de') {
      govDecrees = {
        category: 'Bundesgesetzblätter, Amtsblätter & Öffentliche Register',
        title: 'Bundesgesetzblatt, Amtsblätter, Ernennungen & Beschlüsse',
        query: `(${nameOrShort} OR "${fam}") (site:bund.de OR site:gv.at OR intext:"Bundesgesetzblatt" OR intext:"Amtsblatt" OR intext:"Beschluss" OR intext:"Ernennung")`,
        desc: 'Durchsucht amtliche Bekanntmachungen, Bundesanzeiger, Amtsblätter und offizielle Beschlüsse.',
      };
    } else if (dorkLanguage === 'fr') {
      govDecrees = {
        category: 'Journal Officiel, Arrêtés & Registres Publics',
        title: 'Journal Officiel (Légifrance), Arrêtés, Décrets & Nominations',
        query: `(${nameOrShort} OR "${fam}") (site:legifrance.gouv.fr OR site:gouv.fr OR intext:"Journal Officiel" OR intext:"Arrêté" OR intext:"Décret" OR intext:"Nomination")`,
        desc: 'Consulte le Journal Officiel, les décrets ministériels, nominations civiles et avis officiels.',
      };
    } else {
      govDecrees = {
        category: 'Official Decrees (.gov), Rosters & Public Records',
        title: 'Government Portals (.gov), Public Filings, Decrees & Official Gazettes',
        query: `(${nameOrShort} OR "${fam}") (site:gov OR site:gov.uk OR intext:"Gazette" OR intext:"Resolution" OR intext:"Public Notice" OR intext:"Appointed" OR intext:"Order" OR intext:"Registry")`,
        desc: 'Hunts official government registries (.gov / .gov.uk), executive orders, official gazettes, gazetted appointments, and public filings.',
      };
    }

    // 7. Indexed Documents & Leaked Rosters
    let docRoster: { category: string; title: string; query: string; desc: string };
    if (dorkLanguage === 'id') {
      docRoster = {
        category: 'Official Decrees (.go.id), Rosters & Leaked CVs',
        title: 'Indexed PDF / XLSX / DOCX CVs, Phone Numbers (+62/08) & Rosters',
        query: activeFullName
          ? `(${nameOrShort} OR "${h}"${em ? ` OR "${em}"` : ''}) (filetype:pdf OR filetype:xlsx OR filetype:docx)`
          : `"${h}" (filetype:pdf OR filetype:xlsx OR filetype:docx OR filetype:txt)`,
        desc: 'Hunts for leaked resumes/CVs, phone numbers, university student lists, event participant rosters, or employee spreadsheets.',
      };
    } else if (dorkLanguage === 'dual') {
      docRoster = {
        category: 'Official Decrees & Leaked Document Rosters',
        title: 'Indexed PDF / XLSX / DOCX CVs, Resumes & Participant Rosters',
        query: activeFullName
          ? `(${nameOrShort} OR "${h}"${em ? ` OR "${em}"` : ''}) (intext:"Curriculum Vitae" OR intext:"Resume" OR intext:"CV" OR intext:"Kontak" OR intext:"Phone") (filetype:pdf OR filetype:xlsx OR filetype:docx)`
          : `"${h}" (filetype:pdf OR filetype:xlsx OR filetype:docx OR filetype:txt)`,
        desc: 'Bilingual sweep for leaked resumes/CVs, phone numbers, attendee rosters, and organizational spreadsheets.',
      };
    } else if (dorkLanguage === 'es') {
      docRoster = {
        category: 'Documentos Indexados, Registros y CV Filtrados',
        title: 'Currículums (CV), Teléfonos y Listados en PDF / XLSX / DOCX',
        query: activeFullName
          ? `(${nameOrShort} OR "${h}"${em ? ` OR "${em}"` : ''}) (intext:"Curriculum Vitae" OR intext:"CV" OR intext:"Teléfono" OR intext:"Contacto") (filetype:pdf OR filetype:xlsx OR filetype:docx)`
          : `"${h}" (filetype:pdf OR filetype:xlsx OR filetype:docx OR filetype:txt)`,
        desc: 'Búsqueda de currículums filtrados, números de teléfono, actas y listas de participantes en eventos.',
      };
    } else if (dorkLanguage === 'de') {
      docRoster = {
        category: 'Dokumente, Teilnehmerlisten & Durchgesickerte Lebensläufe',
        title: 'Lebensläufe (CV), Telefonnummern & Teilnehmerlisten in PDF / XLSX / DOCX',
        query: activeFullName
          ? `(${nameOrShort} OR "${h}"${em ? ` OR "${em}"` : ''}) (intext:"Lebenslauf" OR intext:"CV" OR intext:"Telefon" OR intext:"Kontakt") (filetype:pdf OR filetype:xlsx OR filetype:docx)`
          : `"${h}" (filetype:pdf OR filetype:xlsx OR filetype:docx OR filetype:txt)`,
        desc: 'Sucht nach durchgesickerten Lebensläufen, Kontaktdaten, Teilnehmerlisten und internen Tabellen.',
      };
    } else if (dorkLanguage === 'fr') {
      docRoster = {
        category: 'Documents Indexés, Listes & CV en Ligne',
        title: 'Curriculum Vitae (CV), Téléphones & Annuaires en PDF / XLSX / DOCX',
        query: activeFullName
          ? `(${nameOrShort} OR "${h}"${em ? ` OR "${em}"` : ''}) (intext:"Curriculum Vitae" OR intext:"CV" OR intext:"Téléphone" OR intext:"Contact") (filetype:pdf OR filetype:xlsx OR filetype:docx)`
          : `"${h}" (filetype:pdf OR filetype:xlsx OR filetype:docx OR filetype:txt)`,
        desc: 'Recherche de CV en ligne, numéros de téléphone, listes d\'émargement et tableurs de participants.',
      };
    } else {
      docRoster = {
        category: 'Indexed Documents, Rosters & Leaked CVs',
        title: 'Indexed PDF / XLSX / DOCX CVs, Resumes & Participant Rosters',
        query: activeFullName
          ? `(${nameOrShort} OR "${h}"${em ? ` OR "${em}"` : ''}) (intext:"Curriculum Vitae" OR intext:"Resume" OR intext:"Phone" OR intext:"Contact") (filetype:pdf OR filetype:xlsx OR filetype:docx)`
          : `"${h}" (filetype:pdf OR filetype:xlsx OR filetype:docx OR filetype:txt)`,
        desc: 'Hunts for leaked resumes/CVs, attendee rosters, contact sheets, employee rosters, or spreadsheets.',
      };
    }

    return [
      { id: 'family-clan-relatives', ...familyClan },
      { id: 'family-lineage-graduation', ...familyGraduation },
      { id: 'career-jabatan-org', ...careerJabatan },
      {
        id: 'linkedin-pivot',
        category: 'Career & Identity Pivots',
        title: 'LinkedIn Career & Education Identity Match',
        query: activeFullName
          ? `site:linkedin.com/in/ (${nameOrShort})${org ? ` "${org}"` : ''}`
          : `site:linkedin.com/in/ "${h}"`,
        desc: 'Locates professional LinkedIn profiles using Full Name, 2-word Short Name variations, and Company/University.',
      },
      {
        id: 'linkedin-activity',
        category: 'Career & Identity Pivots',
        title: 'LinkedIn Public Post Comments & Colleague Tags',
        query: activeFullName
          ? `site:linkedin.com/posts/ (${nameOrShort} OR "${h}")`
          : `site:linkedin.com/posts/ "${h}"`,
        desc: 'Finds public LinkedIn posts where the target commented, congratulated colleagues, or was tagged by coworkers.',
      },
      { id: 'academic-pddikti-kampus', ...academicCampus },
      { id: 'academic-scholar-garuda', ...academicScholar },
      { id: 'gov-decrees-sk', ...govDecrees },
      { id: 'doc-roster-leak', ...docRoster },
      {
        id: 'ig-bypass',
        category: 'Private Account Comment & Tag Bypass',
        title: 'Instagram Private Account Public Comments & Mentions',
        query: `site:instagram.com "${h}" -inurl:instagram.com/${h}`,
        desc: 'Excludes the target profile URL so results are 100% public posts/comments from friends mentioning or replying to the private IG handle.',
      },
      {
        id: 'ig-posts-reels',
        category: 'Private Account Comment & Tag Bypass',
        title: 'Instagram Public Posts & Reels Comments / Friend Tags',
        query: `site:instagram.com/p/ "${h}" OR site:instagram.com/reel/ "${h}"`,
        desc: 'Finds public photo posts (/p/) and Reels (/reel/) where the target commented or was tagged in captions.',
      },
      {
        id: 'tiktok-bypass',
        category: 'Private Account Comment & Tag Bypass',
        title: 'TikTok Public Video Replies, Duets & Mentions',
        query: `site:tiktok.com "${h}" -inurl:"@${h}"`,
        desc: 'Finds public TikTok comment sections and video captions mentioning or replying to the handle.',
      },
      {
        id: 'x-bypass',
        category: 'Private Account Comment & Tag Bypass',
        title: 'X / Twitter External Replies to Protected Account',
        query: `(site:x.com OR site:twitter.com) "${h}" -inurl:${h}/status`,
        desc: 'Uncovers replies from public accounts talking to or tagging a protected/private X account.',
      },
      {
        id: 'paste-code-leak',
        category: 'Public Archives & Bio Aggregators',
        title: 'Linktree, Carrd, Pastebin & Forum Bio Leaks',
        query: `(site:linktr.ee OR site:carrd.co OR site:pastebin.com OR site:t.me OR site:reddit.com) (${activeFullName ? `${nameOrShort} OR "${h}"` : `"${h}"`})`,
        desc: 'Searches Linktree/Carrd bio hubs, Telegram channels, Reddit discussions, and paste sites for the target name or handle.',
      },
    ];
  }, [activeHandle, activeFullName, activeNameTokens, activeOrg, dossier.emails, dorkLanguage]);

  // Extractable sub-leads from the currently selected node for 1-click "+ Spawn on Board"
  const spawnableNodeLeads = useMemo(() => {
    if (!selectedNode?.metadata) return [];
    const meta = selectedNode.metadata;
    const leads: Array<{ key: string; label: string; value: string; type: EntityType }> = [];

    if (typeof meta.email === 'string' && meta.email.includes('@')) {
      leads.push({ key: 'email', label: 'Email', value: meta.email, type: 'email' });
    }
    if (typeof meta.twitter_username === 'string' && meta.twitter_username.trim()) {
      leads.push({
        key: 'twitter',
        label: 'X / Twitter Handle',
        value: meta.twitter_username.replace(/^@/, ''),
        type: 'username',
      });
    }
    if (typeof meta.blog === 'string' && meta.blog.trim()) {
      const cleanDom = meta.blog.replace(/^https?:\/\//i, '').split('/')[0];
      if (cleanDom.includes('.')) {
        leads.push({ key: 'blog', label: 'Personal Website', value: cleanDom, type: 'domain' });
      }
    }
    if (typeof meta.company === 'string' && meta.company.trim()) {
      leads.push({
        key: 'company',
        label: 'Organization / Campus',
        value: meta.company.trim(),
        type: 'organization',
      });
    }
    if (typeof meta.location === 'string' && meta.location.trim()) {
      leads.push({
        key: 'location',
        label: 'Location',
        value: meta.location.trim(),
        type: 'location',
      });
    }
    return leads;
  }, [selectedNode]);

  if (!isOpen) return null;

  const copyText = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1600);
  };

  const launchGoogleDork = (query: string) => {
    window.open(
      `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const selectedAvatar =
    typeof selectedNode?.metadata?.avatar_url === 'string'
      ? selectedNode.metadata.avatar_url
      : null;

  const selectedProfileUrl =
    typeof selectedNode?.metadata?.profile_url === 'string'
      ? selectedNode.metadata.profile_url
      : selectedNode?.value.startsWith('http')
      ? selectedNode.value
      : null;

  return (
    <aside
      data-testid="lead-inspector-drawer"
      className="w-[380px] max-h-[calc(100vh-88px)] flex flex-col bg-[#0F1219]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden text-xs text-slate-200 z-20"
    >
      {/* Top Navigation Segmented Bar */}
      <div className="px-3 py-2 bg-[#131720] border-b border-white/[0.07] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 font-mono text-[10px] bg-[#090B10] p-0.5 rounded-lg border border-white/[0.06] flex-1">
          <button
            type="button"
            onClick={() => onTabChange('node')}
            className={`flex-1 py-1 px-1.5 rounded-md font-medium flex items-center justify-center gap-1 transition-all ${
              activeTab === 'node'
                ? 'bg-white/[0.09] text-white border border-white/[0.08] shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Crosshair className="w-3 h-3 text-sky-400" />
            <span>Lead</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('dorks')}
            data-testid="tab-dork-matrix"
            className={`flex-1 py-1 px-1.5 rounded-md font-medium flex items-center justify-center gap-1 transition-all ${
              activeTab === 'dorks'
                ? 'bg-white/[0.09] text-white border border-white/[0.08] shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Radar className="w-3 h-3 text-sky-400" />
            <span>Dork Matrix</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('ai')}
            data-testid="tab-ai-detective"
            className={`flex-1 py-1 px-1.5 rounded-md font-medium flex items-center justify-center gap-1 transition-all ${
              activeTab === 'ai'
                ? 'bg-white/[0.09] text-white border border-white/[0.08] shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>AI</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('pin')}
            data-testid="tab-pin-clue"
            className={`flex-1 py-1 px-1.5 rounded-md font-medium flex items-center justify-center gap-1 transition-all ${
              activeTab === 'pin'
                ? 'bg-white/[0.09] text-white border border-white/[0.08] shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Pin className="w-3 h-3 text-amber-400" />
            <span>Pin</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md hover:bg-white/[0.06] text-slate-400 hover:text-white transition-colors"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {/* TAB 1: NODE LEAD INSPECTOR & STICKY NOTES */}
        {activeTab === 'node' && (
          <>
            {selectedNode ? (
              <div className="space-y-3.5">
                {/* Node Identity Header */}
                <div className="p-3 rounded-xl bg-[#131720] border border-white/[0.07] space-y-2.5">
                  <div className="flex items-start gap-3">
                    {selectedAvatar && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedAvatar}
                        alt={selectedNode.label}
                        className="w-8 h-8 max-w-[32px] max-h-[32px] rounded-lg object-cover border border-white/[0.12] flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/25 font-medium">
                          {selectedNode.type}
                        </span>
                        {typeof selectedNode.metadata?.platform === 'string' && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-300 border border-white/[0.07]">
                            {selectedNode.metadata.platform}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-slate-100 mt-1 truncate">
                        {selectedNode.label}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 break-all">
                        {selectedNode.value}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons: Copy & Open Profile */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => copyText('node-val', selectedNode.value)}
                      className="flex-1 py-1.5 px-2.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 font-mono text-[10px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {copiedKey === 'node-val' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-300">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>Copy Value</span>
                        </>
                      )}
                    </button>
                    {selectedProfileUrl && (
                      <a
                        href={selectedProfileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-1.5 px-2.5 rounded-md bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-200 font-mono text-[10px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open Profile</span>
                      </a>
                    )}
                  </div>

                  {/* Reverse Image Search if node has an avatar */}
                  {selectedAvatar && (
                    <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-1.5">
                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
                        <Camera className="w-3 h-3 text-sky-400" />
                        Reverse Photo:
                      </span>
                      <div className="flex items-center gap-1">
                        <a
                          href={`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(selectedAvatar)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-slate-200 text-[10px] font-mono hover:bg-white/[0.08]"
                        >
                          Lens ↗
                        </a>
                        <a
                          href={`https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(selectedAvatar)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-slate-200 text-[10px] font-mono hover:bg-white/[0.08]"
                        >
                          Yandex ↗
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* 1-Click Lead-Chaining Actions on Selected Node */}
                <div className="p-3 rounded-xl bg-[#131720] border border-white/[0.07] space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                    <Play className="w-3 h-3 text-sky-400" />
                    <span>Chain Next OSINT Step From This Lead</span>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5">
                    {(selectedNode.type === 'username' ||
                      selectedNode.type === 'associate' ||
                      selectedNode.type === 'organization' ||
                      selectedNode.type === 'location') && (
                      <>
                        <button
                          type="button"
                          disabled={isScanning}
                          onClick={() =>
                            onRunModuleOnNode(selectedNode, [
                              'deep_profile_extractor',
                              'connection_mapper',
                              'social_presence_scanner',
                            ])
                          }
                          className="w-full py-1.5 px-2.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-sky-200 font-mono text-[11px] font-semibold flex items-center justify-between transition-colors disabled:opacity-50"
                        >
                          <span className="flex items-center gap-2">
                            <Crosshair className="w-3.5 h-3.5 text-sky-400" />
                            <span>Full Deep Sweep (Profile, Family Clan, Academic & 66+ Sites)</span>
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-sky-300" />
                        </button>
                        <button
                          type="button"
                          disabled={isScanning}
                          onClick={() =>
                            onRunModuleOnNode(selectedNode, ['deep_profile_extractor'])
                          }
                          className="w-full py-1.5 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-slate-200 font-mono text-[11px] font-medium flex items-center justify-between transition-colors disabled:opacity-50"
                        >
                          <span className="flex items-center gap-2">
                            <Fingerprint className="w-3.5 h-3.5 text-sky-400" />
                            <span>Extract Deep Profile, Academic & Career Leads</span>
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                        <button
                          type="button"
                          disabled={isScanning}
                          onClick={() => onRunModuleOnNode(selectedNode, ['connection_mapper'])}
                          className="w-full py-1.5 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-slate-200 font-mono text-[11px] font-medium flex items-center justify-between transition-colors disabled:opacity-50"
                        >
                          <span className="flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Map Family Clan, Relatives & Mutual Circle</span>
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                        <button
                          type="button"
                          disabled={isScanning}
                          onClick={() =>
                            onRunModuleOnNode(selectedNode, ['social_presence_scanner'])
                          }
                          className="w-full py-1.5 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-slate-200 font-mono text-[11px] font-medium flex items-center justify-between transition-colors disabled:opacity-50"
                        >
                          <span className="flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5 text-sky-400" />
                            <span>Scan Handle / Derived Handles Across 66+ Platforms</span>
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </>
                    )}

                    {selectedNode.type === 'email' && (
                      <>
                        <button
                          type="button"
                          disabled={isScanning}
                          onClick={() => onRunModuleOnNode(selectedNode, ['email_correlator'])}
                          className="w-full py-1.5 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-slate-200 font-mono text-[11px] font-medium flex items-center justify-between transition-colors disabled:opacity-50"
                        >
                          <span className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-amber-400" />
                            <span>Lookup Gravatar, OpenPGP & GitHub</span>
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                        <button
                          type="button"
                          disabled={isScanning}
                          onClick={() =>
                            onRunModuleOnNode(selectedNode, ['breach_credential_hunter'])
                          }
                          className="w-full py-1.5 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-slate-200 font-mono text-[11px] font-medium flex items-center justify-between transition-colors disabled:opacity-50"
                        >
                          <span className="flex items-center gap-2">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                            <span>Check Email in Data Breaches</span>
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </>
                    )}

                    {(selectedNode.type === 'domain' || selectedNode.type === 'subdomain') && (
                      <button
                        type="button"
                        disabled={isScanning}
                        onClick={() =>
                          onRunModuleOnNode(selectedNode, [
                            'subdomain_dns_resolver',
                            'ip_threat_intel',
                          ])
                        }
                        className="w-full py-1.5 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-slate-200 font-mono text-[11px] font-medium flex items-center justify-between transition-colors disabled:opacity-50"
                      >
                        <span className="flex items-center gap-2">
                          <Globe className="w-3.5 h-3.5 text-sky-400" />
                          <span>Enumerate Subdomains, DNS & Origin IPs</span>
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onTabChange('dorks')}
                      className="w-full py-1.5 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-slate-200 font-mono text-[11px] font-medium flex items-center justify-between transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Radar className="w-3.5 h-3.5 text-sky-400" />
                        <span>Generate Private Account Bypass Dorks</span>
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </div>
                </div>

                {/* Confidence Tagging & Investigator Sticky Notes */}
                <div className="p-3 rounded-xl bg-[#131720] border border-white/[0.07] space-y-2.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                    <StickyNote className="w-3 h-3 text-amber-400" />
                    <span>Confidence Status & Detective Notes</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateNodeAnnotation(selectedNode.id, { confidence: 'verified' })
                      }
                      className={`py-1.5 px-2 rounded-md border flex items-center justify-center gap-1 font-medium transition-colors ${
                        selectedNode.confidence === 'verified'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-[#090B10] border-white/[0.06] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Verified</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateNodeAnnotation(selectedNode.id, { confidence: 'suspected' })
                      }
                      className={`py-1.5 px-2 rounded-md border flex items-center justify-center gap-1 font-medium transition-colors ${
                        selectedNode.confidence === 'suspected'
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                          : 'bg-[#090B10] border-white/[0.06] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      <span>Suspect</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateNodeAnnotation(selectedNode.id, { confidence: 'false_positive' })
                      }
                      className={`py-1.5 px-2 rounded-md border flex items-center justify-center gap-1 font-medium transition-colors ${
                        selectedNode.confidence === 'false_positive'
                          ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                          : 'bg-[#090B10] border-white/[0.06] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <XCircle className="w-3 h-3 text-rose-400" />
                      <span>False Pos</span>
                    </button>
                  </div>

                  <textarea
                    rows={3}
                    value={selectedNode.investigatorNotes || ''}
                    onChange={(e) =>
                      onUpdateNodeAnnotation(selectedNode.id, {
                        investigatorNotes: e.target.value,
                      })
                    }
                    placeholder="Write investigator sticky notes for this lead (e.g. 'Confirmed same person via IG bio link')..."
                    className="w-full rounded-lg bg-[#090B10] border border-white/[0.08] focus:border-sky-400/60 outline-none p-2 text-[11px] text-slate-200 font-mono placeholder:text-slate-500"
                  />
                </div>

                {/* Extracted Sub-Leads with 1-Click "+ Spawn on Board" */}
                {spawnableNodeLeads.length > 0 && (
                  <div className="p-3 rounded-xl bg-[#131720] border border-white/[0.07] space-y-2">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-semibold">
                      Extracted Leads from This Node
                    </div>
                    <div className="space-y-1.5">
                      {spawnableNodeLeads.map((item) => (
                        <div
                          key={`${item.key}-${item.value}`}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#090B10] border border-white/[0.06]"
                        >
                          <div className="min-w-0">
                            <div className="text-[9px] font-mono text-slate-400 uppercase">
                              {item.label}
                            </div>
                            <div className="text-[11px] font-mono font-medium text-slate-100 truncate">
                              {item.value}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              onAddManualLead(
                                item.type,
                                item.value,
                                `${item.label}: ${item.value}`,
                                selectedNode.id,
                                `Extracted from ${selectedNode.label}`
                              )
                            }
                            className="px-2 py-1 rounded bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-200 font-mono text-[10px] font-medium flex-shrink-0 transition-colors"
                          >
                            + Spawn on Board
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extracted Metadata Table */}
                {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 && (
                  <div className="p-3 rounded-xl bg-[#131720] border border-white/[0.07] space-y-1.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                      Raw Intelligence Attributes
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                      {Object.entries(selectedNode.metadata)
                        .filter(
                          ([k, v]) =>
                            v !== null &&
                            v !== undefined &&
                            v !== '' &&
                            k !== 'timeline' &&
                            k !== 'bios'
                        )
                        .map(([k, v]) => (
                          <div
                            key={k}
                            className="flex items-start justify-between gap-2 text-[10px] font-mono py-1 border-b border-white/[0.05] last:border-none"
                          >
                            <span className="text-slate-400 flex-shrink-0">{k}:</span>
                            <span className="text-slate-200 text-right break-all">
                              {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5 rounded-xl bg-[#131720]/70 border border-white/[0.06] text-center space-y-2">
                <Search className="w-5 h-5 text-sky-400 mx-auto" />
                <div className="text-xs font-semibold text-slate-100">No Evidence Card Selected</div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Click any node card on the Caseboard to inspect its extracted metadata, chain
                  deeper OSINT modules, or tag its confidence level.
                </p>
              </div>
            )}
          </>
        )}

        {/* TAB 2: TACTICAL GOOGLE DORK MATRIX (PRIVATE ACCOUNT COMMENT BYPASS) */}
        {activeTab === 'dorks' && (
          <div className="space-y-3" data-testid="dork-matrix-panel">
            <div className="p-3 rounded-xl bg-[#131720] border border-white/[0.08] space-y-2">
              <div className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                <Radar className="w-3.5 h-3.5 text-sky-400" />
                <span>Tactical Google Dork Matrix</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Even if a target&apos;s Instagram, TikTok, or X account is <strong className="text-slate-200">Private</strong>,
                their comments on friends&apos; public posts and public tags remain indexed by Google.
              </p>
              <div className="pt-1">
                <label className="block text-[10px] font-mono text-slate-400 mb-1">
                  Target Handle for Dork Injection:
                </label>
                <input
                  type="text"
                  value={customDorkHandle}
                  onChange={(e) => setCustomDorkHandle(e.target.value)}
                  placeholder={`Default: ${activeHandle}`}
                  className="w-full px-2.5 py-1.5 rounded-md bg-[#090B10] border border-white/[0.1] text-xs font-mono text-slate-100 outline-none focus:border-sky-400/60"
                />
              </div>
            </div>

            {/* Target Language & Region Selector */}
            <div className="p-3 rounded-xl bg-[#131720] border border-white/[0.08] space-y-2.5" data-testid="dork-language-selector">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5 text-sky-400" />
                  <span>Dork Language & Region</span>
                </div>
                <span className="text-[10px] font-mono text-sky-300 bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 rounded-md">
                  {DORK_LANGUAGES.find((l) => l.id === dorkLanguage)?.region}
                </span>
              </div>
              <p className="text-[10.5px] text-slate-400 leading-relaxed">
                Adapts keywords for family lineage, civil decrees, academic archives, and executive roles to match the target&apos;s country or language.
              </p>
              <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                {DORK_LANGUAGES.map((lang) => {
                  const isActive = dorkLanguage === lang.id;
                  return (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => {
                        hasUserSelectedLang.current = true;
                        setDorkLanguage(lang.id);
                      }}
                      data-testid={`dork-lang-${lang.id}`}
                      className={cn(
                        "px-2 py-1.5 rounded-lg border text-[11px] font-mono flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                        isActive
                          ? "bg-sky-500/20 border-sky-400/60 text-sky-200 font-semibold shadow-sm shadow-sky-500/10"
                          : "bg-[#090B10] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:border-white/[0.12]"
                      )}
                    >
                      <span className="text-xs">{lang.flag}</span>
                      <span>{lang.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2.5">
              {tacticalDorks.map((dork) => (
                <div
                  key={dork.id}
                  className="p-3 rounded-xl bg-[#131720] border border-white/[0.07] hover:border-white/[0.14] space-y-2 transition-colors"
                >
                  <div className="text-[9px] font-mono uppercase tracking-wider text-sky-400 font-semibold">
                    {dork.category}
                  </div>
                  <div className="text-xs font-semibold text-slate-100">{dork.title}</div>
                  <div className="text-[10px] text-slate-400 leading-relaxed">{dork.desc}</div>
                  <div className="p-2 rounded-md bg-[#090B10] border border-white/[0.06] font-mono text-[10px] text-slate-200 break-all select-all">
                    {dork.query}
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => copyText(dork.id, dork.query)}
                      className="px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 font-mono text-[10px] flex items-center gap-1 transition-colors"
                    >
                      {copiedKey === dork.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>Copy Query</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => launchGoogleDork(dork.query)}
                      className="flex-1 py-1 px-2.5 rounded-md bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-200 font-mono text-[10px] font-medium flex items-center justify-center gap-1 transition-colors"
                    >
                      <span>Launch Google Dork ↗</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: AI DETECTIVE & BYOK TOKEN SETTINGS */}
        {activeTab === 'ai' && (
          <div className="space-y-3" data-testid="ai-detective-panel">
            {/* BYOK Token & Provider Bar */}
            <div className="p-3 rounded-xl bg-[#131720] border border-white/[0.07] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-100">AI OSINT Detective</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowByokForm((prev) => !prev)}
                  data-testid="btn-toggle-byok"
                  className="px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 border border-white/[0.09] font-mono text-[10px] font-medium flex items-center gap-1 transition-colors"
                >
                  <KeyRound className="w-3 h-3 text-amber-400" />
                  <span>{aiConfig.apiKey ? 'Key Active' : 'Set AI Token'}</span>
                </button>
              </div>

              {showByokForm && (
                <div className="p-2.5 rounded-lg bg-[#090B10] border border-white/[0.07] space-y-2">
                  <div className="text-[10px] font-mono text-slate-400">
                    Bring-Your-Own-Key (stored locally in your browser):
                  </div>
                  <div className="grid grid-cols-4 gap-1 font-mono text-[10px]">
                    {(['gemini', 'groq', 'openai', 'ollama'] as AIProviderType[]).map((prov) => (
                      <button
                        key={prov}
                        type="button"
                        onClick={() => onUpdateAiConfig({ ...aiConfig, provider: prov })}
                        className={`py-1 rounded border uppercase font-medium transition-colors ${
                          aiConfig.provider === prov
                            ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                            : 'bg-[#131720] border-white/[0.06] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {prov}
                      </button>
                    ))}
                  </div>
                  {aiConfig.provider !== 'ollama' && (
                    <input
                      type="password"
                      value={aiConfig.apiKey}
                      onChange={(e) =>
                        onUpdateAiConfig({ ...aiConfig, apiKey: e.target.value })
                      }
                      placeholder={`Paste ${aiConfig.provider.toUpperCase()} API Key...`}
                      className="w-full px-2.5 py-1.5 rounded-md bg-[#131720] border border-white/[0.09] text-xs font-mono text-white outline-none focus:border-sky-400/60"
                    />
                  )}
                  <input
                    type="text"
                    value={aiConfig.modelOverride || ''}
                    onChange={(e) =>
                      onUpdateAiConfig({ ...aiConfig, modelOverride: e.target.value })
                    }
                    placeholder="Optional model override (e.g. llama-3.3-70b-versatile)"
                    className="w-full px-2.5 py-1.5 rounded-md bg-[#131720] border border-white/[0.09] text-[11px] font-mono text-slate-200 outline-none"
                  />
                </div>
              )}

              <button
                type="button"
                disabled={isAIAnalyzing}
                onClick={() => onRunAIAnalysis()}
                className="w-full py-1.5 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-mono text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {isAIAnalyzing
                    ? 'Synthesizing Leads & Hypotheses...'
                    : 'Run AI Lead Correlation & Hypothesis'}
                </span>
              </button>
            </div>

            {aiReport && (
              <div className="space-y-3">
                {/* Predicted Alternate Handles / Emails */}
                {aiReport.predictedLeads && aiReport.predictedLeads.length > 0 && (
                  <div className="p-3 rounded-xl bg-[#131720] border border-white/[0.07] space-y-2">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-semibold">
                      Predicted Alternate Handles & Emails
                    </div>
                    <div className="space-y-1.5">
                      {aiReport.predictedLeads.map((lead, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#090B10] border border-white/[0.06]"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-mono font-semibold text-slate-100 truncate">
                              {lead.value}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate tabular-nums">
                              {lead.reason} ({Math.round(lead.confidence * 100)}%)
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              onPivotLead(
                                lead.value,
                                (lead.leadType as EntityType) || 'username'
                              )
                            }
                            className="px-2 py-1 rounded-md bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-200 font-mono text-[10px] font-medium flex-shrink-0 transition-colors"
                          >
                            Hunt →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Suggested Custom Dorks */}
                {aiReport.suggestedDorks && aiReport.suggestedDorks.length > 0 && (
                  <div className="p-3 rounded-xl bg-[#131720] border border-white/[0.07] space-y-2">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-semibold">
                      AI-Crafted Tactical Dorks
                    </div>
                    <div className="space-y-2">
                      {aiReport.suggestedDorks.map((dork, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-[#090B10] border border-white/[0.06] space-y-1.5"
                        >
                          <div className="text-[11px] font-semibold text-slate-100">
                            {dork.title}
                          </div>
                          <div className="text-[10px] text-slate-400">{dork.description}</div>
                          <div className="font-mono text-[10px] text-sky-300 break-all select-all">
                            {dork.query}
                          </div>
                          <button
                            type="button"
                            onClick={() => launchGoogleDork(dork.query)}
                            className="w-full py-1 px-2 rounded bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-slate-200 font-mono text-[10px] font-medium"
                          >
                            Launch Google Dork ↗
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Executive Dossier Synthesis */}
                <div className="p-3 rounded-xl bg-[#131720] border border-white/[0.07] space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span className="uppercase font-semibold text-sky-400">
                      Detective Synthesis
                    </span>
                    <span>Model: {aiReport.model}</span>
                  </div>
                  <p className="text-[11px] text-slate-200 whitespace-pre-line leading-relaxed">
                    {aiReport.executiveSummary}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PIN MANUAL CLUE FORM */}
        {activeTab === 'pin' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!pinValue.trim()) return;
              onAddManualLead(
                pinType,
                pinValue,
                pinLabel || undefined,
                selectedNode?.id,
                pinNotes || undefined
              );
              setPinValue('');
              setPinLabel('');
              setPinNotes('');
              onTabChange('node');
            }}
            className="p-3.5 rounded-xl bg-[#131720] border border-white/[0.07] space-y-3"
          >
            <div className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
              <Pin className="w-3.5 h-3.5 text-amber-400" />
              <span>Pin Manual Clue to Caseboard</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Found a username, email, company, or friend&apos;s handle from an Instagram story or
              Google Dork? Pin it directly onto the board and chain your next scan from it.
            </p>

            <div>
              <label className="block text-[10px] font-mono text-slate-400 mb-1">
                Clue Type:
              </label>
              <select
                value={pinType}
                onChange={(e) => setPinType(e.target.value as EntityType)}
                className="w-full px-2.5 py-1.5 rounded-md bg-[#090B10] border border-white/[0.1] text-xs font-mono text-slate-100 outline-none focus:border-sky-400/60"
              >
                <option value="username">Username or Full Real Name (e.g. Almakius Felix...)</option>
                <option value="email">Email Address</option>
                <option value="associate">Associate / Family / Relative</option>
                <option value="organization">Company / University / Family Surname</option>
                <option value="location">City / Location</option>
                <option value="domain">Personal / Work Website</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-slate-400 mb-1">
                Clue Value (Required):
              </label>
              <input
                type="text"
                required
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value)}
                placeholder="e.g. budi.santoso99 or budi@company.com"
                className="w-full px-2.5 py-1.5 rounded-md bg-[#090B10] border border-white/[0.1] text-xs font-mono text-slate-100 outline-none focus:border-sky-400/60"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-slate-400 mb-1">
                Custom Label (Optional):
              </label>
              <input
                type="text"
                value={pinLabel}
                onChange={(e) => setPinLabel(e.target.value)}
                placeholder="e.g. Private IG found in friend's comment"
                className="w-full px-2.5 py-1.5 rounded-md bg-[#090B10] border border-white/[0.1] text-xs font-mono text-slate-100 outline-none focus:border-sky-400/60"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-slate-400 mb-1">
                Detective Notes:
              </label>
              <textarea
                rows={2}
                value={pinNotes}
                onChange={(e) => setPinNotes(e.target.value)}
                placeholder="Where did you find this clue?"
                className="w-full px-2.5 py-1.5 rounded-md bg-[#090B10] border border-white/[0.1] text-xs font-mono text-slate-100 outline-none focus:border-sky-400/60"
              />
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="submit"
                className="w-full py-2 px-3 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-slate-100 font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Pin className="w-3.5 h-3.5 text-amber-400" />
                <span>Pin Clue onto Board & Connect</span>
              </button>

              <button
                type="button"
                disabled={!pinValue.trim() || isScanning}
                onClick={() => {
                  const val = pinValue.trim();
                  if (!val) return;
                  onAddManualLead(
                    pinType,
                    val,
                    pinLabel || undefined,
                    selectedNode?.id,
                    pinNotes || undefined
                  );
                  setPinValue('');
                  setPinLabel('');
                  setPinNotes('');
                  onTabChange('node');
                  onPivotLead(val, pinType, undefined, selectedNode?.id);
                }}
                className="w-full py-2 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Pin Clue & Immediately Chain Deep OSINT Scan →</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </aside>
  );
}
