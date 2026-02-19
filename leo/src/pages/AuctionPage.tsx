import { useEffect, useState, FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAuth } from "../auth/AuthContext";
import { API_BASE } from "../config/api";

type Auction = {
  id: number;
  item: string;
  currentPrice: number;
  startingPrice: number;
  imageUrl: string | null;
  endTime: string;
};

type BidEntry = { price: number; email: string };

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
  const [bids, setBids] = useState<BidEntry[]>([]);
  const { isAuthenticated } = useAuth();

  // Fetch auction details
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function fetchAuction() {
      try {
        const res = await fetch(`${API_BASE}/api/auction/${id}`, {
          credentials: "include",
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
          console.log(auctionData);
          setAuction(auctionData);
          const price =
            auctionData.currentPrice ?? auctionData.startingPrice ?? 0;
          setCurrentPrice(price);
          setBidPrice(price);
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

  // Fetch bid history
  async function fetchBids() {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/api/auction/${id}/bids`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray((data as { bids?: BidEntry[] }).bids)) {
        setBids((data as { bids: BidEntry[] }).bids);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!auction) return;
    fetchBids();
  }, [id, auction]);

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

  // WebSocket connection for live bid updates (same server as API)
  useEffect(() => {
    if (!id) return;
    setWsStatus("connecting");

    const wsBase =
      API_BASE.startsWith("https")
        ? "wss" + API_BASE.slice(5)
        : "ws" + API_BASE.slice(4);
    const wsUrl = wsBase + "/auction/" + id;

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connectWS = () => {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setWsStatus("connected");
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as {
            Price?: number;
            email?: string;
          };
          if (data.Price !== undefined) {
            setCurrentPrice(data.Price);
            setBidPrice(data.Price);
          }
          if (data.email !== undefined && data.Price !== undefined) {
            const next = { price: data.Price!, email: data.email! };
            setBids((prev) => {
              // Dedupe: same bid can arrive twice (e.g. two WS connections in dev)
              if (
                prev.length > 0 &&
                prev[0].email === next.email &&
                prev[0].price === next.price
              ) {
                return prev;
              }
              return [next, ...prev].slice(0, 20);
            });
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
      const res = await fetch(`${API_BASE}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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
      } else {
        setCurrentPrice(bidPrice);
        setBidPrice(bidPrice);
        // New bid entry will appear via WebSocket broadcast
      }
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
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
            $
            {(currentPrice ?? auction.startingPrice ?? 0).toFixed(2)}
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

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex-1 rounded-lg border bg-white p-4 shadow-sm">
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
              min={currentPrice ?? auction.startingPrice ?? 0}
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

        <div className="flex-1 rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            Recent bids
          </h2>
          {bids.length === 0 ? (
            <p className="text-xs text-slate-500">No bids yet.</p>
          ) : (
            <ul className="max-h-96 space-y-1 overflow-y-auto text-xs">
              {bids.map((bid, i) => (
                <li
                  key={i}
                  className="flex justify-between gap-2 text-slate-700"
                >
                  <span className="truncate" title={bid.email}>
                    {bid.email}
                  </span>
                  <span className="shrink-0 font-medium">
                    ${bid.price.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
