# Application Eventing Framework

`services/eventing` is the dependency-free Python foundation for unified technical and business events.

## Usage

Load a design-time definition and build an event at a meaningful decision or system boundary:

```python
import json

from services.eventing import EventBuilder

with open("project/eventing/definitions/payment-declined.v1.json", encoding="utf-8") as file:
    definition = json.load(file)

event = EventBuilder(definition).build(
    action_taken={"actionName": "processPayment", "actionType": "STATE_CHANGING"},
    outcome={"status": "FAILED", "statusCode": "CARD_DECLINED"},
    correlation_id="corr_checkout_123",
    source_application="payments-service",
    payload={"amount": 129.99, "currency": "AUD", "cardLast4": "4242"},
)
```

The builder generates the envelope timestamps and identifiers, removes excluded paths, applies the definition's PII policy, and validates mandatory paths before returning a JSON-serializable dictionary. Transport adapters such as Kafka producers should publish the returned dictionary without changing its shape.

The existing Stage 0 flat Kafka contract remains unchanged until a consumer migration is approved. New producers can adopt this package incrementally.

## Test

```text
python -m unittest services.eventing.test_framework
```