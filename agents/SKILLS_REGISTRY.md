# Agent Skills Registry

Sourced from the AI Agent Development roadmap. Each agent's `AGENT.md` lists its relevant skills under `## Skills`, and `config.json` carries them as a flat `skills` array (e.g., `"agent_skills.rag"`).

---

## Foundations

| Skill | Description |
|-------|-------------|
| **Python** | Python programming language for services, agents, and scripting |
| **JavaScript** | JavaScript for frontend and Node.js agent runtime |
| **Git** | Git version control for agent artifacts, handoffs, and change log |

---

## LLMs

| Skill | Description |
|-------|-------------|
| **OpenAI GPT** | OpenAI GPT API integration for agent reasoning |
| **Claude** | Anthropic Claude API integration for agent reasoning |
| **Gemini** | Google Gemini API integration for agent reasoning |
| **Llama** | Meta Llama local/API integration for self-hosted inference |

---

## AI Frameworks

| Skill | Description |
|-------|-------------|
| **LangChain** | LangChain for agent/chain orchestration and tool use |
| **LangGraph** | LangGraph for stateful multi-agent workflows |
| **LlamaIndex** | LlamaIndex for document indexing and RAG pipelines |

---

## Agent Skills

| Skill | Description |
|-------|-------------|
| **Prompt Engineering** | Prompt Engineering for reliable, structured LLM outputs |
| **Tool Calling** | Tool Calling to dispatch to external systems and APIs |
| **Function Calling** | Function Calling via LLM structured output schemas |
| **RAG** | Retrieval-Augmented Generation over documents and knowledge bases |
| **Memory** | Agent Memory — short-term context and long-term knowledge persistence |
| **Multi-Agent Systems** | Multi-Agent Systems design, coordination, and handoff protocols |

---

## Databases

| Skill | Description |
|-------|-------------|
| **Vector DB (Pinecone)** | Hosted similarity search for production RAG |
| **ChromaDB** | Embedded vector store for local RAG |
| **FAISS** | In-process vector index for high-performance similarity search |
| **PostgreSQL** | Relational database for structured persistence |

---

## APIs

| Skill | Description |
|-------|-------------|
| **REST API** | REST API design and implementation (Flask/FastAPI) |
| **GraphQL** | GraphQL API design and implementation |
| **MCP** | Model Context Protocol for exposing tools to LLM runtimes |

---

## Deployment

| Skill | Description |
|-------|-------------|
| **Docker** | Docker containerization and Docker Compose local stacks |
| **FastAPI** | FastAPI Python async web framework |
| **Vercel** | Vercel frontend deployment |
| **AWS** | AWS cloud infrastructure (ECS, RDS, S3, Lambda, etc.) |

---

## Agent Skill Coverage Summary

| Agent | Foundations | LLMs | AI Frameworks | Agent Skills | Databases | APIs | Deployment |
|-------|-------------|------|---------------|--------------|-----------|------|------------|
| 00-implementation-manager | Python, Git | GPT, Claude, Gemini, Llama | LangChain, LangGraph, LlamaIndex | All 6 | — | REST, MCP | — |
| 01-business-analyst | Python, Git | — | — | Prompt Eng, RAG | — | REST | — |
| 02-solution-architect | Python, JS, Git | All 4 | All 3 | All 6 | All 4 | All 3 | Docker, FastAPI, AWS |
| 03-ui-ux-designer | JS, Git | — | — | — | — | REST, GraphQL | Vercel |
| 04-frontend-engineer | JS, Git | — | — | — | — | REST, GraphQL | Vercel |
| 05-backend-engineer | Python, Git | GPT, Claude | LangChain, LangGraph | Prompt, Tool, Func, RAG | PostgreSQL | REST, GraphQL, MCP | Docker, FastAPI |
| 06-database-engineer | Python, Git | — | — | — | All 4 | REST | — |
| 07-integration-engineer | Python, JS, Git | — | — | Tool, Function | — | REST, GraphQL, MCP | Docker |
| 08-devops-engineer | Python, Git | — | — | — | — | REST | Docker, FastAPI, Vercel, AWS |
| 09-security-engineer | Python, Git | — | — | — | — | REST | Docker, AWS |
| 10-qa-engineer | Python, JS, Git | — | — | Prompt Eng | — | REST | — |
| 11-performance-engineer | Python, Git | — | — | — | PostgreSQL | REST | Docker |
| 12-documentation-engineer | Python, JS, Git | — | — | Prompt Eng, RAG | — | REST, MCP | — |
| 13-release-manager | Python, Git | — | — | — | — | — | Docker, AWS |
| 14-product-owner | Git | — | — | Prompt Eng, Multi-Agent | — | — | — |
| 15-sanctions-screening-sme | Python, Git | — | — | RAG | PostgreSQL | REST | — |
| 16-fraud-detection-sme | Python, Git | GPT, Claude | — | RAG, Function | Pinecone, PostgreSQL | REST | — |
| 17-payments-messaging-sme | Python, Git | — | — | — | — | REST, MCP | Docker |
| 18-regulatory-compliance-sme | Python, Git | — | — | RAG | PostgreSQL | REST | — |
| 19-data-architecture-database-sme | Python, Git | — | — | — | All 4 | REST | — |
| 20-search-opensearch-sme | Python, Git | — | — | RAG | Pinecone, Chroma, FAISS | REST | — |
| 21-streaming-messaging-infra-sme | Python, Git | — | — | — | — | REST | Docker, AWS |
| 22-cloud-aws-sme | Python, Git | — | — | — | — | REST | Docker, FastAPI, AWS |
| 23-security-identity-sme | Python, Git | — | — | — | — | REST, MCP | Docker, AWS |
| 24-case-management-ux-sme | JS, Git | — | — | — | — | REST, GraphQL | Vercel |
| 25-infrastructure-platform-engineer | Python, Git | — | — | — | — | REST, MCP | Docker, AWS |
| 26-backend-ingestion-streaming | Python, Git | — | — | Tool Calling | PostgreSQL | REST | Docker |
| 27-backend-detection-services | Python, Git | GPT, Claude, Llama | All 3 | Prompt, Tool, Func, RAG, Memory | All 4 | REST, MCP | Docker, FastAPI |
| 28-backend-data-persistence | Python, Git | — | — | — | PostgreSQL | REST | Docker |
| 29-frontend-gui-developer | JS, Git | — | — | — | — | REST, GraphQL | Vercel |
| 30-devops-release-engineer | Python, Git | — | — | — | — | — | Docker, AWS |
| 31-test-automation-engineer | Python, JS, Git | — | — | Prompt Eng | — | REST | — |
| 32-test-manager | Python, Git | — | — | Prompt Eng | — | REST | — |
| 33-security-compliance-engineer | Python, Git | — | — | — | — | REST | Docker, AWS |
| 34-technical-writer | Python, JS, Git | — | — | Prompt Eng, RAG | — | REST, MCP | — |
