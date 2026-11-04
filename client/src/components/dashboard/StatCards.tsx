import {
  BriefcaseBusiness,
  MessagesSquare,
  CalendarCheck,
  PartyPopper,
} from "lucide-react";
import { Link } from "react-router-dom";
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
      label: "Interviews",
      value:
        data.counts.Interview + data.counts["Final Round"] + data.counts.Offer,
      caption: `${Math.round(data.interviewRate * 100)}% interview rate`,
      Icon: CalendarCheck,
    },
    {
      label: "Offers received",
      href: applicationUrl("Offer"),
      value: data.counts.Offer,
      caption: "Your hard work, paying off",
      Icon: PartyPopper,
    },
    {
      label: "Response rate",
      value: `${Math.round(data.responseRate * 100)}%`,
      caption: "Based on current statuses",
      Icon: MessagesSquare,
    },
  ];
  return (
    <div className="stats">
      {cards.map(({ label, value, caption, href, Icon }) => {
        const content = (
          <>
            <div className="stat-label">
              {label}
              <Icon size={20} aria-hidden="true" />
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
