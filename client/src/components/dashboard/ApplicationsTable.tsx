import { Pencil, Trash2 } from "lucide-react"

const statusColors: Record<string, string> = {
  Applied: "#2563eb",
  OA: "#f59e0b",
  Interview: "#8b5cf6",
  "Final Round": "#ec4899",
  Offer: "#16a34a",
  Reject: "#dc2626",
  Ghosted: "#6b7280",
}

interface Props {
    applications: any[]
    onEdit?: (app: any) => void
    onDelete?: (id: string) => void
    onStatusChange?: (id: string, status: string) => void
    onAdd?: () => void
}

export default function ApplicationsTable({
    applications,
    onEdit,
    onDelete,
    onStatusChange,
    onAdd
}: Props) {
  return (
    <div className="card">

      <div className="table-header">

        <h2>Application Tracker</h2>

        <button
            className="add-btn"
            onClick={()=>{
                console.log("clicked")
                onAdd?.()
            }}
        >
            + Add Application
        </button>

      </div>

      <table className="application-table">

        <thead>

          <tr>

            <th>Company</th>

            <th>Role</th>

            <th>Location</th>

            <th>Salary</th>

            <th>Applied</th>

            <th>Status</th>

            <th>Actions</th>

          </tr>

        </thead>

        <tbody>

          {applications.length === 0 ? (

            <tr>

              <td
                colSpan={7}
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#888",
                }}
              >
                No applications yet.
              </td>

            </tr>

          ) : (

            applications.map((app) => (

              <tr key={app.id}>

                <td>

                  <strong>{app.company}</strong>

                </td>

                <td>{app.role}</td>

                <td>{app.location}</td>

                <td>{app.salary}</td>

                <td>
                  {new Date(app.appliedDate).toLocaleDateString()}
                </td>

                <td>

                  <select
                    value={app.status}
                    onChange={(e) =>
                      onStatusChange?.(
                        app.id,
                        e.target.value
                      )
                    }
                    style={{
                      background:
                        statusColors[app.status],
                      color: "white",
                      border: "none",
                      borderRadius: "20px",
                      padding: "8px 14px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >

                    <option>Applied</option>

                    <option>OA</option>

                    <option>Interview</option>

                    <option>Final Round</option>

                    <option>Offer</option>

                    <option>Reject</option>

                    <option>Ghosted</option>

                  </select>

                </td>

                <td>

                  <button
                    className="icon-btn"
                    onClick={() => onEdit?.(app)}
                  >
                    <Pencil size={18} />
                  </button>

                  <button
                    className="icon-btn delete"
                    onClick={() =>
                      onDelete?.(app.id)
                    }
                  >
                    <Trash2 size={18} />
                  </button>

                </td>

              </tr>

            ))

          )}

        </tbody>

      </table>

    </div>
  )
}