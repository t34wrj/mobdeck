# Data Layer

This layer implements the repository interfaces defined in the domain layer and handles all data operations.

## Structure

- **datasources/**: Remote (API) and local (SQLite) data sources
- **repositories/**: Concrete implementations of domain repository interfaces
- **models/**: Data transfer objects and database models

## Responsibilities

- API communication with Readeck servers
- Local SQLite database operations
- Data transformation between API/DB models and domain entities
- Caching and synchronization logic