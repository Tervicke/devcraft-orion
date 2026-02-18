import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";

export function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Auction Dashboard</h1>
      <p className="text-sm text-slate-600">
        Simple placeholder dashboard. Use the buttons below to create or join an
        auction.
      </p>
      <div className="flex flex-col gap-3">
        <Link to="/create">
          <Button className="w-full bg-slate-900 text-white hover:bg-slate-800">
            Create Auction
          </Button>
        </Link>
        <Link to="/join">
          <Button variant="outline" className="w-full">
            Join Auction
          </Button>
        </Link>
      </div>
    </div>
  );
}

