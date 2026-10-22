import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import { Plus, ArrowUpRight } from "lucide-react";
import { useApi } from "../hooks/useApi";
import type { DashboardData } from "../types";
import { statuses } from "../types";
import StatCards from "../components/dashboard/StatCards";
import FunnelChart from "../components/dashboard/FunnelChart";
import ActivityFeed from "../components/dashboard/ActivityFeed";
import UpcomingInterviews from "../components/dashboard/UpcomingInterviews";
import { Loading, ErrorState, Empty } from "../components/ui";
export default function Dashboard() {
  const api = useApi(),
    { user } = useUser();
  const [range, setRange] = useState("90"),
    [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const from =
    range === "custom"
      ? custom.from
      : range === "all"
        ? undefined
        : new Date(Date.now() - Number(range) * 86400000)
            .toISOString()
            .slice(0, 10);
  const to =
    range === "custom" && custom.to ? `${custom.to}T23:59:59.999Z` : undefined;
  const query = useQuery({
    queryKey: ["dashboard", api.userId, from, to],
    queryFn: () =>
      api.get<DashboardData>("/dashboard", { from: from || undefined, to }),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">A CLEARER PATH FORWARD</p>
          <h1>
            Your job search, at a glance<span className="heading-dot">.</span>
          </h1>
          <p>
            Welcome back{user?.firstName ? `, ${user.firstName}` : ""}. Let’s
            turn opportunities into your next chapter.
          </p>
        </div>
        <Link to="/applications?new=1" className="button primary">
          <Plus size={17} /> Add application
        </Link>
      </div>
      <div className="section-heading overview-heading">
        <h2>Overview</h2>
        <label className="inline-label">
          Date range{" "}
          <select value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
            <option value="all">All time</option>
            <option value="custom">Custom dates</option>
          </select>
        </label>
      </div>
      {range === "custom" && (
        <div className="filters">
          <label>
            From
            <input
              type="date"
              value={custom.from}
              onChange={(e) => setCustom({ ...custom, from: e.target.value })}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={custom.to}
              onChange={(e) => setCustom({ ...custom, to: e.target.value })}
            />
          </label>
        </div>
      )}
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : (
        <>
          <StatCards data={query.data} />
          <div className="chart-grid">
            <section className="card">
              <div className="section-heading">
                <div>
                  <h2>Application activity</h2>
                  <p className="muted">Small steps. Steady progress.</p>
                </div>
                <select
                  aria-label="Trend period"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as typeof period)}
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {query.data[period].length ? (
                <FunnelChart data={query.data[period]} />
              ) : (
                <Empty>No applications in this date range.</Empty>
              )}
            </section>
            <section className="card">
              <div className="section-heading">
                <div>
                  <h2>Your application funnel</h2>
                  <p className="muted">Current stage distribution</p>
                </div>
                <ArrowUpRight size={18} />
              </div>
              <div className="funnel">
                {statuses.map((s) => (
                  <div className="funnel-row" key={s}>
                    <span>{s}</span>
                    <div className="funnel-track">
                      <div
                        className={`funnel-bar status-${s.replace(" ", "-")}`}
                        style={{
                          width: `${query.data.total ? (100 * query.data.counts[s]) / query.data.total : 0}%`,
                        }}
                      />
                    </div>
                    <strong>{query.data.counts[s]}</strong>
                  </div>
                ))}
              </div>
              <p className="fine-print">
                {query.data.rateLabel}. Rejections after interviews cannot be
                inferred from current status alone.
              </p>
            </section>
          </div>
          <div className="below-grid">
            <UpcomingInterviews data={query.data.upcoming} />
            <ActivityFeed data={query.data.recent} />
          </div>
        </>
      )}
    </>
  );
}
