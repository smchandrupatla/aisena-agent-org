/**
 * Temporal Workflow: Screening → Escalation
 *
 * Models the core HSFS (High-Speed Financial Screening) process as durable,
 * versioned code:
 *
 *   Transaction received
 *     → Activity: run screening-engine check
 *     → Decision: pass / flag
 *         pass  → Activity: log audit record → complete
 *         flag  → Activity: create case in case-management
 *               → Activity: assign to agent-runtime for AI triage
 *               → Signal wait: human review (with timeout)
 *                   approved  → Activity: close case, log audit
 *                   rejected  → Activity: escalate, notify compliance team
 */

import { proxyActivities, defineSignal, setHandler, condition, defineQuery, workflowInfo } from '@temporalio/workflow';
import type { ScreeningWorkflowInput, ScreeningWorkflowResult, HumanDecision } from './types';

// --- Activities ---
const { runScreening } = proxyActivities<{
  runScreening: typeof import('./activities').runScreening;
}>({
  startToCloseTimeout: '2 minutes',
  retry: {
    maximumAttempts: 5,
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '30s',
    nonRetryableErrorTypes: ['ValidationError'],
  },
});

const {
  logAuditRecord,
  createCase,
  assignToAgent,
  closeCase,
  escalateCase,
} = proxyActivities<{
  runScreening: typeof import('./activities').runScreening;
  logAuditRecord: typeof import('./activities').logAuditRecord;
  createCase: typeof import('./activities').createCase;
  assignToAgent: typeof import('./activities').assignToAgent;
  closeCase: typeof import('./activities').closeCase;
  escalateCase: typeof import('./activities').escalateCase;
}>({
  startToCloseTimeout: '1 minute',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '30s',
  },
});

// --- Signal for human review decision ---
const humanReviewSignal = defineSignal<[HumanDecision]>('humanReview');

// --- Query for workflow status ---
const getWorkflowStatus = defineQuery<{
  status: string;
  caseId?: string;
  decision?: string;
}>('getWorkflowStatus');

// --- Workflow Definition ---
export async function screeningWorkflow(
  input: ScreeningWorkflowInput
): Promise<ScreeningWorkflowResult> {
  const { transactionId } = input;
  let workflowStatus = 'RUNNING';
  let caseId: string | undefined;
  let humanDecision: HumanDecision | undefined;

  setHandler(humanReviewSignal, (decision: HumanDecision) => {
    humanDecision = decision;
    workflowStatus = 'HUMAN_DECISION_RECEIVED';
  });
  setHandler(getWorkflowStatus, () => ({
    status: workflowStatus,
    caseId,
    decision: humanDecision?.decision,
  }));

  // Step 1: Run screening-engine check
  const screeningResult = await runScreening(input);

  // Step 2: Decision — pass or flag
  if (screeningResult.status === 'PASS') {
    // Pass → log audit record → complete
    await logAuditRecord('screening.passed', {
      transactionId,
      screeningId: screeningResult.screeningId,
      riskScore: screeningResult.riskScore,
      rulesMatched: screeningResult.rulesMatched,
    });

    workflowStatus = 'PASSED';
    return {
      workflowId: workflowInfo().workflowId,
      transactionId,
      status: 'PASSED',
      riskScore: screeningResult.riskScore,
    };
  }

  // Flag → create case
  const reason = `Flagged by rules: ${screeningResult.rulesMatched.join(', ')}`;
  const caseData = await createCase(
    transactionId,
    screeningResult.screeningId,
    reason,
    screeningResult.riskScore
  );

  caseId = caseData.caseId;
  workflowStatus = 'CASE_CREATED';

  // Log audit record for case creation
  await logAuditRecord('case.created', {
    caseId: caseData.caseId,
    transactionId,
    screeningId: screeningResult.screeningId,
    riskScore: screeningResult.riskScore,
    reason,
  });

  // Step 3: Assign to agent-runtime for AI triage
  const triageResult = await assignToAgent(caseData.caseId, transactionId);

  workflowStatus = 'AI_TRIAGE_COMPLETED';

  // Log audit record for AI triage
  await logAuditRecord('case.triage.completed', {
    caseId: caseData.caseId,
    transactionId,
    decision: triageResult.decision,
    confidence: triageResult.confidence,
    reasoning: triageResult.reasoning,
  });

  // Step 4: Signal wait for human review (with timeout)
  // SLA window: 5 minutes for human review
  const decisionReceived = await condition(() => humanDecision !== undefined, '5 minutes');

  if (!decisionReceived) {
    // Timeout → auto-escalate
    workflowStatus = 'SLA_TIMEOUT_ESCALATING';
    await logAuditRecord('case.sla.timeout', {
      caseId: caseData.caseId,
      transactionId,
      reason: 'No human response within SLA window',
    });

    await escalateCase(
      caseData.caseId,
      'SLA_TIMEOUT',
      'No human response received within SLA window. Auto-escalated to compliance team.'
    );

    await logAuditRecord('case.escalated', {
      caseId: caseData.caseId,
      transactionId,
      reason: 'SLA_TIMEOUT',
      escalatedTo: 'compliance-team',
    });

    workflowStatus = 'ESCALATED';
    return {
      workflowId: workflowInfo().workflowId,
      transactionId,
      status: 'ESCALATED',
      caseId: caseData.caseId,
      riskScore: screeningResult.riskScore,
    };
  }

  // Step 5: Process human decision
  if (humanDecision!.decision === 'APPROVED') {
    // Approved → close case, log audit
    await closeCase(caseData.caseId, humanDecision!);

    await logAuditRecord('case.closed', {
      caseId: caseData.caseId,
      transactionId,
      decision: 'APPROVED',
      reviewer: humanDecision!.reviewer,
      notes: humanDecision!.notes,
    });

    workflowStatus = 'CLOSED_APPROVED';
    return {
      workflowId: workflowInfo().workflowId,
      transactionId,
      status: 'CLOSED',
      caseId: caseData.caseId,
      decision: 'APPROVED',
      riskScore: screeningResult.riskScore,
    };
  } else {
    // Rejected → escalate, notify compliance team
    await escalateCase(
      caseData.caseId,
      'HUMAN_REJECTED',
      humanDecision!.notes || 'Transaction rejected by human reviewer'
    );

    await logAuditRecord('case.escalated', {
      caseId: caseData.caseId,
      transactionId,
      reason: 'HUMAN_REJECTED',
      escalatedTo: 'compliance-team',
      notes: humanDecision!.notes,
    });

    workflowStatus = 'ESCALATED';
    return {
      workflowId: workflowInfo().workflowId,
      transactionId,
      status: 'ESCALATED',
      caseId: caseData.caseId,
      decision: 'REJECTED',
      riskScore: screeningResult.riskScore,
    };
  }
}
