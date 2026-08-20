/**
 * Shared Kafka event schemas for the AISENA HSFS backend.
 */

export interface ScreeningRequested {
  eventId: string;
  transactionId: string;
  occurredAt: string;
  transaction: {
    amount: number;
    currency: string;
    originAccount: string;
    beneficiaryAccount: string;
    beneficiaryName: string;
    beneficiaryCountry: string;
    transactionType: string;
  };
  customer: {
    customerId: string;
    name: string;
    country: string;
    riskRating: 'LOW' | 'MEDIUM' | 'HIGH';
  };
}

export interface ScreeningCompleted {
  eventId: string;
  transactionId: string;
  screeningId: string;
  occurredAt: string;
  status: 'PASS' | 'FLAG';
  rulesMatched: string[];
  riskScore: number;
  details: Record<string, unknown>;
}

export interface CaseCreated {
  eventId: string;
  caseId: string;
  transactionId: string;
  screeningId: string;
  occurredAt: string;
  status: 'OPEN' | 'IN_REVIEW' | 'ESCALATED' | 'CLOSED';
  assignedTo: string;
  assignedType: 'AI' | 'HUMAN';
  reason: string;
  riskScore: number;
}

export interface CaseEscalated {
  eventId: string;
  caseId: string;
  transactionId: string;
  occurredAt: string;
  reason: string;
  escalatedTo: string;
  notes: string;
}

export interface CaseClosed {
  eventId: string;
  caseId: string;
  transactionId: string;
  occurredAt: string;
  decision: 'APPROVED' | 'REJECTED';
  reviewer: string;
  notes: string;
}

export const screeningRequested: object;
export const screeningCompleted: object;
export const caseCreated: object;
export const caseEscalated: object;
export const caseClosed: object;

export const topicSchemas: Record<string, object>;
