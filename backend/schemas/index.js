'use strict';

/**
 * Shared Kafka event schemas for the AISENA HSFS backend.
 *
 * All services import from this package to avoid contract drift.
 * Each schema is a JSON Schema (draft-07) document.
 */

const screeningRequested = require('./schemas/screening.requested.json');
const screeningCompleted = require('./schemas/screening.completed.json');
const caseCreated = require('./schemas/case.created.json');
const caseEscalated = require('./schemas/case.escalated.json');
const caseClosed = require('./schemas/case.closed.json');

module.exports = {
  screeningRequested,
  screeningCompleted,
  caseCreated,
  caseEscalated,
  caseClosed,
  // Convenience: topic name → schema map
  topicSchemas: {
    'screening.requested': screeningRequested,
    'screening.completed': screeningCompleted,
    'case.created': caseCreated,
    'case.escalated': caseEscalated,
    'case.closed': caseClosed,
  },
};
