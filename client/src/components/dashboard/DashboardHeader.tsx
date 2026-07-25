import "./DashboardHeader.css";
import { UserButton, useUser } from "@clerk/clerk-react";

export default function DashboardHeader() {
  const { user } = useUser();

  const displayName =
    user?.username ||
    user?.firstName ||
    user?.primaryEmailAddress?.emailAddress ||
    "User";

  return (
    <div className="dashboard-header">
      <div>
        <h1>
          Welcome back, {displayName} 👋
        </h1>

        <p>
          Track applications and interviews
        </p>
      </div>

      <div className="header-right">
        <UserButton afterSignOutUrl="/" />
      </div>
    </div>
  );
}