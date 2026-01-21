Local WebRTC Docker (TURN/STUN)

This composes a local Coturn TURN/STUN server for testing WebRTC.

Files added
- docker-compose.yml
- turnserver.conf

Run

1. Start Coturn:

```bash
docker compose up -d
```

2. Verify service is listening:

```bash
docker compose ps
```

How to test with the app

- In the browser open Caller and Callee pages.
- For the backend URL enter `http://localhost:<port>` (e.g. `http://localhost:3000`).
  - The client JS will extract the hostname (`localhost`) and use `stun:localhost:3478` and `turn:localhost:3478`.
- For token enter your `Bearer <token>` string.
- Click `Connect` on both pages, then `Start Call` on Caller.

Notes
- The TURN user is `test` with password `testpass` (matches existing client code).
- If your app runs on a different host/port, use that host in the Backend URL so the ICE server host is derived correctly.
- For production use, secure Coturn (TLS) and use proper credential management.
