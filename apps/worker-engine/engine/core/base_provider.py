"""
ISEEYOU Reconnaissance Engine - Base Provider Architecture (Task 1.1)
Abstract Base Class, lifecycle hooks, resilient error handling,
deterministic risk calculation, and central provider registry.
"""

from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, Any, List, Optional
from datetime import datetime
import re
import time
import httpx
import logging

from engine.models.entities import (
    EntityType,
    SeverityLevel,
    EntityNode,
    EntityEdge,
    VulnerabilityFinding,
    TelemetryLevel,
    TelemetryLog,
    ProviderResultSummary,
    calculate_normalized_risk_score,
)

logger = logging.getLogger("iseeyou.providers")

# Standard RFC-compliant regex patterns for target validation
RE_DOMAIN = re.compile(
    r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$"
)
RE_IPV4 = re.compile(
    r"^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"
)
RE_EMAIL = re.compile(
    r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$"
)
RE_USERNAME = re.compile(r"^@?[a-zA-Z0-9_.\-\s',()]{1,100}$")


class BaseOSINTProvider(ABC):
    """
    Abstract Base Class for all ISEEYOU Reconnaissance Workers.

    Provides standardized:
    - Target validation (`validate_input`)
    - Lifecycle telemetry streaming (`execute`)
    - Risk score calculation (`calculate_risk`)
    - Resilient error handling and connection retries
    - Normalized node and edge construction helpers
    """

    DEFAULT_USER_AGENT = (
        "ISEEYOU-SecurityScanner/1.0 (+https://github.com/felixpalingan/ISEEYOU)"
    )

    def __init__(
        self,
        name: str,
        display_name: Optional[str] = None,
        supported_types: Optional[List[EntityType]] = None,
        timeout_seconds: float = 15.0,
    ):
        self.name = name
        self.display_name = display_name or name.replace("_", " ").title()
        self.supported_types = supported_types or []
        self.timeout_seconds = timeout_seconds

    def can_handle(self, entity_type: EntityType) -> bool:
        """Checks if this provider can process the given EntityType"""
        return entity_type in self.supported_types

    def validate_input(self, target: str, target_type: EntityType) -> bool:
        """
        Validates target syntax according to entity type conventions.
        Subclasses may override this for provider-specific syntax requirements.
        """
        if not target or not isinstance(target, str):
            return False

        target = target.strip()
        if not self.can_handle(target_type):
            return False

        if target_type in (EntityType.DOMAIN, EntityType.SUBDOMAIN):
            return bool(RE_DOMAIN.match(target))
        elif target_type == EntityType.IP:
            return bool(RE_IPV4.match(target))
        elif target_type == EntityType.EMAIL:
            return bool(RE_EMAIL.match(target))
        elif target_type == EntityType.USERNAME:
            return bool(RE_USERNAME.match(target))

        return True

    def calculate_risk(
        self, findings: List[VulnerabilityFinding] | List[SeverityLevel]
    ) -> int:
        """
        Deterministic risk weighting calculation matching shared specifications (0-100)
        """
        return calculate_normalized_risk_score(findings)

    def create_log(
        self,
        level: TelemetryLevel | str,
        message: str,
    ) -> Dict[str, Any]:
        """Creates a standardized log event dictionary"""
        log_level = (
            level if isinstance(level, TelemetryLevel) else TelemetryLevel(str(level).lower())
        )
        log = TelemetryLog(
            module=self.name,
            level=log_level,
            message=message,
        )
        return {"type": "log", "data": log.model_dump()}

    def create_node(
        self,
        node_id: str,
        entity_type: EntityType,
        value: str,
        label: Optional[str] = None,
        severity: SeverityLevel = SeverityLevel.INFO,
        parent_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        is_cluster: bool = False,
        cluster_count: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Creates a standardized node event dictionary"""
        node = EntityNode(
            id=node_id,
            type=entity_type,
            value=value,
            label=label or value,
            severity=severity,
            parent_id=parent_id,
            metadata=metadata or {},
            is_cluster=is_cluster,
            cluster_count=cluster_count,
        )
        return {"type": "node", "data": node.model_dump()}

    def create_edge(
        self,
        edge_id: str,
        source: str,
        target: str,
        relation: str,
        confidence: float = 1.0,
    ) -> Dict[str, Any]:
        """Creates a standardized edge event dictionary"""
        edge = EntityEdge(
            id=edge_id,
            source=source,
            target=target,
            relation=relation,
            confidence=confidence,
        )
        return {"type": "edge", "data": edge.model_dump()}

    def create_finding(
        self,
        finding_id: str,
        node_id: str,
        title: str,
        severity: SeverityLevel,
        evidence: str,
        cve_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Creates a standardized vulnerability finding event dictionary"""
        finding = VulnerabilityFinding(
            id=finding_id,
            node_id=node_id,
            title=title,
            severity=severity,
            evidence=evidence,
            cve_id=cve_id,
        )
        return {"type": "vuln", "data": finding.model_dump()}

    def get_http_client(
        self,
        timeout: Optional[float] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> httpx.AsyncClient:
        """
        Creates an instrumented httpx.AsyncClient with timeout and standard User-Agent
        """
        merged_headers = {
            "User-Agent": self.DEFAULT_USER_AGENT,
            "Accept": "application/json, text/plain, */*",
        }
        if headers:
            merged_headers.update(headers)

        return httpx.AsyncClient(
            timeout=httpx.Timeout(timeout or self.timeout_seconds),
            headers=merged_headers,
            follow_redirects=True,
        )

    @abstractmethod
    async def execute_recon(
        self, target: str, target_type: EntityType, session_id: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Abstract method for concrete provider implementation.
        Must yield event dictionaries:
        - {"type": "log", "data": ...}
        - {"type": "node", "data": ...}
        - {"type": "edge", "data": ...}
        - {"type": "vuln", "data": ...}
        """
        pass

    async def execute(
        self, target: str, target_type: EntityType, session_id: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Template method executing the complete provider lifecycle:
        1. Emits start log
        2. Validates input
        3. Executes recon with graceful exception containment
        4. Emits summary and completion log
        """
        start_time = time.perf_counter()
        target = target.strip()

        yield self.create_log(
            TelemetryLevel.INFO,
            f"Starting {self.display_name} module for [{target_type.value.upper()}]: {target}",
        )

        # Input validation guard
        if not self.validate_input(target, target_type):
            yield self.create_log(
                TelemetryLevel.WARN,
                f"Validation failed for target '{target}' with type '{target_type.value}'. Skipping module.",
            )
            yield {
                "type": "summary",
                "data": ProviderResultSummary(
                    provider_name=self.name,
                    target=target,
                    status="invalid_input",
                ).model_dump(),
            }
            return

        nodes_count = 0
        edges_count = 0
        vulns_count = 0
        collected_severities: List[SeverityLevel] = []

        try:
            async for event in self.execute_recon(target, target_type, session_id):
                event_type = event.get("type")
                if event_type == "node":
                    nodes_count += 1
                elif event_type == "edge":
                    edges_count += 1
                elif event_type == "vuln":
                    vulns_count += 1
                    vuln_data = event.get("data", {})
                    if "severity" in vuln_data:
                        collected_severities.append(
                            SeverityLevel(vuln_data["severity"])
                        )

                yield event

        except httpx.TimeoutException:
            logger.warning(f"Timeout in {self.name} querying {target}")
            yield self.create_log(
                TelemetryLevel.WARN,
                f"Network request timed out after {self.timeout_seconds}s in {self.display_name}. Partial results retained.",
            )
        except httpx.HTTPStatusError as e:
            logger.warning(f"HTTP error in {self.name}: {e}")
            yield self.create_log(
                TelemetryLevel.WARN,
                f"Remote service returned HTTP {e.response.status_code} in {self.display_name}.",
            )
        except Exception as e:
            logger.error(f"Unexpected error in {self.name}: {str(e)}", exc_info=True)
            yield self.create_log(
                TelemetryLevel.ERROR,
                f"Error in {self.display_name}: {str(e)}",
            )

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        risk_impact = self.calculate_risk(collected_severities)

        summary = ProviderResultSummary(
            provider_name=self.name,
            target=target,
            nodes_discovered=nodes_count,
            edges_discovered=edges_count,
            vulnerabilities_found=vulns_count,
            risk_score_impact=risk_impact,
            duration_ms=duration_ms,
            status="completed",
        )

        yield {
            "type": "summary",
            "data": summary.model_dump(),
        }

        yield self.create_log(
            TelemetryLevel.SUCCESS,
            f"Completed {self.display_name} in {duration_ms}ms ({nodes_count} nodes, {vulns_count} findings, +{risk_impact} risk).",
        )


class ProviderRegistry:
    """
    Central registry for reconnaissance providers.
    Allows dynamic lookup and registration across modules.
    """

    def __init__(self):
        self._providers: Dict[str, BaseOSINTProvider] = {}

    def register(self, provider: BaseOSINTProvider) -> None:
        """Registers a provider instance"""
        self._providers[provider.name] = provider
        logger.info(f"Registered OSINT provider: {provider.name}")

    def unregister(self, name: str) -> Optional[BaseOSINTProvider]:
        """Removes a provider from the registry"""
        return self._providers.pop(name, None)

    def get_provider(self, name: str) -> Optional[BaseOSINTProvider]:
        """Gets a provider by unique name"""
        return self._providers.get(name)

    def get_providers_for_type(self, entity_type: EntityType) -> List[BaseOSINTProvider]:
        """Returns all providers that support the given EntityType"""
        return [
            p for p in self._providers.values() if p.can_handle(entity_type)
        ]

    def get_all(self) -> List[BaseOSINTProvider]:
        """Returns all registered providers"""
        return list(self._providers.values())

    def clear(self) -> None:
        """Clears all registered providers (primarily for unit tests)"""
        self._providers.clear()


# Global Singleton Registry
provider_registry = ProviderRegistry()
