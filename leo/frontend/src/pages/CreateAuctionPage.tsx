import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAuth } from "../auth/AuthContext";
import { API_BASE } from "../config/api";

export function CreateAuctionPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [item, setItem] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [image, setImage] = useState("");
  const [endTime, setEndTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isAuthenticated) {
      setError("You must be logged in to create an auction");
      return;
    }

    if (!startingPrice) {
      setError("Starting price is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        //credentials: "include", // send cookies for auth
        body: JSON.stringify({
          item,
          startingPrice: Number(startingPrice),
          image,
          endTime,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          (data as { error?: string }).error ?? "Failed to create auction"
        );
        return;
      }

      const { auctionId } = data as { auctionId: number };
      navigate(`/auction/${auctionId}`);
    } catch (err) {
      console.error(err);
      setError("Unable to reach server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-lg border bg-white p-6 shadow-sm">
      <h1 className="mb-2 text-2xl font-semibold">Create Auction</h1>
      <p className="mb-6 text-sm text-slate-600">
        Fill out the form to create a new auction.
      </p>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-800" htmlFor="item">
            Item
          </label>
          <Input
            id="item"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder="Vintage watch"
          />
        </div>

        <div className="space-y-1">
          <label
            className="text-sm font-medium text-slate-800"
            htmlFor="startingPrice"
          >
            Starting Price
          </label>
          <Input
            id="startingPrice"
            type="number"
            min="0"
            step="0.01"
            value={startingPrice}
            onChange={(e) => setStartingPrice(e.target.value)}
            placeholder="100.00"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-800" htmlFor="image">
            Image URL
          </label>
          <Input
            id="image"
            type="url"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://example.com/image.jpg"
          />
        </div>

        <div className="space-y-1">
          <label
            className="text-sm font-medium text-slate-800"
            htmlFor="endTime"
          >
            End Time
          </label>
          <Input
            id="endTime"
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-slate-900 text-white hover:bg-slate-800"
        >
          {loading ? "Creating..." : "Create Auction"}
        </Button>
      </form>
    </div>
  );
}
