"""Canonical application event construction and definition enforcement."""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timezone
import re
from typing import Any, Mapping
from uuid import uuid4


class EventValidationError(ValueError):
    """Raised when an event definition or event instance is invalid."""


@dataclass(frozen=True)
class EventDefinition:
    event_definition_id: str
    event_name: str
    category: str
    sub_category: str | None = None
    mandatory_fields: tuple[str, ...] = ()
    optional_fields_included: tuple[str, ...] = ()
    optional_fields_excluded: tuple[str, ...] = ()
    pii_fields: tuple[str, ...] = ()
    pii_handling: str = "EXCLUDE"
    version: str = "1.0.0"
    custom_attributes_allowed: bool = False

    @classmethod
    def from_mapping(cls, definition: Mapping[str, Any]) -> "EventDefinition":
        required = ("eventDefinitionId", "eventName", "category")
        missing = [field for field in required if not definition.get(field)]
        if missing:
            raise EventValidationError(f"Definition missing required fields: {', '.join(missing)}")

        category = str(definition["category"]).upper()
        if category not in {"TECHNICAL", "BUSINESS"}:
            raise EventValidationError("category must be TECHNICAL or BUSINESS")

        pii_handling = str(definition.get("piiHandling", "EXCLUDE")).upper()
        if pii_handling not in {"MASK", "EXCLUDE", "TOKENIZE"}:
            raise EventValidationError("piiHandling must be MASK, EXCLUDE, or TOKENIZE")

        event_name = str(definition["eventName"])
        if not re.fullmatch(r"[A-Z0-9]+(?:\.[A-Z0-9]+)+", event_name):
            raise EventValidationError("eventName must be uppercase and dot-separated")

        def fields(name: str) -> tuple[str, ...]:
            return tuple(str(value) for value in definition.get(name, ()))

        return cls(
            event_definition_id=str(definition["eventDefinitionId"]),
            event_name=event_name,
            category=category,
            sub_category=definition.get("subCategory"),
            mandatory_fields=fields("mandatoryFields"),
            optional_fields_included=fields("optionalFieldsIncluded"),
            optional_fields_excluded=fields("optionalFieldsExcluded"),
            pii_fields=fields("piiFields"),
            pii_handling=pii_handling,
            version=str(definition.get("version", "1.0.0")),
            custom_attributes_allowed=bool(definition.get("customAttributesAllowed", False)),
        )


class EventBuilder:
    """Build a validated event from a design-time event definition."""

    def __init__(self, definition: EventDefinition | Mapping[str, Any]):
        self.definition = (
            definition
            if isinstance(definition, EventDefinition)
            else EventDefinition.from_mapping(definition)
        )

    def build(
        self,
        *,
        action_taken: Mapping[str, Any],
        outcome: Mapping[str, Any],
        trigger: Mapping[str, Any] | None = None,
        context: Mapping[str, Any] | None = None,
        payload: Mapping[str, Any] | None = None,
        telemetry: Mapping[str, Any] | None = None,
        correlation_id: str | None = None,
        causation_id: str | None = None,
        trace_id: str | None = None,
        source_application: str = "unknown",
        source_module: str | None = None,
        environment: str = "DEVELOPMENT",
        occurred_at: datetime | None = None,
    ) -> dict[str, Any]:
        occurred_at = occurred_at or datetime.now(timezone.utc)
        recorded_at = datetime.now(timezone.utc)
        event = {
            "eventEnvelope": {
                "eventId": f"evt_{uuid4()}",
                "eventName": self.definition.event_name,
                "eventVersion": self.definition.version,
                "category": self.definition.category,
                "subCategory": self.definition.sub_category,
                "occurredAt": self._timestamp(occurred_at),
                "recordedAt": self._timestamp(recorded_at),
                "correlationId": correlation_id or f"corr_{uuid4()}",
                "causationId": causation_id,
                "traceId": trace_id,
                "sourceApplication": source_application,
                "sourceModule": source_module,
                "environment": environment,
            },
            "trigger": deepcopy(dict(trigger or {})),
            "actionTaken": deepcopy(dict(action_taken)),
            "outcome": deepcopy(dict(outcome)),
            "context": deepcopy(dict(context or {})),
            "telemetry": deepcopy(dict(telemetry or {})),
            "payload": deepcopy(dict(payload or {})),
        }

        self._remove_paths(event, self.definition.optional_fields_excluded)
        if self.definition.pii_handling == "EXCLUDE":
            self._remove_paths(event, self.definition.pii_fields)
        elif self.definition.pii_handling == "MASK":
            self._mask_paths(event, self.definition.pii_fields)
        elif self.definition.pii_handling == "TOKENIZE":
            self._mask_paths(event, self.definition.pii_fields, prefix="token_")

        missing = [path for path in self.definition.mandatory_fields if not self._has_path(event, path)]
        if missing:
            raise EventValidationError(f"Event missing mandatory fields: {', '.join(missing)}")
        if not event["actionTaken"] or not event["outcome"]:
            raise EventValidationError("actionTaken and outcome are mandatory")
        return event

    @staticmethod
    def _timestamp(value: datetime) -> str:
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")

    @staticmethod
    def _has_path(document: Mapping[str, Any], path: str) -> bool:
        current: Any = document
        for part in path.split("."):
            if not isinstance(current, Mapping) or part not in current or current[part] is None:
                return False
            current = current[part]
        return True

    @staticmethod
    def _remove_paths(document: dict[str, Any], paths: tuple[str, ...]) -> None:
        for path in paths:
            current: Any = document
            parts = path.split(".")
            for part in parts[:-1]:
                if not isinstance(current, dict):
                    break
                current = current.get(part)
            else:
                if isinstance(current, dict):
                    current.pop(parts[-1], None)

    @classmethod
    def _mask_paths(cls, document: dict[str, Any], paths: tuple[str, ...], prefix: str = "") -> None:
        for path in paths:
            current: Any = document
            parts = path.split(".")
            for part in parts[:-1]:
                if not isinstance(current, dict) or part not in current:
                    break
                current = current[part]
            else:
                if isinstance(current, dict) and parts[-1] in current:
                    value = str(current[parts[-1]])
                    current[parts[-1]] = prefix + ("*" * max(4, len(value)))