-- Case Management database schema
CREATE DATABASE case_management;

\c case_management;

CREATE TABLE IF NOT EXISTS cases (
    case_id UUID PRIMARY KEY,
    transaction_id VARCHAR(255) NOT NULL,
    screening_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL,
    assigned_to VARCHAR(255) NOT NULL,
    assigned_type VARCHAR(10) NOT NULL,
    reason TEXT,
    risk_score INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    reviewer VARCHAR(255),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_cases_transaction_id ON cases(transaction_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
