SELECT 
  migration_name, 
  started_at, 
  finished_at, 
  rolled_back_at, 
  applied_steps_count, 
  logs 
FROM "_prisma_migrations" 
WHERE migration_name = '20260513115229_add_v1_1_0_features';
