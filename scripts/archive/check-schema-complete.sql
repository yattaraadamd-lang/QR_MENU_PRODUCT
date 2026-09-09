-- Check all enums exist
SELECT 'ENUM' as type, typname as name 
FROM pg_type 
WHERE typname IN ('UserRole', 'StockStatus', 'TableStatus', 'OrderStatus', 'ServiceRequestType', 'RequestStatus', 'NotificationType', 'SoundType')
ORDER BY typname;

-- Check all tables exist
SELECT 'TABLE' as type, tablename as name
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('businesses', 'users', 'categories', 'products', 'tables', 'orders', 'order_items', 'service_requests', 'notifications', 'waiter_invites')
ORDER BY tablename;
