# Repository Layer Architecture

## System Flow

The repository layer implements a clean three-tier architecture separating HTTP handling, business logic, and data access.

```
┌─────────────────────────────────────────────────────────────┐
│                      HTTP Request                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Controller (HTTP Layer)                                     │
│  - Extract params/body/query                                 │
│  - Call service methods                                      │
│  - Return ApiResponse with DTO                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Service (Business Logic)                                    │
│  - Validate business rules                                   │
│  - Call repository methods                                   │
│  - Convert Entity → DTO                                      │
│  - Handle transactions                                       │
│  - Log activities                                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Repository (Data Access)                                    │
│  - Execute SQL queries                                       │
│  - Return Entity objects                                     │
│  - Handle soft deletes                                       │
│  - Support transactions                                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL Database                                         │
└─────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Repository Pattern Over ORM

**Decision**: Use Repository Pattern with raw SQL instead of an ORM (like TypeORM or Prisma).

**Rationale**:
- **Performance**: Direct SQL queries provide better control over query optimization
- **Flexibility**: Complex queries (dashboard ranking, threaded comments) are easier with raw SQL
- **Learning Curve**: Team already familiar with SQL and pg driver
- **Bundle Size**: No heavy ORM dependencies
- **Migration Path**: Easier to migrate from existing direct SQL usage

**Trade-offs**:
- More boilerplate code (mitigated by base repository)
- Manual type definitions (provides better control)
- No automatic migrations (we use manual SQL migrations)

### 2. Entity → DTO Conversion in Services

**Decision**: Repositories return raw Entity objects, Services convert to DTOs.

**Rationale**:
- **Separation of Concerns**: Data access layer doesn't know about API response format
- **Flexibility**: Same entity can be converted to different DTOs for different endpoints
- **Type Safety**: Explicit conversion makes data transformation visible
- **Testability**: Easy to test entity-to-DTO conversion separately

**Example**:
```typescript
// Repository returns Entity
const task: Task = await taskRepository.findById(id);

// Service converts to DTO
const taskDTO: TaskDTO = {
  id: task.id,
  title: task.title,
  created_at: task.created_at.toISOString(), // Date → string
  // ... other fields
};
```

### 3. Soft Delete by Default

**Decision**: Implement soft delete for tasks, comments, and workspaces.

**Rationale**:
- **Data Recovery**: Users can recover accidentally deleted items
- **Audit Trail**: Maintain history even after deletion
- **Referential Integrity**: Activity logs can reference deleted entities
- **Compliance**: Some regulations require data retention

**Implementation**:
- `deleted_at` column (NULL = active, timestamp = deleted)
- Repositories filter `deleted_at IS NULL` by default
- `includeDeleted` option for admin queries
- `restore()` method to undelete records

**Trade-offs**:
- Slightly more complex queries
- Need to handle deleted records in joins
- Database size grows over time (mitigated by archival strategy)

### 4. Transaction Support at Repository Level

**Decision**: Provide transaction support through `executeInTransaction()` method.

**Rationale**:
- **Atomicity**: Complex operations (create task + log activity) succeed or fail together
- **Consistency**: Prevent partial updates
- **Isolation**: Concurrent operations don't interfere
- **Simplicity**: Services don't manage connection pooling

**Example**:
```typescript
await taskRepository.executeInTransaction(async (client) => {
  const task = await taskRepository.create(data, client);
  await activityRepository.log(logData, client);
  return task;
});
```

### 5. Activity Logging in Services

**Decision**: Services automatically log activities, not repositories.

**Rationale**:
- **Business Logic**: Activity logging is a business concern, not data access
- **Flexibility**: Services decide what to log based on context
- **Transactions**: Logging happens in same transaction as main operation
- **Separation**: Repositories remain focused on data access

### 6. Singleton Repository Instances

**Decision**: Export singleton instances from `repositories/index.ts`.

**Rationale**:
- **Connection Pooling**: Share single pool across application
- **Simplicity**: No need to instantiate repositories
- **Testability**: Easy to mock in tests
- **Performance**: Avoid creating multiple instances

**Example**:
```typescript
// repositories/index.ts
export const taskRepository = new TaskRepository();

// Usage in service
import { taskRepository } from '../repositories';
const task = await taskRepository.findById(id);
```

## Data Flow Patterns

### Pattern 1: Simple Query
```
Controller → Service → Repository → Database
                ↓
            Entity → DTO
                ↓
            Controller → Response
```

### Pattern 2: Complex Operation with Transaction
```
Controller → Service → Repository.executeInTransaction()
                ↓
            Repository.create() + ActivityRepository.log()
                ↓
            Commit/Rollback
                ↓
            Entity → DTO
                ↓
            Controller → Response
```

### Pattern 3: Query with Filters
```
Controller (extract query params)
    ↓
Service (build TaskQueryOptions)
    ↓
Repository (build SQL with filters)
    ↓
Database (execute query)
    ↓
Repository (return Entity[])
    ↓
Service (map to DTO[])
    ↓
Controller (return Response)
```

## Security Model

### 1. Input Validation
- **Controllers**: Validate request format and types
- **Services**: Validate business rules (e.g., due_date >= start_date)
- **Database**: Enforce constraints (CHECK, UNIQUE, FOREIGN KEY)

### 2. Authorization
- **Middleware**: Extract user from JWT, attach to `req.user`
- **Services**: Check workspace membership, ownership
- **Repositories**: No authorization logic (trust service layer)

### 3. SQL Injection Prevention
- **Parameterized Queries**: All queries use `$1, $2` placeholders
- **No String Concatenation**: Never build SQL with string interpolation
- **Type Safety**: TypeScript prevents passing wrong types

### 4. Soft Delete Security
- **Default Filtering**: Repositories exclude deleted records by default
- **Admin Access**: `includeDeleted` option for privileged operations
- **Cascade Behavior**: Database handles cascading deletes

## Performance Considerations

### 1. Connection Pooling
- Single `Pool` instance shared across repositories
- Max 20 connections (configurable)
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds

### 2. Query Optimization
- **Indexes**: All foreign keys and frequently filtered columns indexed
- **Partial Indexes**: Indexes on `deleted_at IS NULL` for soft delete
- **Composite Indexes**: Multi-column indexes for common queries
- **Query Planning**: Use `EXPLAIN ANALYZE` for complex queries

### 3. Pagination
- **Limit/Offset**: Standard pagination for simple cases
- **Cursor-based**: Consider for large datasets (future enhancement)
- **Default Limits**: Services enforce reasonable defaults (20-50 items)

### 4. Caching Strategy
- **Not Implemented**: No caching in current version
- **Future**: Consider Redis for frequently accessed data
- **Invalidation**: Would need cache invalidation on updates

## Scalability

### Horizontal Scaling
- **Stateless Services**: No in-memory state, can scale horizontally
- **Connection Pooling**: Each instance has own pool
- **Load Balancing**: Standard HTTP load balancing works

### Vertical Scaling
- **Connection Pool Size**: Increase for more concurrent requests
- **Database**: PostgreSQL can handle increased load
- **Monitoring**: Track pool usage, query performance

## Error Handling

### Repository Layer
- Throws database errors (connection, constraint violations)
- No business logic errors
- Passes errors up to service layer

### Service Layer
- Catches repository errors
- Throws `ApiError` for business logic violations
- Provides user-friendly error messages

### Controller Layer
- Uses `catchAsync` wrapper
- Passes errors to error middleware
- Returns standardized error responses

## Future Enhancements

### Potential Improvements
1. **Read Replicas**: Route read queries to replicas
2. **Caching Layer**: Add Redis for frequently accessed data
3. **Query Builder**: Type-safe query builder for complex queries
4. **Audit Logging**: Enhanced activity logging with more details
5. **Soft Delete Archival**: Move old deleted records to archive table
6. **Performance Monitoring**: Track query performance metrics
7. **Connection Pool Monitoring**: Dashboard for pool health

### Migration Path
- All enhancements can be added incrementally
- No breaking changes to existing API
- Backward compatible with current implementation
