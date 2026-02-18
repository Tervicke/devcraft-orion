import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CreateAuctionPage } from "./pages/CreateAuctionPage";
import { JoinAuctionPage } from "./pages/JoinAuctionPage";
import { AuctionPage } from "./pages/AuctionPage";
import { AuthProvider, useAuth } from "./auth/AuthContext";

function Header() {
  const { isAuthenticated } = useAuth();

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-lg font-semibold">
          Live Auctions
        </Link>
        <nav className="text-sm space-x-4">
          {!isAuthenticated && (
            <>
              <Link to="/login" className="hover:underline">
                Login
              </Link>
              <Link to="/register" className="hover:underline">
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50 text-slate-900">
          <Header />
          <main className="mx-auto flex max-w-3xl flex-1 flex-col px-4 py-8">
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <DashboardPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/create"
                element={
                  <RequireAuth>
                    <CreateAuctionPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/join"
                element={
                  <RequireAuth>
                    <JoinAuctionPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/auction/:id"
                element={
                  <RequireAuth>
                    <AuctionPage />
                  </RequireAuth>
                }
              />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
