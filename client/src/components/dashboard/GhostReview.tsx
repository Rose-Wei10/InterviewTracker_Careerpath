import { useEffect, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Clock3 } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { errorMessage } from "../../services/api";
import { invalidateUserQueries } from "../../services/queryCache";
import { Modal, Loading, ErrorState } from "../ui";
import type { Application, Page } from "../../types";
export default function GhostReview({ count }: { count?: number }) {
  const api = useApi(),
    qc = useQueryClient(),
    [open, setOpen] = useState(false),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<string[]>([]);
  const query = useQuery({
    queryKey: ["ghost-review", api.userId, page],
    queryFn: () =>
      api.get<Page<Application>>("/applications/ghost-review", { page }),
    enabled: open || count === undefined,
    placeholderData: keepPreviousData,
    refetchInterval: 60000,
  });
  const total =
    open || count === undefined ? (query.data?.total ?? count ?? 0) : count;
  useEffect(() => {
    if (query.data && page > Math.max(1, query.data.totalPages)) {
      setPage(Math.max(1, query.data.totalPages));
      setSelected([]);
    }
  }, [query.data, page]);
  const save = useMutation({
    mutationFn: () =>
      api.post<{ updatedIds: string[]; skippedIds: string[] }>(
        "/applications/ghost-review",
        { ids: selected },
      ),
    onSuccess: async (result) => {
      setSelected([]);
      await invalidateUserQueries(qc, api.userId, [
        "applications",
        "application",
        "dashboard",
        "ghost-review",
      ]);
      toast.success(
        `${result.updatedIds.length} marked Ghosted${result.skippedIds.length ? `; ${result.skippedIds.length} no longer eligible, skipped` : ""}`,
      );
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  function changePage(next: number) {
    setSelected([]);
    setPage(next);
  }
  return (
    <>
      <section className="ghost-banner" aria-label="30-day application review">
        <div className="ghost-banner-copy">
          <Clock3 size={22} />
          <div>
            <h2>
              30+ days awaiting response <span className="count">{total}</span>
            </h2>
            <p>
              Still Applied? You decide which opportunities to mark Ghosted.
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setSelected([]);
            setOpen(true);
          }}
        >
          Review applications
        </button>
        {query.isError && !open && (
          <span role="alert">Review count unavailable</span>
        )}
      </section>
      {open && (
        <Modal
          title="Review applications awaiting response"
          onClose={() => setOpen(false)}
        >
          <p className="fine-print">
            Only applications still Applied at least 30 days after applying
            appear here. Nothing changes until you select it and confirm.
          </p>
          {query.isPending ? (
            <Loading />
          ) : query.isError ? (
            <ErrorState error={query.error} retry={() => query.refetch()} />
          ) : (
            <>
              <div className="review-toolbar">
                <label className="check-label">
                  <input
                    type="checkbox"
                    aria-label="Select this page"
                    disabled={
                      !query.data.items.length ||
                      query.isPlaceholderData ||
                      save.isPending
                    }
                    checked={
                      !!query.data.items.length &&
                      query.data.items.every((a) => selected.includes(a.id))
                    }
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? query.data.items.map((a) => a.id)
                          : [],
                      )
                    }
                  />
                  Select this page
                </label>
                <span>{selected.length} selected</span>
              </div>
              <div className="table-scroll">
                <table className="ghost-table">
                  <thead>
                    <tr>
                      <th>Select</th>
                      <th>Company / role</th>
                      <th>Applied</th>
                      <th>Days waiting</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.items.map((a) => (
                      <tr
                        key={a.id}
                        className={
                          selected.includes(a.id) ? "row-selected" : ""
                        }
                      >
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Select ${a.company} ${a.role}`}
                            checked={selected.includes(a.id)}
                            disabled={save.isPending || query.isPlaceholderData}
                            onChange={(e) =>
                              setSelected(
                                e.target.checked
                                  ? [...selected, a.id]
                                  : selected.filter((id) => id !== a.id),
                              )
                            }
                          />
                        </td>
                        <td>
                          <strong>{a.company}</strong>
                          <p>{a.role}</p>
                        </td>
                        <td>{a.appliedDate.slice(0, 10)}</td>
                        <td>
                          {Math.max(
                            30,
                            Math.floor(
                              (Date.now() - new Date(a.appliedDate).getTime()) /
                                86400000,
                            ),
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!query.data.items.length && (
                <p className="empty">
                  No applications need review. You're all caught up.
                </p>
              )}
              <div className="pagination">
                <span>
                  {query.data.total} eligible · Page {page} of{" "}
                  {Math.max(1, query.data.totalPages)}
                </span>
                <button
                  disabled={
                    page === 1 || query.isPlaceholderData || save.isPending
                  }
                  onClick={() => changePage(page - 1)}
                >
                  Previous review page
                </button>
                <button
                  disabled={
                    page >= query.data.totalPages ||
                    query.isPlaceholderData ||
                    save.isPending
                  }
                  onClick={() => changePage(page + 1)}
                >
                  Next review page
                </button>
              </div>
              <div className="actions modal-actions">
                <button onClick={() => setOpen(false)}>Close</button>
                <button
                  className="primary"
                  disabled={
                    !selected.length ||
                    save.isPending ||
                    query.isPlaceholderData
                  }
                  onClick={() => save.mutate()}
                >
                  {save.isPending ? "Updating…" : "Mark selected as Ghosted"}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
