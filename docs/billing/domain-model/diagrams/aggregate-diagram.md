# Aggregate Diagram — Billing Domain

> **Document Type:** Architecture Diagram (Mermaid)
> **Last Updated:** 2026-07-20

## Aggregate Boundary & Relationship Diagram

```mermaid
graph TB
    subgraph "Invoice Aggregate"
        INV[Invoice<br/>Aggregate Root]
        LI[LineItem<br/>Child Entity]
        ISH[InvoiceStatusHistory<br/>Child Entity]
        INV --> LI
        INV -.-> ISH
    end

    subgraph "Payment Aggregate"
        PAY[Payment<br/>Aggregate Root]
        PA[PaymentAllocation<br/>Child Entity]
        PAY --> PA
    end

    subgraph "Receipt Aggregate"
        REC[Receipt<br/>Aggregate Root]
    end

    subgraph "CreditNote Aggregate<br/>(Phase 2)"
        CN[CreditNote<br/>Aggregate Root]
    end

    subgraph "PatientCredit Aggregate"
        PC[PatientCredit<br/>Aggregate Root]
    end

    subgraph "DocumentSequence Aggregate"
        DS[DocumentSequence<br/>Aggregate Root]
        SCL[SequenceConsumptionLog<br/>Child Entity]
        DS --> SCL
    end

    subgraph "External Modules"
        PAT[Patient<br/>Module]
        TP[Treatment Plan<br/>Module]
        USR[User<br/>Module]
    end

    PAY -.->|Allocates to| INV
    REC -.->|References| PAY
    REC -.->|References| INV
    CN -.->|Corrects| INV
    PC -.->|Originates from| PAY
    PC -.->|Originates from| CN

    INV -.->|References by ID| PAT
    INV -.->|References by ID| TP
    INV -.->|References by ID| USR
    PAY -.->|References by ID| PAT
    PAY -.->|References by ID| USR
    CN -.->|References by ID| PAT
    DS -.->|Numbers| INV
    DS -.->|Numbers| PAY
    DS -.->|Numbers| REC
    DS -.->|Numbers| CN

    classDef aggregate fill:#4a90d9,stroke:#2c5f8a,color:#fff
    classDef child fill:#6ab0f3,stroke:#4a90d9,color:#fff
    classDef external fill:#f5f5f5,stroke:#999,color:#333
    classDef utility fill:#e8dff5,stroke:#6a4c93,color:#333

    class INV,PAY,REC,CN,PC,DS aggregate
    class LI,ISH,PA,SCL child
    class PAT,TP,USR external
```

## Legend

| Shape | Meaning |
|---|---|
| Blue filled box | Aggregate root |
| Light blue filled box | Child entity (owned by aggregate) |
| White box with border | External module (not owned by Billing) |
| Purple filled box | Utility aggregate |
| Solid arrow | Composition (child → parent) |
| Dotted arrow | Reference (cross-aggregate or cross-module) |

## Cross-Reference

| Direction | Document |
|---|---|
| **Part of** | [11-aggregate-design.md](../11-aggregate-design.md) |
| **Related** | [12-entity-relationships.md](../12-entity-relationships.md) |
