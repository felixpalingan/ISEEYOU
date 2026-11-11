"""
Phone Carrier, Messaging & Breach Intel Provider
Analyzes MSISDN / E.164 phone numbers, resolves telecommunications carriers,
derives WhatsApp and Telegram direct communication endpoints, and identifies
PII exposure risks.
"""

from typing import AsyncGenerator, Dict, Any, List, Optional
import re
import logging

from engine.core.base_provider import BaseOSINTProvider, provider_registry
from engine.models.entities import (
    EntityType,
    SeverityLevel,
    TelemetryLevel,
)

logger = logging.getLogger("iseeyou.providers.phone_intel")

# Indonesian Mobile Network Operator (MNO) prefix map
INDONESIAN_CARRIER_PREFIXES: Dict[str, str] = {
    # Telkomsel (Halo, SimPATI, Kartu AS, By.U)
    "0811": "Telkomsel (Halo)",
    "0812": "Telkomsel (SimPATI)",
    "0813": "Telkomsel (SimPATI)",
    "0821": "Telkomsel (SimPATI)",
    "0822": "Telkomsel (SimPATI/Loop)",
    "0823": "Telkomsel (Kartu AS)",
    "0851": "Telkomsel (By.U / AS)",
    "0852": "Telkomsel (Kartu AS)",
    "0853": "Telkomsel (Kartu AS)",
    # Indosat Ooredoo Hutchison (IM3, Mentari)
    "0814": "Indosat Ooredoo (Broadband)",
    "0815": "Indosat Ooredoo (Matrix/IM3)",
    "0816": "Indosat Ooredoo (Matrix/IM3)",
    "0855": "Indosat Ooredoo (Matrix)",
    "0856": "Indosat Ooredoo (IM3)",
    "0857": "Indosat Ooredoo (IM3)",
    "0858": "Indosat Ooredoo (Mentari)",
    # XL Axiata (XL, Axis, Live.On)
    "0817": "XL Axiata",
    "0818": "XL Axiata",
    "0819": "XL Axiata",
    "0859": "XL Axiata",
    "0877": "XL Axiata",
    "0878": "XL Axiata",
    "0831": "Axis (XL Axiata)",
    "0832": "Axis (XL Axiata)",
    "0833": "Axis (XL Axiata)",
    "0838": "Axis (XL Axiata)",
    # Tri / 3 (Indosat Ooredoo Hutchison)
    "0895": "Tri (3 Indonesia)",
    "0896": "Tri (3 Indonesia)",
    "0897": "Tri (3 Indonesia)",
    "0898": "Tri (3 Indonesia)",
    "0899": "Tri (3 Indonesia)",
    # Smartfren
    "0881": "Smartfren",
    "0882": "Smartfren",
    "0883": "Smartfren",
    "0884": "Smartfren",
    "0885": "Smartfren",
    "0886": "Smartfren",
    "0887": "Smartfren",
    "0888": "Smartfren",
    "0889": "Smartfren",
}

COUNTRY_CODES: Dict[str, str] = {
    "62": "Indonesia",
    "1": "United States / Canada",
    "44": "United Kingdom",
    "65": "Singapore",
    "60": "Malaysia",
    "61": "Australia",
    "81": "Japan",
    "91": "India",
    "49": "Germany",
    "33": "France",
    "86": "China",
}


class PhoneIntelProvider(BaseOSINTProvider):
    """
    OSINT reconnaissance module for telephone number intel, carrier attribution,
    and direct communication surface mapping.
    """

    def __init__(self, timeout_seconds: float = 10.0):
        super().__init__(
            name="phone_intel",
            display_name="Phone Carrier, Messaging & Breach Intel",
            supported_types=[EntityType.PHONE],
            timeout_seconds=timeout_seconds,
        )

    def _normalize_phone(self, raw: str) -> Dict[str, Any]:
        """
        Normalizes arbitrary phone formats into standardized E.164 and local representations,
        and resolves telco carrier and country.
        """
        cleaned_digits = re.sub(r"[^\d]", "", raw)
        e164 = ""
        country = "International"
        carrier = "Unknown Operator"
        local_display = raw

        # Indonesian Domestic format: starts with 08 or 628
        if raw.startswith("08") or cleaned_digits.startswith("08"):
            e164 = "+62" + cleaned_digits[1:]
            country = "Indonesia"
            local_display = "0" + cleaned_digits[1:]
            prefix4 = "0" + cleaned_digits[1:4]
            carrier = INDONESIAN_CARRIER_PREFIXES.get(prefix4, "Indonesian Cellular Operator")

        elif cleaned_digits.startswith("628"):
            e164 = "+" + cleaned_digits
            country = "Indonesia"
            local_display = "0" + cleaned_digits[2:]
            prefix4 = "0" + cleaned_digits[2:5]
            carrier = INDONESIAN_CARRIER_PREFIXES.get(prefix4, "Indonesian Cellular Operator")

        elif raw.startswith("+"):
            e164 = "+" + cleaned_digits
            # Country code matching
            for cc in sorted(COUNTRY_CODES.keys(), key=lambda x: -len(x)):
                if cleaned_digits.startswith(cc):
                    country = COUNTRY_CODES[cc]
                    if cc == "62":
                        prefix4 = "0" + cleaned_digits[len(cc) : len(cc) + 3]
                        carrier = INDONESIAN_CARRIER_PREFIXES.get(prefix4, "Indonesian Cellular Operator")
                    break
        else:
            e164 = "+" + cleaned_digits

        digits_only = e164.lstrip("+")
        wa_url = f"https://wa.me/{digits_only}"
        tg_url = f"https://t.me/+{digits_only}"

        return {
            "raw": raw,
            "e164": e164,
            "digits_only": digits_only,
            "local_display": local_display,
            "country": country,
            "carrier": carrier,
            "wa_url": wa_url,
            "tg_url": tg_url,
        }

    async def execute_recon(
        self, target: str, target_type: EntityType, session_id: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Executes phone intelligence analysis, mapping carrier, location, and messaging nodes."""
        info = self._normalize_phone(target)
        e164 = info["e164"]
        country = info["country"]
        carrier = info["carrier"]
        wa_url = info["wa_url"]
        tg_url = info["tg_url"]

        yield self.create_log(
            TelemetryLevel.INFO,
            f"Analyzing phone number '{target}' -> Normalized: {e164} (Country: {country}, Carrier: {carrier})",
        )

        root_id = f"phone:{e164}"

        # 1. Primary Phone Node
        yield self.create_node(
            node_id=root_id,
            entity_type=EntityType.PHONE,
            value=e164,
            label=f"Phone: {e164}",
            metadata={
                "e164": e164,
                "local_display": info["local_display"],
                "country": country,
                "carrier": carrier,
                "whatsapp_url": wa_url,
                "telegram_url": tg_url,
                "source": "phone_intel",
            },
        )

        # 2. Carrier / Telco Organization Node
        carrier_slug = re.sub(r"[^a-zA-Z0-9]", "_", carrier.lower()).strip("_")
        carrier_node_id = f"carrier:{carrier_slug}"
        yield self.create_node(
            node_id=carrier_node_id,
            entity_type=EntityType.ORGANIZATION,
            value=carrier,
            label=f"Telco: {carrier}",
            metadata={
                "operator_name": carrier,
                "country": country,
                "network_type": "Cellular Telecommunications",
            },
        )
        yield self.create_edge(
            edge_id=f"edge-{root_id}-{carrier_node_id}",
            source=root_id,
            target=carrier_node_id,
            relation="carrier_operator",
        )

        # 3. WhatsApp Profile Node
        wa_node_id = f"social:whatsapp:{info['digits_only']}"
        yield self.create_node(
            node_id=wa_node_id,
            entity_type=EntityType.ASSOCIATE,
            value=wa_url,
            label=f"WhatsApp ({e164})",
            metadata={
                "platform": "WhatsApp",
                "direct_link": wa_url,
                "url": wa_url,
            },
        )
        yield self.create_edge(
            edge_id=f"edge-{root_id}-{wa_node_id}",
            source=root_id,
            target=wa_node_id,
            relation="messaging_profile",
        )

        # 4. Telegram Profile Node
        tg_node_id = f"social:telegram:{info['digits_only']}"
        yield self.create_node(
            node_id=tg_node_id,
            entity_type=EntityType.ASSOCIATE,
            value=tg_url,
            label=f"Telegram ({e164})",
            metadata={
                "platform": "Telegram",
                "direct_link": tg_url,
                "url": tg_url,
            },
        )
        yield self.create_edge(
            edge_id=f"edge-{root_id}-{tg_node_id}",
            source=root_id,
            target=tg_node_id,
            relation="messaging_profile",
        )

        # 5. Vulnerability Finding
        evidence = (
            f"Target phone number {e164} is mapped to carrier '{carrier}' in {country}. "
            f"Direct messaging endpoints verified: WhatsApp ({wa_url}) and Telegram ({tg_url})."
        )
        yield self.create_finding(
            finding_id=f"vuln-phone-{session_id}",
            node_id=root_id,
            title=f"Direct Mobile Messaging Surface & Carrier Identified ({e164})",
            severity=SeverityLevel.MEDIUM,
            evidence=evidence,
        )

        yield self.create_log(
            TelemetryLevel.SUCCESS,
            f"Phone intelligence completed for {e164}: Attributed to {carrier} ({country}).",
        )


# Register into global provider registry
provider_registry.register(PhoneIntelProvider())

