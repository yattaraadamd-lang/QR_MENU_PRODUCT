"use client";

import { PLATFORM_USERS_URL, selectUsers } from "@/components/super-admin-platform/platform.api";
import { usePlatformQuery } from "@/components/super-admin-platform/usePlatformQuery";
import UsersTable from "@/components/super-admin-platform/UsersTable";
import EmptyState from "@/components/ui/EmptyState";
import QueryError from "@/components/ui/QueryError";
import Skeleton from "@/components/ui/Skeleton";

export default function SuperAdminUsersPage() {
  const query = usePlatformQuery(PLATFORM_USERS_URL, selectUsers);
  const users = query.data ?? [];

  return (
    <div>
      <h1 className="page-title mb-6">Kullanıcı Yönetimi</h1>

      <QueryError message={query.error} onRetry={query.refresh} />

      {query.isLoading && (
        <div role="status" aria-label="Kullanıcılar yükleniyor">
          <Skeleton className="h-64" />
        </div>
      )}

      {!query.isLoading && users.length === 0 && !query.error && <EmptyState icon="👥" title="Kullanıcı bulunamadı" />}

      {users.length > 0 && <UsersTable users={users} />}
    </div>
  );
}
