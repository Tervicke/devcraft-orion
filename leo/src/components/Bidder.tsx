import { useState, FormEvent } from "react";

export function Bidder() {
    const [Userid, setUserid] = useState("gambler");
    const [Auctionid, setAuctionid] = useState("2");
    const [currentPrice, setCurrentPrice] = useState<number>(0);
    const [Price, setBidAmount] = useState<number>(currentPrice);

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
            body: JSON.stringify({
                Auctionid: Auctionid.trim(),
                Userid: Userid.trim(),
                Price: Price,
            }),
        });

        const data = await res.json();

        if (data.success === "1") {
            // bid accepted → update current price
            setCurrentPrice(Price);
        } else if (data.error) {
            console.log("Bid failed:", data.error);
        } else {
            console.log("Unexpected response from server:", data);
        }
    } catch (err) {
        console.error("Failed to place bid:", err);
    }
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
