import abc
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

@dataclass
class Event:
    id: str
    type: str
    payload: Dict[str, Any]
    timestamp: datetime

@dataclass
class EntityProfile:
    entity_id: str
    attributes: Dict[str, Any]
    risk_score: float = 0.0
    flags: List[str] = field(default_factory=list)

class Component(abc.ABC):
    @abc.abstractmethod
    def process(self, data: Any) -> Any:
        raise NotImplementedError

class SourceSystem(Component):
    def process(self, data: List[Dict[str, Any]]) -> List[Event]:
        events = []
        for item in data:
            event = Event(
                id=item.get('id', f"evt-{len(events)+1}"),
                type=item.get('type', 'transaction'),
                payload=item,
                timestamp=item.get('timestamp', datetime.utcnow())
            )
            events.append(event)
        return events

class KYCData(Component):
    def process(self, data: List[Dict[str, Any]]) -> Dict[str, EntityProfile]:
        profiles = {}
        for record in data:
            eid = record['entity_id']
            profiles[eid] = EntityProfile(entity_id=eid, attributes=record)
        return profiles

class SanctionsList(Component):
    def __init__(self, watchlist: List[Dict[str, Any]]):
        self.watchlist = watchlist

    def process(self, data: List[Event]) -> List[Dict[str, Any]]:
        results = []
        for event in data:
            match = any(self.matches(event.payload, item) for item in self.watchlist)
            results.append({
                'event_id': event.id,
                'sanctions_match': match,
                'match_details': event.payload if match else None
            })
        return results

    def matches(self, payload: Dict[str, Any], watch_item: Dict[str, Any]) -> bool:
        return payload.get('counterparty_name') == watch_item.get('name')

class PEPData(Component):
    def __init__(self, pep_list: List[Dict[str, Any]]):
        self.pep_list = pep_list

    def process(self, data: List[Event]) -> List[Dict[str, Any]]:
        results = []
        for event in data:
            match = any(self.matches(event.payload, item) for item in self.pep_list)
            results.append({
                'event_id': event.id,
                'pep_match': match,
                'pep_details': event.payload if match else None
            })
        return results

    def matches(self, payload: Dict[str, Any], pep_item: Dict[str, Any]) -> bool:
        return payload.get('customer_name') == pep_item.get('name')

class ExternalRiskData(Component):
    def process(self, data: List[Event]) -> List[Dict[str, Any]]:
        results = []
        for event in data:
            results.append({
                'event_id': event.id,
                'device_risk': 0.2,
                'geo_risk': 0.1,
                'bureau_risk': 0.3
            })
        return results

class RealTimeStream(Component):
    def process(self, data: List[Event]) -> List[Event]:
        return data

class BatchETL(Component):
    def process(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return data

class DataLake(Component):
    def process(self, data: Any) -> Any:
        return data

class EntityResolution(Component):
    def process(self, profiles: Dict[str, EntityProfile]) -> Dict[str, EntityProfile]:
        return profiles

class ReferenceDataMgmt(Component):
    def process(self, data: Any) -> Any:
        return data

class SanctionsScreeningEngine(Component):
    def process(self, data: List[Event]) -> List[Dict[str, Any]]:
        results = []
        for event in data:
            results.append({
                'event_id': event.id,
                'sanctions_score': 0.8,
                'reasons': ['name fuzzy match']
            })
        return results

class FraudDetectionEngine(Component):
    def process(self, data: List[Event]) -> List[Dict[str, Any]]:
        results = []
        for event in data:
            results.append({
                'event_id': event.id,
                'fraud_score': 0.65,
                'reasons': ['high velocity', 'device risk']
            })
        return results

class SharedRiskScoring(Component):
    def process(self, sanctions_results: List[Dict[str, Any]], fraud_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        merged = []
        fraud_map = {r['event_id']: r for r in fraud_results}
        for sanction in sanctions_results:
            fraud = fraud_map.get(sanction['event_id'], {})
            merged.append({
                'event_id': sanction['event_id'],
                'composite_score': (sanction['sanctions_score'] + fraud.get('fraud_score', 0.0)) / 2,
                'sanctions': sanction,
                'fraud': fraud
            })
        return merged

class AlertAggregation(Component):
    def process(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return data

class PrioritizationTriage(Component):
    def process(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        for item in data:
            item['priority'] = 'high' if item['composite_score'] > 0.6 else 'medium'
        return data

class CaseManagementSystem(Component):
    def process(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return [{'case_id': f'case-{item["event_id"]}', **item} for item in data]

class AnalystWorkbenchUI(Component):
    def process(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        return {'view': data}

class FilingModule(Component):
    def process(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return [{'filing_id': f'file-{item["event_id"]}', **item} for item in data]

class AuditTrail(Component):
    def process(self, data: Any) -> Any:
        return data

class ModelRiskMgmt(Component):
    def process(self, data: Any) -> Any:
        return data

class RegulatoryReporting(Component):
    def process(self, data: Any) -> Any:
        return data
