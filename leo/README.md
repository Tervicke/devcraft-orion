# How to run

lets use bootstrap for this :') i dont have the brains for css
i have used bootstrap in there
you're going to get
1. username
2. auction_id
3. bid
the code for it is here https://github.com/Tervicke/devcraft-orion/blob/main/leo/src/components/Bidder.tsx

```bash
# install deps
bun install

# run with hot reload
bun --hot run start
```

```bash
# to check the fetch request with netcat
nc -lnvp 8080
```

### send the request via the frontend and paste this
```bash
HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
Content-Length: 0
```
