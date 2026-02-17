import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { Bidder } from "./components/Bidder";

export function App() {
  return (
    <BrowserRouter>
      <nav className="navbar navbar-expand navbar-light bg-light">
        <div className="container justify-content-center gap-3">
          <NavLink
            to="/"
            className={({ isActive }) =>
              "nav-link" + (isActive ? " active fw-semibold" : "")
            }
          >
            Bidder
          </NavLink>

          <span>|</span>

          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              "nav-link" + (isActive ? " active fw-semibold" : "")
            }
          >
            Dashboard
          </NavLink>
        </div>
      </nav>

      <main className="container py-5">
        <Routes>
          <Route path="/" element={<Bidder />} />
          <Route path="/dashboard" element={<h1>dashboard</h1>} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
