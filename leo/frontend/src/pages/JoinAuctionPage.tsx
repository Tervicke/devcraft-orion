import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export function JoinAuctionPage() {
  const [auctionIdInput, setAuctionIdInput] = useState("");
  const navigate = useNavigate();

  function handleJoin() {
    const trimmed = auctionIdInput.trim();
    if (!trimmed) return;
    navigate(`/auction/${trimmed}`);
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-lg border bg-white p-6 shadow-sm">
      <h1 className="mb-2 text-2xl font-semibold">Join Auction</h1>
      <p className="mb-4 text-sm text-slate-600">
        Enter the auction number you want to join.
      </p>
      <div className="space-y-3">
        <div className="space-y-1">
          <label
            className="text-sm font-medium text-slate-800"
            htmlFor="auctionId"
          >
            Auction ID
          </label>
          <Input
            id="auctionId"
            type="number"
            value={auctionIdInput}
            onChange={(e) => setAuctionIdInput(e.target.value)}
            placeholder="e.g. 2"
          />
        </div>
        <Button
          className="w-full bg-slate-900 text-white hover:bg-slate-800"
          onClick={handleJoin}
        >
          Join
        </Button>
      </div>
    </div>
  );
}


