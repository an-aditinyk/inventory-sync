import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Connections } from "./pages/Connections";
import { NewSync } from "./pages/NewSync";
import { RunDetail } from "./pages/RunDetail";
import { History } from "./pages/History";
import { ReactNode } from "react";

function Nav() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <nav className="nav">
      <span className="brand">📦 Inventory Sync</span>
      <NavLink to="/" end>Dashboard</NavLink>
      <NavLink to="/sync/new">New Sync</NavLink>
      <NavLink to="/history">History</NavLink>
      <NavLink to="/connections">Connections</NavLink>
      <button onClick={logout}>Sign out</button>
    </nav>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="app">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/sync/new" element={<RequireAuth><NewSync /></RequireAuth>} />
        <Route path="/runs/:id" element={<RequireAuth><RunDetail /></RequireAuth>} />
        <Route path="/history" element={<RequireAuth><History /></RequireAuth>} />
        <Route path="/connections" element={<RequireAuth><Connections /></RequireAuth>} />
      </Routes>
    </>
  );
}
