export interface Transaction {
  amount: number;
  currency: string;
  originAccount: string;
  beneficiaryAccount: string;
  beneficiaryName: string;
  beneficiaryCountry: string;
  transactionType: string;
}

export interface Customer {
  customerId: string;
  name: string;
  country: string;
  riskRating: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ScreeningResult {
  screeningId: string;
  transactionId: string;
  status: 'PASS' | 'FLAG';
  rulesMatched: string[];
  riskScore: number;
  details: Record<string, unknown>;
}

export interface Case {
  caseId: string;
  transactionId: string;
  screeningId: string;
  status: 'OPEN' | 'IN_REVIEW' | 'ESCALATED' | 'CLOSED';
  assignedTo: string;
  assignedType: 'AI' | 'HUMAN';
  reason: string;
  riskScore: number;
}

export interface HumanDecision {
  decision: 'APPROVED' | 'REJECTED';
  reviewer: string;
  notes: string;
}

export interface ScreeningWorkflowInput {
  transactionId: string;
  transaction: Transaction;
  customer: Customer;
}

export interface ScreeningWorkflowResult {
  workflowId: string;
  transactionId: string;
  status: 'PASSED' | 'FLAGGED' | 'ESCALATED' | 'CLOSED';
  caseId?: string;
  decision?: 'APPROVED' | 'REJECTED';
  riskScore: number;
}
