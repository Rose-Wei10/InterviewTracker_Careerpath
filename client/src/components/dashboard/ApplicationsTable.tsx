import { Link } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import { statuses } from "../../types";
import type { Application, Status } from "../../types";
export default function ApplicationsTable({
  applications,
  onEdit,
  onDelete,
  onStatusChange,
  pendingId,
}: {
  applications: Application[];
  onEdit: (a: Application) => void;
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
                  <p>{a.role}</p>
                </td>
                <td data-label="Location">{a.location || "—"}</td>
                <td data-label="Applied">
                  {new Date(a.appliedDate).toLocaleDateString()}
                </td>
                <td data-label="Status">
                  {onStatusChange ? (
                    <div className="status-control">
                      <select
                        aria-label={`Status for ${a.company}`}
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
                <td data-label="Salary">{a.salary || "—"}</td>
                <td data-label="Actions">
                  <div className="actions">
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
