# How to run

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

# send the request via the frontend and paste this
```bash
HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
Content-Length: 0
```
