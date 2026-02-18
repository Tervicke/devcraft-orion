import { useEffect, useState, FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAuth } from "../auth/AuthContext";
import { API_BASE } from "../config/api";

type Auction = {
  id: number;
  item: string;
  startingPrice: number;
  imageUrl: string | null;
  endTime: string;
};

export function AuctionPage() {
  const { id } = useParams<{ id: string }>();
  const [auction, setAuction] = useState<Auction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [wsStatus, setWsStatus] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  const [userId, setUserId] = useState("gambler");
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [bidPrice, setBidPrice] = useState<number>(0);
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidLoading, setBidLoading] = useState(false);
  const { isAuthenticated } = useAuth();

  // Fetch auction details
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function fetchAuction() {
      try {
        const res = await fetch(`${API_BASE}/api/auction/${id}`, {
          //credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) {
          if (!cancelled) {
            setError(
              (data as { error?: string }).error ?? "Failed to load auction"
            );
          }
          return;
        }
        if (!cancelled) {
          const auctionData = data as Auction;
          setAuction(auctionData);
          setCurrentPrice(auctionData.startingPrice);
          setBidPrice(auctionData.startingPrice);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Unable to reach server");
        }
      }
    }

    fetchAuction();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Countdown timer
  useEffect(() => {
    if (!auction) return;
    const end = new Date(auction.endTime).getTime();

    function update() {
      const now = Date.now();
      const diff = end - now;
      if (diff <= 0) {
        setTimeLeft("Auction ended");
        return;
      }
      const totalSeconds = Math.floor(diff / 1000);
      const seconds = totalSeconds % 60;
      const minutes = Math.floor(totalSeconds / 60) % 60;
      const hours = Math.floor(totalSeconds / 3600);
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [auction]);

  // WebSocket connection for live updates (placeholder echo)
  useEffect(() => {
    if (!id) return;
    setWsStatus("connecting");

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connectWS = () => {
      socket = new WebSocket("ws://localhost:8081/ws");

      socket.onopen = () => {
        setWsStatus("connected");
        if (id) {
          socket?.send(id); // subscribe to this auction's price stream
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.highestPrice !== undefined) {
            setCurrentPrice(data.highestPrice);
            setBidPrice(data.highestPrice);
          }
        } catch (err) {
          console.error("WS parse error:", err);
        }
      };

      socket.onclose = (event) => {
        if (event.code !== 1000) console.log("WS closed:", event.code);
        setWsStatus("disconnected");
        reconnectTimer = setTimeout(connectWS, 1000);
      };

      socket.onerror = (err) => {
        console.error("WS error:", err);
        setWsStatus("disconnected");
      };
    };

    connectWS();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [id]);

  async function handleBidSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBidError(null);

    if (!isAuthenticated) {
      setBidError("You must be logged in to place a bid");
      return;
    }

    if (!id || !userId.trim()) {
      setBidError("Username and Auction ID are required");
      return;
    }
    if (bidPrice <= currentPrice) {
      setBidError("Bid must be higher than the current price");
      return;
    }

    try {
      setBidLoading(true);
      const res = await fetch("http://localhost:8080/bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Auctionid: id,
          Userid: userId,
          Price: bidPrice,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success !== "1") {
        setBidError(
          (data as { error?: string }).error ??
            "Bid was not accepted by the server"
        );
      }
      // currentPrice will be updated via WebSocket when server broadcasts
    } catch (err) {
      console.error("Failed to place bid:", err);
      setBidError("Failed to place bid");
    } finally {
      setBidLoading(false);
    }
  }

  function increment(amount: number) {
    setBidPrice((prev) => Number((prev + amount).toFixed(2)));
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md rounded-lg border bg-white p-6 text-red-700">
        {error}
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="mx-auto max-w-md rounded-lg border bg-white p-6">
        <p className="text-sm text-slate-600">Loading auction...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold">{auction.item}</h1>
        <p className="mb-1 text-sm text-slate-600">
          Starting price:{" "}
          <span className="font-semibold text-slate-900">
            ${auction.startingPrice.toFixed(2)}
          </span>
        </p>
        <p className="mb-1 text-sm text-slate-600">
          Current price:{" "}
          <span className="font-semibold text-slate-900">
            ${currentPrice.toFixed(2)}
          </span>
        </p>
        <p className="mb-3 text-sm text-slate-600">
          Auction ends in:{" "}
          <span className="font-semibold text-slate-900">{timeLeft}</span>
        </p>
        {auction.imageUrl && (
          <div className="mt-3">
            <img
              src={auction.imageUrl}
              alt={auction.item}
              className="max-h-64 w-full rounded-md object-cover"
            />
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
          <span>Live price stream (WebSocket)</span>
          <span>
            Status:{" "}
            <span className="font-semibold">
              {wsStatus === "connecting"
                ? "Connecting..."
                : wsStatus === "connected"
                ? "Connected"
                : "Disconnected"}
            </span>
          </span>
        </div>
        <form className="mt-3 space-y-4" onSubmit={handleBidSubmit}>
          <div className="space-y-1">
            <label
              className="text-sm font-medium text-slate-800"
              htmlFor="userId"
            >
              Username
            </label>
            <Input
              id="userId"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label
              className="text-sm font-medium text-slate-800"
              htmlFor="auctionIdDisplay"
            >
              Auction ID
            </label>
            <Input
              id="auctionIdDisplay"
              type="text"
              value={id ?? ""}
              disabled
            />
          </div>

          <div className="space-y-1">
            <label
              className="text-sm font-medium text-slate-800"
              htmlFor="bidPrice"
            >
              Bid amount
            </label>
            <Input
              id="bidPrice"
              type="number"
              min={currentPrice}
              step="0.01"
              value={bidPrice}
              onChange={(e) => setBidPrice(Number(e.target.value) || 0)}
              required
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[10, 20, 30, 40, 50].map((v) => (
              <Button
                key={v}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => increment(v)}
              >
                +{v}
              </Button>
            ))}
          </div>

          {bidError && (
            <p className="text-sm text-red-600" role="alert">
              {bidError}
            </p>
          )}

          <Button
            type="submit"
            className="w-full bg-slate-900 text-white hover:bg-slate-800"
            disabled={bidLoading || wsStatus !== "connected"}
          >
            {bidLoading ? "Submitting bid..." : "Submit bid"}
          </Button>
        </form>
      </div>
    </div>
  );
}
