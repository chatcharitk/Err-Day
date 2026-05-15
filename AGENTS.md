<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Database schema changes — use migrations, NEVER `db push`

This project uses Prisma **migrations**, not `prisma db push`.

## To change the schema

```bash
# 1. Edit prisma/schema.prisma
# 2. Create a new migration (runs against your dev DB / Neon branch):
npm run db:migrate -- --name short_description_in_snake_case
# 3. Review the generated SQL in prisma/migrations/<timestamp>_<name>/migration.sql
# 4. Commit BOTH schema.prisma AND the new migration directory
```

## Deploy

Production runs `prisma migrate deploy` automatically as part of `npm run build` (Vercel). It only applies migrations whose SQL has been reviewed and committed — never destructive auto-changes.

## Forbidden in production / on main

- `npx prisma db push` — bypasses the migration system, no audit trail, no rollback. Use migrations.
- `--accept-data-loss` flags — never on production.
- Editing past migration SQL files after they've been deployed — write a new migration instead.

## Safer testing with Neon branches

For risky migrations (column type changes, drops, large backfills), test on a Neon branch first: clone production via the Neon dashboard, point `DIRECT_URL` at the branch, run `npm run db:migrate:deploy`, verify, then merge.
