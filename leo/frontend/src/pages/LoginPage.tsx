import { FormEvent, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAuth } from "../auth/AuthContext";
import { API_BASE } from "../config/api";

export function LoginPage() {
  const navigate = useNavigate();
  const { setAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Login failed");
        return;
      }
      setAuthenticated(true);
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Unable to reach server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-lg border bg-white p-6 shadow-sm">
      <h1 className="mb-2 text-2xl font-semibold">Login</h1>
      <p className="mb-6 text-sm text-slate-600">
        Enter your email and password to access the auction dashboard.
      </p>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-800" htmlFor="email">
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-1">
          <label
            className="text-sm font-medium text-slate-800"
            htmlFor="password"
          >
            Password
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-slate-900 text-white hover:bg-slate-800"
        >
          {loading ? "Logging in..." : "Login"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Don&apos;t have an account?{" "}
        <Link to="/register" className="font-medium text-slate-900 underline">
          Register
        </Link>
      </p>
    </div>
  );
}
