import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { Plus, Download, Upload, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { useApi } from "../hooks/useApi";
import { errorMessage } from "../services/api";
import { invalidateUserQueries } from "../services/queryCache";
import { statuses } from "../types";
import type { Application, Page, Status } from "../types";
import ApplicationsTable from "../components/dashboard/ApplicationsTable";
import AddApplicationModal from "../components/dashboard/AddApplicationModal";
import EventForm from "../components/events/EventForm";
import GhostReview from "../components/dashboard/GhostReview";
import { Confirm, ErrorState, Loading } from "../components/ui";
export default function Applications() {
  const api = useApi(),
    qc = useQueryClient(),
    [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Application | null | undefined>(
      params.get("new") ? null : undefined,
    ),
    [deleting, setDeleting] = useState<Application | null>(null);
  const [scheduling, setScheduling] = useState<Application | null>(null);
  const search = params.get("search") ?? "";
  const [debounced, setDebounced] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const filters = {
    search: debounced || undefined,
    status: params.get("status") || undefined,
    location: params.get("location") || undefined,
    from: params.get("from") || undefined,
    to: params.get("to") ? `${params.get("to")}T23:59:59.999Z` : undefined,
    sort: params.get("sort") || "appliedDate",
    direction: params.get("direction") || "desc",
    page: Number(params.get("page") || 1),
    pageSize: 10,
  };
  const query = useQuery({
    queryKey: ["applications", api.userId, filters],
    queryFn: () => api.get<Page<Application>>("/applications", filters),
    placeholderData: keepPreviousData,
  });
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next);
  }
  const remove = useMutation({
    mutationFn: (id: string) => api.remove(`/applications/${id}`),
    onSuccess: async () => {
      setDeleting(null);
      await invalidateUserQueries(qc, api.userId, [
        "applications",
        "application",
        "dashboard",
        "interviews",
        "events",
        "ghost-review",
      ]);
      toast.success("Application deleted");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const statusUpdate = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) =>
      api.patch(`/applications/${id}`, { status }),
    onSuccess: async () => {
      await invalidateUserQueries(qc, api.userId, [
        "applications",
        "application",
        "dashboard",
        "ghost-review",
      ]);
      toast.success("Status updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const activeFilters = [
    ["search", "Search"],
    ["status", "Status"],
    ["location", "Location"],
    ["from", "From"],
    ["to", "To"],
  ].filter(([key]) => params.get(key));
  async function exportCsv() {
    try {
      const blob = await api.csv(filters),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "applications.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  async function importCsv(file?: File) {
    if (!file) return;
    if (file.size > 1000000) {
      toast.error("CSV must be under 1 MB");
      return;
    }
    try {
      const result = await api.post<{ imported: number }>(
        "/applications/import",
        { csv: await file.text() },
      );
      toast.success(`Imported ${result.imported} applications`);
      await invalidateUserQueries(qc, api.userId, [
        "applications",
        "dashboard",
        "events",
        "ghost-review",
      ]);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ONE PLACE FOR EVERY OPPORTUNITY</p>
          <h1>
            Applications<span className="heading-dot">.</span>
          </h1>
          <p>Keep the details together. Focus on what comes next.</p>
        </div>
        <button className="primary" onClick={() => setEditing(null)}>
          <Plus size={17} /> Add application
        </button>
      </div>
      <GhostReview />
      <section className="card">
        <div className="section-heading">
          <h2>
            Your opportunities{" "}
            <span className="count">{query.data?.total ?? 0}</span>
          </h2>
          <div className="actions">
            <button onClick={exportCsv}>
              <Download size={16} /> Export
            </button>
            <label className="button">
              <Upload size={16} /> Import CSV
              <input
                className="sr-only"
                type="file"
                accept=".csv"
                onChange={(e) => {
                  void importCsv(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
        <p className="fine-print">
          CSV headers: company, role, status, appliedDate, location, salary,
          jobLink, notes. Dates: YYYY-MM-DD. Maximum 500 rows per import.
        </p>
        <div className="filters">
          <label className="search-field">
            <span>
              <Search size={14} /> Search
            </span>
            <input
              placeholder="Company or role…"
              value={search}
              onChange={(e) => {
                filter("search", e.target.value);
              }}
            />
          </label>
          <label>
            Status
            <select
              value={params.get("status") ?? ""}
              onChange={(e) => filter("status", e.target.value)}
            >
              <option value="">All statuses</option>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Location
            <input
              placeholder="Any location"
              value={params.get("location") ?? ""}
              onChange={(e) => filter("location", e.target.value)}
            />
          </label>
          <label>
            From
            <input
              type="date"
              value={params.get("from") ?? ""}
              onChange={(e) => filter("from", e.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={params.get("to") ?? ""}
              onChange={(e) => filter("to", e.target.value)}
            />
          </label>
          <label>
            Sort
            <select
              value={params.get("sort") ?? "appliedDate"}
              onChange={(e) => filter("sort", e.target.value)}
            >
              <option value="appliedDate">Applied date</option>
              <option value="company">Company</option>
              <option value="role">Role</option>
              <option value="status">Status</option>
              <option value="updatedAt">Last updated</option>
            </select>
          </label>
          <label>
            Order
            <select
              value={params.get("direction") ?? "desc"}
              onChange={(e) => filter("direction", e.target.value)}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
        </div>
        {activeFilters.length > 0 && (
          <div className="active-filters" aria-label="Active filters">
            {activeFilters.map(([key, label]) => (
              <button
                className="filter-chip"
                key={key}
                onClick={() => filter(key, "")}
                aria-label={`Remove ${label.toLowerCase()} filter`}
              >
                {label}: {params.get(key)} <X size={13} aria-hidden="true" />
              </button>
            ))}
            <button onClick={() => setParams(new URLSearchParams())}>
              Reset filters
            </button>
          </div>
        )}
        {query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <ErrorState error={query.error} retry={() => query.refetch()} />
        ) : (
          <>
            <ApplicationsTable
              applications={query.data.items}
              onSchedule={setScheduling}
              onEdit={setEditing}
              onDelete={setDeleting}
              onStatusChange={(id, status) =>
                statusUpdate.mutate({ id, status })
              }
              pendingId={
                statusUpdate.isPending ? statusUpdate.variables.id : undefined
              }
            />
            <div className="pagination">
              <span>
                {query.data.total} applications · Page {query.data.page} of{" "}
                {Math.max(1, query.data.totalPages)}
              </span>
              <div className="actions">
                <button
                  disabled={filters.page <= 1 || query.isFetching}
                  onClick={() => {
                    params.set("page", String(filters.page - 1));
                    setParams(params);
                  }}
                >
                  Previous
                </button>
                <button
                  disabled={
                    filters.page >= query.data.totalPages || query.isFetching
                  }
                  onClick={() => {
                    params.set("page", String(filters.page + 1));
                    setParams(params);
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
      {scheduling && (
        <EventForm
          application={scheduling}
          onClose={() => setScheduling(null)}
        />
      )}
      {editing !== undefined && (
        <AddApplicationModal
          application={editing}
          onClose={() => {
            setEditing(undefined);
            params.delete("new");
            setParams(params);
          }}
        />
      )}
      {deleting && (
        <Confirm
          title={`Delete ${deleting.company}?`}
          onClose={() => setDeleting(null)}
          onConfirm={() => remove.mutate(deleting.id)}
          busy={remove.isPending}
        />
      )}
    </>
  );
}
