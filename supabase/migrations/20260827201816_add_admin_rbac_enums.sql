-- Enum additions are isolated because PostgreSQL requires new enum values to
-- be committed before they are used by later migration statements.
alter type public.app_role add value if not exists 'ADMIN';
alter type public.app_permission add value if not exists 'admin.manage';
