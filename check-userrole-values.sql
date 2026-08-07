-- Check UserRole enum values in database
SELECT enumlabel as value
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')
ORDER BY enumsortorder;
