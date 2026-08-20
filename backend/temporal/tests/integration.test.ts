import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { screeningWorkflow } from '../src/workflow';
import type { HumanDecision, ScreeningWorkflowInput } from '../src/types';

const input: ScreeningWorkflowInput = {
  transactionId: 'txn-integration-001',
  transaction: {
    amount: 15000,
    currency: 'USD',
    originAccount: 'ACC-001',
    beneficiaryAccount: 'ACC-002',
    beneficiaryName: 'John Doe',
    beneficiaryCountry: 'US',
    transactionType: 'WIRE_TRANSFER',
  },
  customer: {
    customerId: 'CUST-001',
    name: 'Jane Smith',
    country: 'US',
    riskRating: 'HIGH',
  },
};

describe('ScreeningWorkflow integration', () => {
  let testEnv: TestWorkflowEnvironment;
  const auditEvents: string[] = [];

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  beforeEach(() => auditEvents.splice(0));

  async function createWorker(): Promise<Worker> {
    return Worker.create({
      connection: testEnv.nativeConnection,
      workflowsPath: require.resolve('../src/workflow'),
      taskQueue: 'hsfs-screening-test',
      activities: {
        runScreening: async () => ({
          screeningId: '00000000-0000-0000-0000-000000000010',
          transactionId: input.transactionId,
          status: 'FLAG' as const,
          rulesMatched: ['RULE-001', 'RULE-002'],
          riskScore: 80,
          details: {},
        }),
        createCase: async () => ({
          caseId: '00000000-0000-0000-0000-000000000020',
          transactionId: input.transactionId,
          screeningId: '00000000-0000-0000-0000-000000000010',
          status: 'OPEN' as const,
          assignedTo: 'ai-triage-001',
          assignedType: 'AI' as const,
          reason: 'Flagged by rules: RULE-001, RULE-002',
          riskScore: 80,
        }),
        assignToAgent: async () => ({
          decision: 'ESCALATE' as const,
          confidence: 0.65,
          reasoning: 'Human review required',
        }),
        logAuditRecord: async (eventType: string) => {
          auditEvents.push(eventType);
        },
        closeCase: async () => undefined,
        escalateCase: async () => undefined,
      },
    });
  }

  it('flows through screening, case creation, human approval, and audit', async () => {
    const worker = await createWorker();
    const result = await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start(screeningWorkflow, {
        workflowId: 'screening-integration-approved',
        taskQueue: 'hsfs-screening-test',
        args: [input],
      });

      await testEnv.sleep('1 second');
      const decision: HumanDecision = {
        decision: 'APPROVED',
        reviewer: 'analyst-001',
        notes: 'Transaction verified',
      };
      await handle.signal('humanReview', decision);
      return handle.result();
    });

    expect(result).toMatchObject({
      status: 'CLOSED',
      decision: 'APPROVED',
      transactionId: input.transactionId,
      riskScore: 80,
    });
    expect(auditEvents).toEqual([
      'case.created',
      'case.triage.completed',
      'case.closed',
    ]);
  });

  it('auto-escalates when the human-review SLA expires', async () => {
    const worker = await createWorker();
    const result = await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start(screeningWorkflow, {
        workflowId: 'screening-integration-timeout',
        taskQueue: 'hsfs-screening-test',
        args: [input],
      });
      return handle.result();
    });

    expect(result.status).toBe('ESCALATED');
    expect(auditEvents).toContain('case.sla.timeout');
    expect(auditEvents).toContain('case.escalated');
  });
});
