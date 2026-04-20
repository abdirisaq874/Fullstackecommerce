"use client";
import { useState } from "react";
import { useGetCustomersQuery } from "../../../../store/api/endpointsApi";
import { Button, DataTable, StatusBadge, TableSkeleton, Pagination, EmptyState } from "../../../../components/ui";
import { formatCurrency, formatDate } from "../../../../lib/utils";
import type { User } from "../../../../types";

export default function CustomersPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useGetCustomersQuery({ page, limit: 20 });

  const columns = [
    {
      key: "name", header: "Customer",
      render: (c: User) => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center text-[9px] font-bold text-indigo-600">
            {c.firstName[0]}{c.lastName[0]}
          </div>
          <div>
            <div className="text-[11px] font-semibold text-gray-700">{c.firstName} {c.lastName}</div>
            <div className="text-[9px] text-gray-400">{c.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "phone", header: "Phone",
      render: (c: User) => <span className="text-[10px] text-gray-500">{c.phone || "—"}</span>,
    },
    {
      key: "joined", header: "Joined",
      render: (c: User) => <span className="text-[10px] text-gray-500">{formatDate(c.createdAt)}</span>,
    },
    {
      key: "verified", header: "Verified",
      render: (c: User) => <StatusBadge status={c.emailVerified ? "Active" : "Pending"} />,
    },
    {
      key: "status", header: "Status",
      render: (c: User) => <StatusBadge status={c.isActive ? "Active" : "Inactive"} />,
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-800 tracking-tight">Customers</h1>
          <p className="text-[10px] text-gray-400 mt-0.5">View and manage your customer base.</p>
        </div>
        <Button variant="secondary">Export CSV</Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={10} cols={5} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState icon="👥" title="No customers yet" description="Customers will appear here after they register." />
      ) : (
        <>
          <div className={isFetching ? "opacity-60" : ""}>
            <DataTable columns={columns} data={data.data} keyExtractor={(c) => c._id} />
          </div>
          {data.meta.totalPages > 1 && (
            <Pagination page={data.meta.page} totalPages={data.meta.totalPages}
              total={data.meta.total} limit={data.meta.limit} onPageChange={setPage} />
          )}
        </>
      )}
    </>
  );
}
