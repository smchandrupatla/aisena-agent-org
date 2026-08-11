from datetime import datetime
from .components import (
    BatchETL,
    CaseManagementSystem,
    EntityResolution,
    ExternalRiskData,
    FilingModule,
    FraudDetectionEngine,
    KYCData,
    ModelRiskMgmt,
    AnalystWorkbenchUI,
    AuditTrail,
    PrioritizationTriage,
    RealTimeStream,
    RegulatoryReporting,
    ReferenceDataMgmt,
    SanctionsList,
    SanctionsScreeningEngine,
    SharedRiskScoring,
    SourceSystem,
    PEPData,
    AlertAggregation,
    DataLake,
)


def run_sample_pipeline():
    raw_transactions = [
        {
            'id': 'txn-001',
            'type': 'transaction',
            'amount': 3450.12,
            'customer_name': 'Alice Johnson',
            'counterparty_name': 'ACME import ltd',
            'timestamp': datetime.utcnow(),
            'entity_id': 'cust-001',
        }
    ]

    raw_kyc = [
        {
            'entity_id': 'cust-001',
            'name': 'Alice Johnson',
            'country': 'US',
            'risk_tier': 'medium'
        }
    ]

    sanctions_watchlist = [
        {'name': 'ACME import ltd', 'list': 'OFAC SDN'}
    ]

    pep_list = [
        {'name': 'Alice Johnson', 'risk': 'medium'}
    ]

    print('1) Source systems ingestion')
    source = SourceSystem()
    events = source.process(raw_transactions)
    print(' events:', events)

    print('2) KYC / entity profiles')
    kyc = KYCData()
    profiles = kyc.process(raw_kyc)
    print(' profiles:', profiles)

    print('3) Sanctions list screening')
    sanctions = SanctionsList(sanctions_watchlist)
    sanctions_results = sanctions.process(events)
    print(' sanctions results:', sanctions_results)

    print('4) PEP / adverse media screening')
    pep = PEPData(pep_list)
    pep_results = pep.process(events)
    print(' pep results:', pep_results)

    print('5) External risk enrichment')
    external = ExternalRiskData()
    external_results = external.process(events)
    print(' external results:', external_results)

    print('6) Real-time stream pass-through')
    realtime = RealTimeStream()
    realtime_events = realtime.process(events)
    print(' realtime events:', realtime_events)

    print('7) Sanctions engine score')
    sanctions_engine = SanctionsScreeningEngine()
    sanctions_engine_results = sanctions_engine.process(realtime_events)
    print(' sanctions engine results:', sanctions_engine_results)

    print('8) Fraud engine score')
    fraud_engine = FraudDetectionEngine()
    fraud_results = fraud_engine.process(realtime_events)
    print(' fraud engine results:', fraud_results)

    print('9) Shared risk scoring')
    shared_scoring = SharedRiskScoring()
    composite_results = shared_scoring.process(sanctions_engine_results, fraud_results)
    print(' composite results:', composite_results)

    print('10) Alert aggregation and dedup')
    alert_agg = AlertAggregation()
    alerts = alert_agg.process(composite_results)
    print(' alerts:', alerts)

    print('11) Prioritization and triage')
    triage = PrioritizationTriage()
    prioritized = triage.process(alerts)
    print(' prioritized alerts:', prioritized)

    print('12) Case management')
    case_system = CaseManagementSystem()
    cases = case_system.process(prioritized)
    print(' cases:', cases)

    print('13) Analyst workbench view')
    ui = AnalystWorkbenchUI()
    view = ui.process(cases)
    print(' analyst view:', view)

    print('14) Filing module')
    filings = FilingModule().process(cases)
    print(' filings:', filings)

    print('15) Audit trail capture')
    audit = AuditTrail()
    audit.process(cases)
    print(' audit captured')

    print('16) Model risk management')
    model_risk = ModelRiskMgmt()
    model_risk.process(filings)
    print(' model risk processed')

    print('17) Regulatory reporting')
    reporting = RegulatoryReporting()
    reporting.process(filings)
    print(' reporting generated')

    return {
        'events': events,
        'profiles': profiles,
        'sanctions_results': sanctions_results,
        'pep_results': pep_results,
        'external_results': external_results,
        'composite_results': composite_results,
        'prioritized': prioritized,
        'cases': cases,
        'filings': filings,
    }
