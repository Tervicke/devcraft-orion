import asyncio
import aiohttp
import websockets
import json
import random
import time
import statistics
import os
import sys

AUCTION_ID = input("Input auction id: ")
HTTP_URL = "http://localhost:3000/bid"
WS_URL = "ws://localhost:8081/ws"

VIEWERS = 1000
BIDDERS = 10

current_price = float(input("Enter starting price: "))
price_lock = asyncio.Lock()

# -------- STATS --------
total_requests = 0
success_count = 0
fail_count = 0
latencies = []
active_viewers = 0

stats_lock = asyncio.Lock()
start_time = time.time()


# ----------------------------
# LIVE DASHBOARD
# ----------------------------
async def dashboard():
    global total_requests, success_count, fail_count, latencies

    while True:
        await asyncio.sleep(1)

        async with stats_lock:
            elapsed = time.time() - start_time
            rps = total_requests / elapsed if elapsed > 0 else 0

            avg_latency = statistics.mean(latencies) if latencies else 0
            p95_latency = (
                statistics.quantiles(latencies, n=20)[-1]
                if len(latencies) > 20 else avg_latency
            )
            max_latency = max(latencies) if latencies else 0

            success_rate = (
                (success_count / total_requests) * 100
                if total_requests > 0 else 0
            )

        os.system("clear")

        print("🚀 AUCTION LOAD TEST")
        print("=" * 50)
        print(f"Viewers Connected : {active_viewers}/{VIEWERS}")
        print(f"Bidders           : {BIDDERS}")
        print("-" * 50)
        print(f"Current Price     : {current_price:.2f}")
        print("-" * 50)
        print(f"Total Requests    : {total_requests}")
        print(f"Success           : {success_count}")
        print(f"Failed            : {fail_count}")
        print(f"Success Rate      : {success_rate:.2f}%")
        print(f"Requests/sec      : {rps:.2f}")
        print("-" * 50)
        print(f"Avg Latency       : {avg_latency:.2f} ms")
        print(f"P95 Latency       : {p95_latency:.2f} ms")
        print(f"Max Latency       : {max_latency:.2f} ms")
        print("=" * 50)


# ----------------------------
# VIEWER (WebSocket Listener)
# ----------------------------
async def viewer_task(i):
    global current_price, active_viewers

    try:
        async with websockets.connect(WS_URL) as ws:
            async with stats_lock:
                active_viewers += 1

            async for message in ws:
                try:
                    data = json.loads(message)

                    if "Price" in data:
                        async with price_lock:
                            current_price = float(data["Price"])

                except:
                    pass

    except:
        pass


# ----------------------------
# BIDDER
# ----------------------------
async def bidder_task(i):
    global total_requests, success_count, fail_count, latencies

    async with aiohttp.ClientSession() as session:
        while True:
            await asyncio.sleep(random.uniform(1, 3))

            async with price_lock:
                bid_price = current_price + random.uniform(10, 50)

            payload = {
                "auctionid": AUCTION_ID,
                "userid": "-1",
                "price": round(bid_price, 2)
            }

            start = time.time()

            try:
                async with session.post(HTTP_URL, json=payload) as resp:
                    latency = (time.time() - start) * 1000

                    async with stats_lock:
                        total_requests += 1
                        latencies.append(latency)

                        if resp.status == 200:
                            success_count += 1
                        else:
                            fail_count += 1

            except:
                async with stats_lock:
                    total_requests += 1
                    fail_count += 1


# ----------------------------
# MAIN
# ----------------------------
async def main():
    tasks = []

    # dashboard
    tasks.append(asyncio.create_task(dashboard()))

    # viewers
    for i in range(1, VIEWERS + 1):
        tasks.append(asyncio.create_task(viewer_task(i)))

    # bidders
    for i in range(1, BIDDERS + 1):
        tasks.append(asyncio.create_task(bidder_task(i)))

    await asyncio.gather(*tasks)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nStopped.")

