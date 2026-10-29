import { NavLink, Outlet } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import {
  BriefcaseBusiness,
  LayoutDashboard,
  Files,
  CalendarDays,
  Sparkles,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useState } from "react";
export default function Layout() {
  const [dark, setDark] = useState(
    () => localStorage.getItem("theme") === "dark",
  );
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("navigation-collapsed") === "true",
  );
  function toggleNavigation() {
    localStorage.setItem("navigation-collapsed", String(!collapsed));
    setCollapsed(!collapsed);
  }
  function toggle() {
    const value = !dark;
    setDark(value);
    localStorage.setItem("theme", value ? "dark" : "light");
  }
  return (
    <div
      className={`app${collapsed ? " navigation-collapsed" : ""}`}
      data-theme={dark ? "dark" : "light"}
    >
      <a href="#main" className="skip">
        Skip to content
      </a>
      <aside className="sidebar">
        <NavLink
          className="brand"
          to="/dashboard"
          aria-label="Careerpath overview"
        >
          <span className="brand-icon">
            <BriefcaseBusiness size={22} />
          </span>
          <span className="navigation-label">
            Career<span className="brand-soft">path</span>
          </span>
        </NavLink>
        <button
          className="navigation-toggle icon-tip"
          onClick={toggleNavigation}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-expanded={!collapsed}
          aria-controls="workspace-navigation"
          data-tooltip={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
          <span className="navigation-label">Collapse menu</span>
        </button>
        <p className="eyebrow">YOUR WORKSPACE</p>
        <nav id="workspace-navigation" aria-label="Main navigation">
          <NavLink
            to="/dashboard"
            aria-label="Overview"
            className="icon-tip"
            data-tooltip="Overview"
          >
            <LayoutDashboard size={18} />{" "}
            <span className="navigation-label">Overview</span>
          </NavLink>
          <NavLink
            to="/applications"
            aria-label="Applications"
            className="icon-tip"
            data-tooltip="Applications"
          >
            <BriefcaseBusiness size={18} />{" "}
            <span className="navigation-label">Applications</span>
          </NavLink>
          <NavLink
            to="/calendar"
            aria-label="Calendar"
            className="icon-tip"
            data-tooltip="Calendar"
          >
            <CalendarDays size={18} />{" "}
            <span className="navigation-label">Calendar</span>
          </NavLink>
          <NavLink
            to="/resumes"
            aria-label="Resumes"
            className="icon-tip"
            data-tooltip="Resumes"
          >
            <Files size={18} />{" "}
            <span className="navigation-label">Resumes</span>
          </NavLink>
          <NavLink
            to="/analysis"
            aria-label="Match"
            className="icon-tip"
            data-tooltip="Match"
          >
            <Sparkles size={18} />{" "}
            <span className="navigation-label">Match</span>
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <span className="dot" /> Your next chapter starts here.
            <p>Make every application count.</p>
          </div>
          <button
            className="theme-toggle icon-tip"
            onClick={toggle}
            aria-label={dark ? "Light mode" : "Dark mode"}
            data-tooltip={dark ? "Light mode" : "Dark mode"}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}{" "}
            <span className="navigation-label">
              {dark ? "Light" : "Dark"} mode
            </span>
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Personal workspace <span className="muted">/ Job search</span>
          </span>
          <div className="actions">
            <span className="private-badge">● Private workspace</span>
            <UserButton />
          </div>
        </header>
        <main id="main">
          <Outlet />
        </main>
        <footer>
          Careerpath · A little more organized. A little closer to your next
          role.
        </footer>
      </div>
    </div>
  );
}
