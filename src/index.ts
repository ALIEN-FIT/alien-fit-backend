import express from 'express';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { initializeDatabase } from './database/db-config.js';
import { initializeApp } from './app.js';
import { passportConfig } from './config/passport.config.js';
import { env } from './config/env.js';
import { initializeSocketServer } from './socket/socket-server.js';
import { startNotificationWorkers } from './workers/notification/index.js';
import { initializeOTPCleanupJob } from './workers/otp-cleanup.worker.js';

const app = express();
const PORT = env.PORT;

// Toggle via env.HTTPS=true
const USE_HTTPS = String(env.HTTPS).toLowerCase() === 'true';

const server = USE_HTTPS
    ? https.createServer(
        {
            key: fs.readFileSync(path.resolve('.cert/192.168.1.47-key.pem')),
            cert: fs.readFileSync(path.resolve('.cert/192.168.1.47.pem')),
        },
        app
    )
    : http.createServer(app);

await initializeDatabase();
passportConfig();
initializeApp(app);
initializeSocketServer(server);
startNotificationWorkers();
initializeOTPCleanupJob();

server.listen(PORT, () => {
    console.log(`Server running with Socket.io on ${USE_HTTPS ? 'HTTPS' : 'HTTP'} on port ${PORT}`);
});