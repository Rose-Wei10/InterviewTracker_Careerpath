import { Link } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import type { Application } from "../../types";
export default function ApplicationsTable({
  applications,
  onEdit,
  onDelete,
}: {
  applications: Application[];
  onEdit: (a: Application) => void;
  onDelete: (a: Application) => void;
}) {
  return (
    <div className="table-scroll">
      <table>
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
                <td>{a.location || "—"}</td>
                <td>{new Date(a.appliedDate).toLocaleDateString()}</td>
                <td>
                  <span
                    className={`badge status-${a.status.replace(" ", "-")}`}
                  >
                    {a.status}
                  </span>
                </td>
                <td>{a.salary || "—"}</td>
                <td>
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
