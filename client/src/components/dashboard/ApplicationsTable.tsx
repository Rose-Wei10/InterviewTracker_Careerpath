import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Trash2, CalendarPlus } from "lucide-react";
import { statuses } from "../../types";
import type { Application, Status } from "../../types";
function TableText({ value, label }: { value: string; label: string }) {
  const ref = useRef<HTMLSpanElement>(null),
    [expanded, setExpanded] = useState(false),
    [clipped, setClipped] = useState(false);
  useLayoutEffect(() => {
    const measure = () => {
      if (ref.current && !expanded)
        setClipped(
          ref.current.scrollHeight > ref.current.clientHeight + 1 ||
            ref.current.scrollWidth > ref.current.clientWidth + 1,
        );
    };
    const observer = new ResizeObserver(measure);
    if (ref.current) observer.observe(ref.current);
    measure();
    return () => observer.disconnect();
  }, [value, expanded]);
  return (
    <div className="table-text">
      <span
        ref={ref}
        className={expanded ? "table-text-full" : "table-text-preview"}
      >
        {value}
      </span>
      {clipped && (
        <button
          type="button"
          className="table-text-toggle"
          aria-label={`${expanded ? "Hide" : "Show"} full ${label}`}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : "Show full text"}
        </button>
      )}
    </div>
  );
}
export default function ApplicationsTable({
  applications,
  onEdit,
  onSchedule,
  onDelete,
  onStatusChange,
  pendingId,
}: {
  applications: Application[];
  onEdit: (a: Application) => void;
  onSchedule?: (a: Application) => void;
  onDelete: (a: Application) => void;
  onStatusChange?: (id: string, status: Status) => void;
  pendingId?: string;
}) {
  return (
    <div className="table-scroll">
      <table className="application-table">
        <thead>
          <tr>
            <th>Company / role</th>
            <th>Location</th>
            <th>Applied</th>
            <th>Status</th>
            <th>Salary</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {applications.length ? (
            applications.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link className="company-link" to={`/applications/${a.id}`}>
                    {a.company}
                  </Link>
                  <TableText value={a.role} label={`role for ${a.company}`} />
                </td>
                <td data-label="Location">
                  <TableText
                    value={a.location || "—"}
                    label={`location for ${a.company}`}
                  />
                </td>
                <td data-label="Applied">
                  {new Date(
                    a.appliedDate.slice(0, 10) + "T12:00:00",
                  ).toLocaleDateString()}
                </td>
                <td data-label="Status">
                  {onStatusChange ? (
                    <div className="status-control">
                      <select
                        aria-label={`Status for ${a.company}`}
                        className={`status-${a.status.replace(" ", "-")}`}
                        value={a.status}
                        disabled={!!pendingId}
                        onChange={(e) =>
                          onStatusChange(a.id, e.target.value as Status)
                        }
                      >
                        {statuses.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                      {pendingId === a.id && (
                        <small role="status">Saving status…</small>
                      )}
                    </div>
                  ) : (
                    <span
                      className={`badge status-${a.status.replace(" ", "-")}`}
                    >
                      {a.status}
                    </span>
                  )}
                </td>
                <td data-label="Salary">
                  <TableText
                    value={a.salary || "—"}
                    label={`salary for ${a.company}`}
                  />
                </td>
                <td data-label="Actions">
                  <div className="actions">
                    {onSchedule && (
                      <button
                        aria-label={`Schedule event for ${a.company}`}
                        className="icon-button"
                        onClick={() => onSchedule(a)}
                      >
                        <CalendarPlus size={16} />
                      </button>
                    )}
                    <button
                      aria-label={`Edit ${a.company}`}
                      className="icon-button"
                      onClick={() => onEdit(a)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      aria-label={`Delete ${a.company}`}
                      className="icon-button"
                      onClick={() => onDelete(a)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="empty">
                No applications match. Adjust your filters or add your first
                opportunity.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
