# Migration Guide

## Running the Soft Delete Migration

### Prerequisites

- Supabase project or PostgreSQL instance running
- Database connection configured in `.env`
- Migrations folder: `backend/src/migrations/`

### Migration File

**Location**: `backend/src/migrations/003_add_soft_delete.sql`

**What it does**:
1. Adds `deleted_at TIMESTAMPTZ` column to `tasks`, `comments`, and `workspaces` tables
2. Creates partial indexes on `deleted_at` for performance
3. Adds comments documenting the soft delete behavior

### Option 1: Supabase SQL Editor

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the contents of `backend/src/migrations/003_add_soft_delete.sql`
5. Paste into the editor
6. Click **Run** or press `Ctrl+Enter`
7. Verify success message

### Option 2: psql Command Line

```bash
# Connect to your database
psql -h your-host -U your-user -d your-database

# Run the migration
\i backend/src/migrations/003_add_soft_delete.sql

# Verify columns were added
\d tasks
\d comments
\d workspaces
```

### Option 3: Node.js Script

Create a migration runner script:

```typescript
// scripts/run-migration.ts
import { readFileSync } from 'fs';
import { join } from 'path';
import pool from '../src/config/pg';

async function runMigration() {
  const migrationPath = join(__dirname, '../src/migrations/003_add_soft_delete.sql');
  const sql = readFileSync(migrationPath, 'utf-8');
  
  try {
    await pool.query(sql);
    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
```

Run with:
```bash
npx ts-node scripts/run-migration.ts
```

### Verification

After running the migration, verify the changes:

```sql
-- Check tasks table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tasks' AND column_name = 'deleted_at';

-- Check comments table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'comments' AND column_name = 'deleted_at';

-- Check workspaces table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'workspaces' AND column_name = 'deleted_at';

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('tasks', 'comments', 'workspaces')
AND indexname LIKE '%deleted_at%';
```

Expected output:
- `deleted_at` column exists with type `timestamp with time zone`
- `is_nullable` is `YES`
- Indexes `idx_tasks_deleted_at`, `idx_comments_deleted_at`, `idx_workspaces_deleted_at` exist

## Migrating Existing Controllers

You can migrate controllers incrementally without breaking existing functionality.

### Strategy 1: Side-by-Side Migration

Keep old code working while adding new service-based endpoints:

```typescript
// Old controller (keep working)
export const getTasksOld = catchAsync(async (req: Request, res: Response) => {
  const result = await pool.query('SELECT * FROM tasks WHERE workspace_id = $1', [workspaceId]);
  res.json(new ApiResponse(200, result.rows, "Success"));
});

// New controller (add alongside)
export const getTasks = catchAsync(async (req: Request, res: Response) => {
  const tasks = await taskService.getTasksByWorkspace(workspaceId);
  res.json(new ApiResponse(200, tasks, "Success"));
});

// Routes
router.get('/tasks/old', getTasksOld); // Old endpoint
router.get('/tasks', getTasks);         // New endpoint
```

Test the new endpoint thoroughly, then remove the old one.

### Strategy 2: Feature Flag Migration

Use feature flags to switch between old and new implementations:

```typescript
const USE_REPOSITORY_LAYER = process.env.USE_REPOSITORY_LAYER === 'true';

export const getTasks = catchAsync(async (req: Request, res: Response) => {
  let tasks;
  
  if (USE_REPOSITORY_LAYER) {
    // New implementation
    tasks = await taskService.getTasksByWorkspace(workspaceId);
  } else {
    // Old implementation
    const result = await pool.query('SELECT * FROM tasks WHERE workspace_id = $1', [workspaceId]);
    tasks = result.rows;
  }
  
  res.json(new ApiResponse(200, tasks, "Success"));
});
```

### Strategy 3: Direct Replacement

For simple endpoints, directly replace the implementation:

```typescript
// Before
export const getTask = catchAsync(async (req: Request, res: Response) => {
  const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
  const task = result.rows[0];
  res.json(new ApiResponse(200, task, "Success"));
});

// After
export const getTask = catchAsync(async (req: Request, res: Response) => {
  const task = await taskService.getTaskById(req.params.id);
  if (!task) throw new ApiError(404, 'Task not found');
  res.json(new ApiResponse(200, task, "Success"));
});
```

## Migration Checklist

### Phase 1: Preparation
- [ ] Backup database
- [ ] Review migration SQL file
- [ ] Test migration on development database
- [ ] Verify no breaking changes

### Phase 2: Migration
- [ ] Run `003_add_soft_delete.sql` migration
- [ ] Verify columns added successfully
- [ ] Verify indexes created
- [ ] Test soft delete functionality

### Phase 3: Controller Migration
- [ ] Identify controllers to migrate
- [ ] Choose migration strategy (side-by-side, feature flag, or direct)
- [ ] Update one controller at a time
- [ ] Test each endpoint after migration
- [ ] Monitor for errors

### Phase 4: Testing
- [ ] Unit test repositories
- [ ] Unit test services
- [ ] Integration test endpoints
- [ ] Test soft delete behavior
- [ ] Test transaction rollback
- [ ] Test error handling

### Phase 5: Cleanup
- [ ] Remove old code
- [ ] Remove feature flags
- [ ] Update documentation
- [ ] Update API documentation

## Rollback Plan

If you need to rollback the migration:

### Rollback SQL

```sql
-- Remove indexes
DROP INDEX IF EXISTS idx_tasks_deleted_at;
DROP INDEX IF EXISTS idx_comments_deleted_at;
DROP INDEX IF EXISTS idx_workspaces_deleted_at;

-- Remove columns
ALTER TABLE tasks DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE comments DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE workspaces DROP COLUMN IF EXISTS deleted_at;
```

### Rollback Steps

1. Stop the application
2. Run rollback SQL
3. Revert code changes
4. Restart application
5. Verify functionality

## Common Migration Issues

### Issue 1: Column Already Exists

**Error**: `column "deleted_at" of relation "tasks" already exists`

**Solution**: Migration was already run. Skip or modify migration to use `ADD COLUMN IF NOT EXISTS`.

### Issue 2: Permission Denied

**Error**: `permission denied for table tasks`

**Solution**: Ensure database user has ALTER TABLE permissions:

```sql
GRANT ALTER ON TABLE tasks TO your_user;
GRANT ALTER ON TABLE comments TO your_user;
GRANT ALTER ON TABLE workspaces TO your_user;
```

### Issue 3: Index Creation Failed

**Error**: `index "idx_tasks_deleted_at" already exists`

**Solution**: Index was already created. Drop and recreate or skip index creation.

### Issue 4: Migration Timeout

**Error**: `timeout exceeded`

**Solution**: Increase connection timeout or run migration during low-traffic period.

## Testing After Migration

### Test Soft Delete

```typescript
// Create task
const task = await taskService.createTask({
  workspace_id: 'ws-1',
  title: 'Test Task',
  created_by: 'user-1'
});

// Soft delete
await taskService.deleteTask(task.id, 'user-1', 'ws-1');

// Verify not in normal queries
const tasks = await taskService.getTasksByWorkspace('ws-1');
expect(tasks.find(t => t.id === task.id)).toBeUndefined();

// Verify in deleted queries
const deletedTasks = await taskRepository.findAll({}, undefined, undefined, true);
expect(deletedTasks.find(t => t.id === task.id)).toBeDefined();
```

### Test Restore

```typescript
// Restore task
await taskRepository.restore(task.id);

// Verify in normal queries
const tasks = await taskService.getTasksByWorkspace('ws-1');
expect(tasks.find(t => t.id === task.id)).toBeDefined();
```

### Test Cascade Behavior

```typescript
// Create task with subtasks
const parentTask = await taskService.createTask({ /* ... */ });
const childTask = await taskService.createTask({
  parent_task_id: parentTask.id,
  /* ... */
});

// Delete parent
await taskService.deleteTask(parentTask.id, 'user-1', 'ws-1');

// Verify child is also deleted (database cascade)
const child = await taskRepository.findById(childTask.id);
expect(child).toBeNull();
```

## Performance Considerations

### Index Usage

The partial indexes created by the migration improve query performance:

```sql
-- This query uses the partial index
SELECT * FROM tasks WHERE deleted_at IS NULL;

-- This query does NOT use the partial index
SELECT * FROM tasks WHERE deleted_at IS NOT NULL;
```

### Query Performance

Monitor query performance after migration:

```sql
-- Explain query plan
EXPLAIN ANALYZE
SELECT * FROM tasks
WHERE workspace_id = 'ws-1'
AND deleted_at IS NULL;
```

Expected: Index scan on `idx_tasks_deleted_at`

### Database Size

Soft delete increases database size over time. Consider:

1. **Archival Strategy**: Move old deleted records to archive table
2. **Retention Policy**: Hard delete records after X days
3. **Monitoring**: Track database size growth

## Next Steps

After successful migration:

1. ✅ Migration complete
2. ⏳ Test repositories with sample queries
3. ⏳ Migrate one controller
4. ⏳ Test migrated endpoint
5. ⏳ Gradually migrate remaining controllers
6. ⏳ Add unit tests
7. ⏳ Update API documentation
8. ⏳ Monitor performance

## Support

For migration issues:
- Check error logs in Supabase dashboard
- Verify database permissions
- Review migration SQL file
- Test on development database first
- Contact team for assistance
