# DensCare Documentation Suite

This directory contains the official documentation for the **DensCare Dental Clinic Management System**.

## Documentation Index

| File | Audience | Description |
|------|----------|-------------|
| [`BRD.md`](./BRD.md) | Stakeholders, Product Managers | Business Requirements Document — executive summary, vision, functional/non-functional requirements, workflows, acceptance criteria, and future roadmap |
| [`PROJECT_DOCUMENTATION.md`](./PROJECT_DOCUMENTATION.md) | Developers, DevOps, QA | Comprehensive technical reference — architecture, tech stack, module docs, API reference, database schema, RBAC matrix, validation rules, testing guide, and deployment instructions |
| [`DENSCARE_PROJECT_REPORT.md`](./DENSCARE_PROJECT_REPORT.md) | Clients, Investors | Project audit report with completeness scores, security evaluation, testing report, and business value demonstration |

## Module Design Documentation

| Directory | Contents |
|-----------|----------|
| [`doctor-management/`](./doctor-management/) | 18-phase design documentation for the Doctor Management module, including business analysis, domain analysis, architecture decisions (ADRs), database design, and testing strategy |
| [`treatment/`](./treatment/) | 20-phase design documentation for the Treatment Plan module, including business analysis, domain analysis, database design, state machine specs, validation rules, and risk register |

## Documentation Conventions

- All documents use Markdown with consistent heading hierarchy (`#`, `##`, `###`)
- Diagrams use [Mermaid](https://mermaid.js.org/) syntax for ER diagrams, flowcharts, and state diagrams
- Code examples use JSON syntax highlighting
- Tables are used for structured data presentation
- API endpoints are grouped by module with clear auth/role annotations

## How to Contribute

1. Update the relevant module documentation when adding new features
2. Update `PROJECT_DOCUMENTATION.md` for technical changes (API, schema, etc.)
3. Update `BRD.md` for business-level changes (requirements, workflows)
4. Keep the changelog section in `PROJECT_DOCUMENTATION.md` current
5. Run Mermaid diagrams through a validator to ensure syntax correctness

## Document Versioning

| Document | Current Version | Last Updated |
|----------|----------------|--------------|
| `BRD.md` | 1.0.0 | July 16, 2026 |
| `PROJECT_DOCUMENTATION.md` | 2.0.0 | July 16, 2026 |
| `DENSCARE_PROJECT_REPORT.md` | 1.0 | — |
