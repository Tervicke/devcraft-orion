import { useState, useEffect, FormEvent } from "react";

export function Bidder() {
  const [Userid, setUserid] = useState("gambler");
  const [Auctionid, setAuctionid] = useState("2");
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [Price, setBidAmount] = useState<number>(0);

  // ---------- WebSocket setup with reconnect ----------
useEffect(() => {
  let socket: WebSocket;
  let reconnectTimer: NodeJS.Timeout;

  const connectWS = () => {
    socket = new WebSocket("ws://localhost:8081/ws");

    socket.onopen = () => {
      console.log("WS connected");
      socket.send(Auctionid); // subscribe to auction
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // whenever a new price comes in, update both currentPrice and input bid
        if (data.highestPrice !== undefined) {
          setCurrentPrice(data.highestPrice);
          setBidAmount(data.highestPrice); // keep input in sync
        }
      } catch (err) {
        console.error("WS parse error:", err);
      }
    };

    socket.onclose = (event) => {
      if (event.code !== 1000) console.log("WS closed:", event.code);
      reconnectTimer = setTimeout(connectWS, 1000); // reconnect after 1s
    };

    socket.onerror = (err) => console.error("WS error:", err);
  };

  connectWS();

  return () => {
    clearTimeout(reconnectTimer);
    socket?.close();
  };
}, [Auctionid]);  // ---------- Submit bid ----------
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!Auctionid.trim() || !Userid.trim()) {
      console.log("Username and Auction ID are required");
      return;
    }
    if (Price <= currentPrice) {
      console.log("Bid must be higher than the current price!");
      return;
    }

    try {
      const res = await fetch("http://localhost:8080/bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Auctionid, Userid, Price }),
      });
      const data = await res.json();
      if (data.success === "1") {
        console.log("Bid accepted:", Price);
        // currentPrice will be updated by WebSocket
      } else if (data.error) {
        console.log("Bid failed:", data.error);
      } else {
        console.log("Unexpected response:", data);
      }
    } catch (err) {
      console.error("Failed to place bid:", err);
    }
  }

  function increment(amount: number) {
    setBidAmount((prev) => Number((prev + amount).toFixed(2)));
  }

  // ---------- Styled form ----------
  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <form className="p-4 border rounded bg-light" onSubmit={handleSubmit}>
            <h4 className="mb-2 text-center">Place a Bid</h4>

            <p className="text-center text-muted mb-4">
              Current Price: <strong>${currentPrice}</strong>
            </p>

            <div className="mb-3">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-control"
                value={Userid}
                onChange={(e) => setUserid(e.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Auction ID</label>
              <input
                type="text"
                className="form-control"
                value={Auctionid}
                onChange={(e) => setAuctionid(e.target.value)}
                required
              />
            </div>

            <div className="mb-4">
              <label className="form-label">Bid Amount</label>
              <input
                type="number"
                className="form-control"
                min={currentPrice}
                step="0.01"
                value={Price}
                onChange={(e) => setBidAmount(Number(e.target.value) || 0)}
                required
              />
            </div>

            <div className="mb-4">
              <div className="d-flex flex-wrap gap-2">
                {[10, 20, 30, 40, 50].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={() => increment(v)}
                  >
                    +{v}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-100">
              Submit Bid
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
