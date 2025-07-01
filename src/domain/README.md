# Domain Layer

This layer contains the core business logic and entities of the Mobdeck application, independent of any external frameworks or implementation details.

## Structure

- **entities/**: Core business entities (Article, User, SyncStatus, etc.)
- **repositories/**: Repository interfaces defining data access contracts
- **usecases/**: Business logic and use cases (FetchArticles, SyncData, etc.)

## Principles

- No dependencies on external frameworks
- Pure TypeScript/JavaScript code
- Defines interfaces that other layers implement
- Contains the core business rules and logic
