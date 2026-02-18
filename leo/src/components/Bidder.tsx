import { useState, FormEvent } from "react";

export function Bidder() {
  const [userid, setUserid] = useState("");
  const [auctionid, setAuctionid] = useState("");
  const [currentPrice] = useState<number>(120);
  const [price, setBidAmount] = useState<number>(currentPrice);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (price < currentPrice) {
      alert("Bid must be at least the current price.");
      return;
    }

    await fetch("http://localhost:8080", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userid,
        auctionid,
        price,
      }),
    });
  }

  function increment(amount: number) {
    setBidAmount((prev) =>
      Number((prev + amount).toFixed(2))
    );
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <form
            className="p-4 border rounded bg-light"
            onSubmit={handleSubmit}
          >
            <h4 className="mb-2 text-center">Place a Bid</h4>

            <p className="text-center text-muted mb-4">
              Current Price: <strong>${currentPrice}</strong>
            </p>

            <div className="mb-3">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-control"
                value={userid}
                onChange={(e) => setUserid(e.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Auction ID</label>
              <input
                type="text"
                className="form-control"
                value={auctionid}
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
                value={price}
                onChange={(e) =>
                  setBidAmount(Number(e.target.value) || 0)
                }
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
