import unittest

from .framework import EventBuilder, EventValidationError


class EventFrameworkTests(unittest.TestCase):
    def setUp(self):
        self.definition = {
            "eventDefinitionId": "PAYMENT.DECLINED.v1",
            "eventName": "PAYMENT.DECLINED",
            "category": "BUSINESS",
            "mandatoryFields": [
                "eventEnvelope.eventId",
                "eventEnvelope.eventName",
                "eventEnvelope.category",
                "eventEnvelope.occurredAt",
                "eventEnvelope.correlationId",
                "actionTaken",
                "outcome",
            ],
            "optionalFieldsExcluded": ["context.deviceContext.jsVersion", "payload.embeddedMessage"],
            "piiFields": ["payload.cardLast4"],
            "piiHandling": "MASK",
        }

    def test_builds_self_describing_event_and_applies_definition(self):
        event = EventBuilder(self.definition).build(
            action_taken={"actionName": "processPayment", "actionType": "STATE_CHANGING"},
            outcome={"status": "FAILED", "statusCode": "CARD_DECLINED"},
            context={"deviceContext": {"platform": "ANDROID", "jsVersion": "22"}},
            payload={"cardLast4": "4242", "embeddedMessage": {"body": {"secret": "x"}}},
            source_application="payments-service",
        )

        self.assertEqual(event["eventEnvelope"]["category"], "BUSINESS")
        self.assertEqual(event["payload"]["cardLast4"], "****")
        self.assertNotIn("embeddedMessage", event["payload"])
        self.assertNotIn("jsVersion", event["context"]["deviceContext"])

    def test_rejects_event_without_mandatory_outcome(self):
        with self.assertRaises(EventValidationError):
            EventBuilder(self.definition).build(
                action_taken={"actionName": "processPayment"},
                outcome={},
            )


if __name__ == "__main__":
    unittest.main()