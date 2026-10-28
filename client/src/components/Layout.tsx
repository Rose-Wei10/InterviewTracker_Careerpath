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
} from "lucide-react";
import { useState } from "react";
export default function Layout() {
  const [dark, setDark] = useState(
    () => localStorage.getItem("theme") === "dark",
  );
  function toggle() {
    const value = !dark;
    setDark(value);
    localStorage.setItem("theme", value ? "dark" : "light");
  }
  return (
    <div className="app" data-theme={dark ? "dark" : "light"}>
      <a href="#main" className="skip">
        Skip to content
      </a>
      <aside className="sidebar">
        <NavLink className="brand" to="/dashboard">
          <span className="brand-icon">
            <BriefcaseBusiness size={22} />
          </span>
          Career<span className="brand-soft">path</span>
        </NavLink>
        <p className="eyebrow">YOUR WORKSPACE</p>
        <nav aria-label="Main navigation">
          <NavLink to="/dashboard">
            <LayoutDashboard size={18} /> Overview
          </NavLink>
          <NavLink to="/applications">
            <BriefcaseBusiness size={18} /> Applications
          </NavLink>
          <NavLink to="/calendar">
            <CalendarDays size={18} /> Calendar
          </NavLink>
          <NavLink to="/resumes">
            <Files size={18} /> Resumes
          </NavLink>
          <NavLink to="/analysis">
            <Sparkles size={18} /> Match
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <span className="dot" /> Your next chapter starts here.
            <p>Make every application count.</p>
          </div>
          <button className="theme-toggle" onClick={toggle}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}{" "}
            {dark ? "Light" : "Dark"} mode
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
