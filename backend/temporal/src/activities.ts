/**
 * Temporal Activities for the HSFS Screening Workflow.
 *
 * Activities are the building blocks of Temporal workflows. Each activity
 * performs a discrete unit of work and can be retried independently.
 */

import { ScreeningWorkflowInput, ScreeningResult, Case, HumanDecision } from './types';
import axios from 'axios';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// Service endpoints (configurable via environment)
const SCREENING_ENGINE_URL = process.env.SCREENING_ENGINE_URL || 'http://screening-engine:3002';
const CASE_MANAGEMENT_URL = process.env.CASE_MANAGEMENT_URL || 'http://case-management:3003';
const AUDIT_NOTIFICATION_URL = process.env.AUDIT_NOTIFICATION_URL || 'http://audit-notification:3005';

// Retry policy for transient failures (e.g., external sanctions list lookups)
export const screeningRetryPolicy = {
  maximumAttempts: 5,
  initialInterval: 1000, // 1 second
  backoffCoefficient: 2,
  maximumInterval: 30000, // 30 seconds
  nonRetryableErrorTypes: ['ValidationError'],
};

export const caseManagementRetryPolicy = {
  maximumAttempts: 3,
  initialInterval: 2000,
  backoffCoefficient: 2,
  maximumInterval: 15000,
};

export const auditRetryPolicy = {
  maximumAttempts: 3,
  initialInterval: 1000,
  backoffCoefficient: 2,
  maximumInterval: 10000,
};

/**
 * Activity: Run screening-engine check.
 * Calls the screening-engine REST API to evaluate a transaction.
 */
export async function runScreening(input: ScreeningWorkflowInput): Promise<ScreeningResult> {
  logger.info('Running screening', { transactionId: input.transactionId });

  try {
    const response = await axios.post(`${SCREENING_ENGINE_URL}/api/screen`, {
      transaction: input.transaction,
      customer: input.customer,
    }, {
      timeout: 10000,
    });

    const result: ScreeningResult = response.data;
    logger.info('Screening completed', {
      transactionId: input.transactionId,
      status: result.status,
      riskScore: result.riskScore,
    });

    return result;
  } catch (err) {
    logger.error('Screening failed', { transactionId: input.transactionId, error: err });
    throw err;
  }
}

/**
 * Activity: Log audit record.
 * Sends an audit event to the audit-notification service.
 */
export async function logAuditRecord(
  eventType: string,
  details: Record<string, unknown>
): Promise<void> {
  logger.info('Logging audit record', { eventType });

  try {
    await axios.post(`${AUDIT_NOTIFICATION_URL}/api/audit`, {
      eventType,
      details,
      timestamp: new Date().toISOString(),
    }, {
      timeout: 5000,
    });

    logger.info('Audit record logged', { eventType });
  } catch (err) {
    logger.error('Audit logging failed', { eventType, error: err });
    throw err;
  }
}

/**
 * Activity: Create case in case-management.
 * Creates a case for a flagged transaction.
 */
export async function createCase(
  transactionId: string,
  screeningId: string,
  reason: string,
  riskScore: number
): Promise<Case> {
  logger.info('Creating case', { transactionId, screeningId });

  try {
    const response = await axios.post(`${CASE_MANAGEMENT_URL}/api/cases`, {
      transactionId,
      screeningId,
      reason,
      riskScore,
      assignedTo: 'ai-triage-001',
      assignedType: 'AI',
    }, {
      timeout: 10000,
    });

    const caseData: Case = response.data;
    logger.info('Case created', { caseId: caseData.caseId, transactionId });

    return caseData;
  } catch (err) {
    logger.error('Case creation failed', { transactionId, error: err });
    throw err;
  }
}

/**
 * Activity: Assign case to agent-runtime for AI triage.
 * Notifies the agent-runtime service to perform AI triage on the case.
 */
export async function assignToAgent(caseId: string, transactionId: string): Promise<{
  decision: 'APPROVE' | 'REJECT' | 'ESCALATE';
  confidence: number;
  reasoning: string;
}> {
  logger.info('Assigning case to AI agent', { caseId, transactionId });

  // In production, this would call the agent-runtime service
  // For now, we simulate the AI triage by calling the agent-runtime API
  try {
    const response = await axios.post(`${process.env.AGENT_RUNTIME_URL || 'http://agent-runtime:3001'}/api/triage`, {
      caseId,
      transactionId,
    }, {
      timeout: 15000,
    });

    logger.info('AI triage completed', { caseId, decision: response.data.decision });
    return response.data;
  } catch (err) {
    logger.error('AI triage failed', { caseId, error: err });
    // Fallback: simulate a triage decision
    return {
      decision: 'ESCALATE',
      confidence: 0.5,
      reasoning: 'AI triage service unavailable, escalating for human review',
    };
  }
}

/**
 * Activity: Close case.
 * Updates the case status to CLOSED with the human decision.
 */
export async function closeCase(
  caseId: string,
  decision: HumanDecision
): Promise<void> {
  logger.info('Closing case', { caseId, decision: decision.decision });

  try {
    await axios.patch(`${CASE_MANAGEMENT_URL}/api/cases/${caseId}/status`, {
      status: 'CLOSED',
      decision: decision.decision,
      reviewer: decision.reviewer,
      notes: decision.notes,
    }, {
      timeout: 10000,
    });

    logger.info('Case closed', { caseId, decision: decision.decision });
  } catch (err) {
    logger.error('Case closure failed', { caseId, error: err });
    throw err;
  }
}

/**
 * Activity: Escalate case.
 * Escalates the case to the compliance team.
 */
export async function escalateCase(
  caseId: string,
  reason: string,
  notes: string
): Promise<void> {
  logger.info('Escalating case', { caseId, reason });

  try {
    await axios.patch(`${CASE_MANAGEMENT_URL}/api/cases/${caseId}/status`, {
      status: 'ESCALATED',
      reviewer: 'compliance-team',
      notes,
    }, {
      timeout: 10000,
    });

    logger.info('Case escalated', { caseId });
  } catch (err) {
    logger.error('Case escalation failed', { caseId, error: err });
    throw err;
  }
}
