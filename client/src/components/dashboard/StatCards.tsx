import { Link } from "react-router-dom";
import {
  BriefcaseBusiness,
  MessagesSquare,
  CalendarCheck,
  PartyPopper,
} from "lucide-react";
import type { DashboardData } from "../../types";
export default function StatCards({
  data,
  applicationUrl,
}: {
  data: DashboardData;
  applicationUrl: (status?: string) => string;
}) {
  const cards = [
    {
      label: "Total applications",
      href: applicationUrl(),
      value: data.total,
      caption: "Every opportunity in one place",
      Icon: BriefcaseBusiness,
    },
    {
      label: "Response rate",
      value: `${Math.round(data.responseRate * 100)}%`,
      caption: "Based on current statuses",
      Icon: MessagesSquare,
    },
    {
      label: "Interview rate",
      value: `${Math.round(data.interviewRate * 100)}%`,
      caption: "Interview, final round or offer",
      Icon: CalendarCheck,
    },
    {
      label: "Offers received",
      href: applicationUrl("Offer"),
      value: data.counts.Offer,
      caption: "Your hard work, paying off",
      Icon: PartyPopper,
    },
  ];
  return (
    <div className="stats">
      {cards.map(({ label, value, caption, Icon, href }) => {
        const content = (
          <>
            <div className="stat-label">
              {label}
              <span className="stat-icon">
                <Icon size={18} />
              </span>
            </div>
            <h2>{value}</h2>
            <p>{caption}</p>
          </>
        );
        return href ? (
          <Link className="stat-card" key={label} to={href}>
            {content}
          </Link>
        ) : (
          <article className="stat-card" key={label}>
            {content}
          </article>
        );
      })}
    </div>
  );
}
