"""
Full-Name OSINT Intelligence, Surname/Clan Extraction & Smart Handle Permutation Engine.
Transforms a real human name (e.g. 'ALMAKIUS FELIX BARIQ HEKOPUNG') into:
1. Structured name components (given names, middle names, family surname/clan, name variations)
2. High-probability candidate social handles (including Indonesian/global consonant-surname
   abbreviations such as 'bariq' + 'hekopung' -> 'bariqhkp', adjacent token pairs, and initials)
3. Deep OSINT search queries for Academic (OpenAlex/CrossRef/PDDIKTI), Career/Jabatan,
   and Family/Clan lineage investigation.
"""

from typing import Dict, Any, List
import re

COMMON_TITLES = {
    "dr",
    "drs",
    "dra",
    "ir",
    "prof",
    "hj",
    "h",
    "st",
    "mt",
    "sh",
    "mh",
    "se",
    "mm",
    "skom",
    "mkom",
    "ssi",
    "msi",
    "spd",
    "mpd",
    "bsc",
    "msc",
    "phd",
    "md",
    "ba",
    "ma",
    "mba",
}


def is_full_name_input(raw: str) -> bool:
    """
    Returns True if the target string represents a multi-word full name or organization
    rather than a single-token username/handle.
    """
    if not raw or not isinstance(raw, str):
        return False
    clean = raw.strip()
    if "@" in clean or clean.startswith(("http://", "https://")):
        return False
    tokens = [t for t in re.split(r"\s+", clean) if t]
    return len(tokens) >= 2


def _consonant_abbreviations(word: str) -> List[str]:
    """
    Generates common consonant abbreviations for a surname/token.
    Example: 'hekopung' -> consonants 'hkpng' -> ['hkp', 'hkpg', 'hkg']
    """
    w = re.sub(r"[^a-z]", "", word.lower())
    if len(w) <= 3:
        return [w] if w else []

    # Consonants (keep first letter if vowel, otherwise non-vowels)
    consonants = [ch for ch in w if ch not in "aeiou"]
    abbrevs: List[str] = []
    if len(consonants) >= 3:
        # First 3 consonants (e.g. h-k-p-n-g -> 'hkp')
        abbrevs.append("".join(consonants[:3]))
        # First 2 + last consonant (e.g. 'hkg')
        abbrevs.append(consonants[0] + consonants[1] + consonants[-1])
    elif len(consonants) == 2:
        abbrevs.append("".join(consonants))

    # First 3 letters of the word
    abbrevs.append(w[:3])

    # Deduplicate preserving order
    return list(dict.fromkeys([a for a in abbrevs if len(a) >= 2]))


def parse_full_name(raw_name: str) -> Dict[str, Any]:
    """
    Decomposes a full human name into structured OSINT investigation tokens:
    - formatted_name: Title-cased full name
    - tokens: lowercase alphabetic name tokens (stripped of academic titles)
    - first_name: first token
    - surname: family name / marga (last token if >= 2 tokens)
    - name_variations: 2-word and full-name combinations used across LinkedIn, PDDIKTI, and journals
    - candidate_handles: ranked list of likely social media usernames
    """
    cleaned = re.sub(r"[,.;()\"']", " ", raw_name.strip())
    raw_tokens = [t.strip() for t in re.split(r"\s+", cleaned) if t.strip()]

    # Filter out common academic/honorific titles while keeping core name tokens
    core_tokens = [
        re.sub(r"[^a-zA-Z0-9_-]", "", t)
        for t in raw_tokens
        if re.sub(r"[^a-zA-Z]", "", t).lower() not in COMMON_TITLES
    ]
    core_tokens = [t for t in core_tokens if len(t) >= 2]

    if not core_tokens:
        fallback = re.sub(r"[^a-zA-Z0-9_.-]", "", raw_name.strip().lower()) or "target"
        return {
            "is_full_name": False,
            "formatted_name": raw_name.strip(),
            "tokens": [fallback],
            "first_name": fallback,
            "surname": "",
            "name_variations": [raw_name.strip()],
            "candidate_handles": [fallback],
        }

    lower_tokens = [t.lower() for t in core_tokens]
    title_tokens = [t.capitalize() for t in lower_tokens]
    formatted_name = " ".join(title_tokens)

    if len(lower_tokens) == 1:
        single = lower_tokens[0]
        return {
            "is_full_name": False,
            "formatted_name": single,
            "tokens": [single],
            "first_name": single,
            "surname": "",
            "name_variations": [single],
            "candidate_handles": [single],
        }

    first_name = title_tokens[0]
    surname = title_tokens[-1]
    surname_lower = lower_tokens[-1]
    given_tokens = lower_tokens[:-1]

    # 1. Build Name Variations (Full name, First+Last, Middle+Last, First+Middle)
    variations: List[str] = [formatted_name]
    if len(title_tokens) >= 3:
        # e.g. "Bariq Hekopung", "Felix Bariq", "Almakius Felix"
        variations.append(f"{title_tokens[-2]} {surname}")
        variations.append(f"{first_name} {surname}")
        variations.append(f"{title_tokens[0]} {title_tokens[1]}")
        if len(title_tokens) >= 4:
            variations.append(f"{title_tokens[1]} {title_tokens[2]}")
            variations.append(f"{title_tokens[1]} {surname}")
    else:
        variations.append(f"{first_name} {surname}")

    name_variations = list(dict.fromkeys(variations))

    # 2. Generate High-Probability Candidate Handles
    candidates: List[str] = []
    surname_abbrevs = _consonant_abbreviations(surname_lower)
    all_initials = "".join(t[0] for t in lower_tokens)

    # Pattern A: Given/Middle token + Surname consonant abbreviation (e.g. bariq + hkp -> bariqhkp)
    for g_tok in reversed(given_tokens):
        for abbr in surname_abbrevs:
            candidates.append(f"{g_tok}{abbr}")

    # Pattern B: Adjacent token pairs & Given + Surname (e.g. felixbariq, bariqhekopung, almakiusfelix)
    for i in range(len(lower_tokens) - 1):
        candidates.append(f"{lower_tokens[i]}{lower_tokens[i + 1]}")
    candidates.append(f"{lower_tokens[0]}{surname_lower}")
    if len(lower_tokens) >= 3:
        candidates.append(f"{lower_tokens[-2]}{surname_lower}")

    # Pattern C: Given/Middle token + Surname initial (e.g. bariqh, felixh)
    for g_tok in reversed(given_tokens):
        candidates.append(f"{g_tok}{surname_lower[0]}")

    # Pattern D: Distinct individual tokens (longest/most unique given tokens & surname)
    for tok in reversed(lower_tokens):
        if len(tok) >= 4:
            candidates.append(tok)

    # Pattern E: Dot/underscore separated and full initials
    if len(lower_tokens) >= 3:
        candidates.append(f"{lower_tokens[-2]}_{surname_lower}")
        candidates.append(f"{lower_tokens[1]}{lower_tokens[2]}")
    candidates.append(f"{lower_tokens[0]}_{surname_lower}")
    if len(all_initials) >= 3:
        candidates.append(f"{given_tokens[-1]}{all_initials}")

    # Deduplicate while preserving priority ranking
    clean_candidates: List[str] = []
    for c in candidates:
        c_clean = re.sub(r"[^a-z0-9_.-]", "", c.lower())
        if 3 <= len(c_clean) <= 32 and c_clean not in clean_candidates:
            clean_candidates.append(c_clean)

    return {
        "is_full_name": True,
        "formatted_name": formatted_name,
        "tokens": lower_tokens,
        "first_name": first_name,
        "surname": surname,
        "name_variations": name_variations,
        "candidate_handles": clean_candidates[:10],
    }

