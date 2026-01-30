// Socket test client script extracted from inline HTML to satisfy CSP

const logArea = document.getElementById('log');
const statusEl = document.getElementById('status');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const heartbeatBtn = document.getElementById('heartbeatBtn');
const clearLogBtn = document.getElementById('clearLogBtn');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const transportModeSelect = document.getElementById('transportMode');
const restButtons = document.querySelectorAll('#restSection button[data-action]');
const callOfferBtn = document.getElementById('callOfferBtn');
const callAnswerBtn = document.getElementById('callAnswerBtn');
const callIceBtn = document.getElementById('callIceBtn');
const callEndBtn = document.getElementById('callEndBtn');
const offerSdpTextarea = document.getElementById('offerSdp');
const answerSdpTextarea = document.getElementById('answerSdp');
const candidateTextarea = document.getElementById('iceCandidate');
const callTargetUserIdInput = document.getElementById('callTargetUserId');
const callEndReasonInput = document.getElementById('callEndReason');
const autoHeartbeatCheckbox = document.getElementById('autoHeartbeat');
const heartbeatInfo = document.getElementById('heartbeatInfo');

let socket = null;
let lastPingAttempt = 0;

function log(message, data) {
    const timestamp = new Date().toISOString();
    const entry = document.createElement('div');
    entry.innerHTML = `<strong>[${timestamp}]</strong> ${message}`;
    if (data !== undefined) {
        const pre = document.createElement('pre');
        pre.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        entry.appendChild(pre);
    }
    logArea.appendChild(entry);
    logArea.scrollTop = logArea.scrollHeight;
}

function setStatus(text) { statusEl.textContent = text; }
function setHeartbeatInfo(text) { if (heartbeatInfo) heartbeatInfo.textContent = text; }
function getAccessToken() { return document.getElementById('accessToken').value.trim(); }
function getBaseUrl() { return document.getElementById('baseUrl').value.trim().replace(/\/$/, ''); }
function getSocketNamespace() {
    const raw = document.getElementById('socketPath').value.trim();
    if (!raw) return '/';
    return raw.startsWith('/') ? raw : `/${raw}`;
}
function getTransportMode() { return transportModeSelect?.value || 'auto'; }
function ensureSocket() {
    if (!socket || !socket.connected) throw new Error('Socket is not connected. Connect first.');
}

function sendHeartbeatAck(source = 'manual') {
    ensureSocket();
    socket.emit('heartbeat');
    const stamp = new Date();
    const attemptLabel = lastPingAttempt ? `ping #${lastPingAttempt}` : 'heartbeat';
    setHeartbeatInfo(`${attemptLabel} ack sent (${source}) at ${stamp.toLocaleTimeString()}`);
    log('Heartbeat ack sent', { source, attempt: lastPingAttempt, timestamp: stamp.toISOString() });
}

function parseJsonInput(raw, label) {
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid ${label} JSON: ${message}`);
    }
}

connectBtn.addEventListener('click', () => {
    const token = getAccessToken();
    const namespace = getSocketNamespace();
    const transportMode = getTransportMode();
    const baseUrl = getBaseUrl();

    if (socket?.connected) socket.disconnect();

    log('Attempting socket connection...', { baseUrl, namespace, transportMode });

    try {
        if (typeof io !== 'function') {
            throw new Error('socket.io client library not loaded (check /socket.io/socket.io.js network request)');
        }
        const connectionOptions = {
            auth: token ? { token } : undefined,
            query: token ? { token } : undefined,
            withCredentials: true,
            reconnectionAttempts: 3,
        };
        if (transportMode === 'websocket') {
            connectionOptions.transports = ['websocket'];
        }
        socket = io(baseUrl + namespace, connectionOptions);
    } catch (e) {
        log('Socket creation failed', e.message);
        return;
    }

    log('Socket instance created (waiting for connect)');
    socket.on('connect', () => {
        setStatus(`connected (id: ${socket.id})`);
        lastPingAttempt = 0;
        setHeartbeatInfo('Connected; waiting for heartbeat ping');
        const currentTransport = socket?.io?.engine?.transport?.name;
        log('Socket connected', { id: socket.id, transport: currentTransport });
    });
    socket.on('connect_error', (error) => {
        setStatus('connection error');
        const details = {
            message: error?.message,
            description: error?.description,
            context: error?.context,
            data: error?.data,
        };
        log('Connect error', details);
    });
    socket.on('disconnect', (reason) => {
        setStatus(`disconnected (${reason})`);
        lastPingAttempt = 0;
        setHeartbeatInfo(`Disconnected (${reason})`);
        log('Socket disconnected', reason);
    });
    socket.on('chat:message', (payload) => {
        log('Received chat:message', payload);
    });

    if (socket?.io?.engine) {
        socket.io.engine.on('upgrade', (transport) => {
            log('Transport upgraded', transport.name);
        });
        socket.io.engine.transport?.on('error', (event) => {
            log('Engine transport error', event?.message || event);
        });
    }

    socket.on('call:offer', (payload) => {
        log('Received call:offer', payload);
    });
    socket.on('call:answer', (payload) => {
        log('Received call:answer', payload);
    });
    socket.on('call:ice-candidate', (payload) => {
        log('Received call:ice-candidate', payload);
    });
    socket.on('call:end', (payload) => {
        log('Received call:end', payload);
    });

    socket.on('heartbeat', (payload) => {
        log('Received heartbeat event', payload ?? { type: 'ping' });
        const payloadType = payload?.type ?? 'ping';
        if (payloadType === 'ping') {
            lastPingAttempt = typeof payload?.attempt === 'number' ? payload.attempt : lastPingAttempt + 1;
            const stamp = new Date();
            setHeartbeatInfo(`Ping #${lastPingAttempt} at ${stamp.toLocaleTimeString()}`);
            if (autoHeartbeatCheckbox?.checked) {
                try {
                    sendHeartbeatAck('auto');
                } catch (error) {
                    log('Auto heartbeat ack failed', error.message);
                }
            }
        } else if (payloadType === 'timeout') {
            const stamp = new Date();
            setHeartbeatInfo(`Server timeout at ${stamp.toLocaleTimeString()}`);
        } else {
            setHeartbeatInfo(`Heartbeat event: ${payloadType}`);
        }
    });
});

disconnectBtn.addEventListener('click', () => {
    if (!socket) return;
    socket.disconnect();
    setStatus('disconnected');
    log('Manual disconnect requested');
});

heartbeatBtn.addEventListener('click', () => {
    try {
        sendHeartbeatAck('manual');
    } catch (error) {
        log('Heartbeat failed', error.message);
    }
});

autoHeartbeatCheckbox?.addEventListener('change', () => {
    log('Auto heartbeat toggled', { enabled: autoHeartbeatCheckbox.checked });
});

clearLogBtn.addEventListener('click', () => { logArea.innerHTML = ''; });

sendMessageBtn.addEventListener('click', () => {
    const content = document.getElementById('messageContent').value.trim();
    const targetUserId = document.getElementById('targetUserId').value.trim();
    if (!content) return log('Cannot send empty message');
    try {
        ensureSocket();
        const payload = { content };
        if (targetUserId) payload.userId = targetUserId;
        socket.emit('chat:send', payload, (response) => log('chat:send ack', response));
        log('Emitted chat:send', payload);
    } catch (error) {
        log('Emit failed', error.message);
    }
});

callOfferBtn.addEventListener('click', () => {
    try {
        ensureSocket();
        const offer = parseJsonInput(offerSdpTextarea.value.trim(), 'offer');
        if (!offer) return log('Offer payload is required');
        const targetUserId = callTargetUserIdInput.value.trim();
        const payload = { offer };
        if (targetUserId) payload.userId = targetUserId;
        socket.emit('call:offer', payload, (response) => log('call:offer ack', response));
        log('Emitted call:offer', payload);
    } catch (error) {
        log('call:offer failed', error.message);
    }
});

callAnswerBtn.addEventListener('click', () => {
    try {
        ensureSocket();
        const answer = parseJsonInput(answerSdpTextarea.value.trim(), 'answer');
        if (!answer) throw new Error('Answer payload is required');
        const targetUserId = callTargetUserIdInput.value.trim();
        const payload = { answer };
        if (targetUserId) payload.userId = targetUserId;
        socket.emit('call:answer', payload, (response) => log('call:answer ack', response));
        log('Emitted call:answer', payload);
    } catch (error) {
        log('call:answer failed', error.message);
    }
});

callIceBtn.addEventListener('click', () => {
    try {
        ensureSocket();
        const candidate = parseJsonInput(candidateTextarea.value.trim(), 'candidate');
        if (!candidate) throw new Error('Candidate payload is required');
        const payload = { candidate };
        const targetUserId = callTargetUserIdInput.value.trim();
        if (targetUserId) payload.userId = targetUserId;
        socket.emit('call:ice-candidate', payload, (response) => log('call:ice-candidate ack', response));
        log('Emitted call:ice-candidate', payload);
    } catch (error) {
        log('call:ice-candidate failed', error.message);
    }
});

callEndBtn.addEventListener('click', () => {
    try {
        ensureSocket();
        const payload = {};
        const targetUserId = callTargetUserIdInput.value.trim();
        if (targetUserId) payload.userId = targetUserId;
        const reason = callEndReasonInput.value.trim();
        if (reason) payload.reason = reason;
        socket.emit('call:end', payload, (response) => log('call:end ack', response));
        log('Emitted call:end', payload);
    } catch (error) {
        log('call:end failed', error.message);
    }
});

restButtons.forEach((btn) => {
    btn.addEventListener('click', () => handleRestAction(btn.dataset.action));
});

async function handleRestAction(action) {
    const base = getBaseUrl();
    const token = getAccessToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const page = Number(document.getElementById('page').value || 1);
    const limit = Number(document.getElementById('limit').value || 50);
    const userId = document.getElementById('restUserId').value.trim();
    const message = document.getElementById('restMessage').value.trim();

    const api = async (method, path, body, query) => {
        const url = new URL(base + path);
        if (query) {
            Object.entries(query).forEach(([k, v]) => {
                if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
            });
        }
        log(`${method} ${url.pathname}${url.search}`);
        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });
        const text = await response.text();
        let parsed;
        try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
        if (!response.ok) return log('Request failed', { status: response.status, body: parsed });
        log('Request success', parsed);
    };

    try {
        switch (action) {
            case 'fetch-me': await api('GET', '/api/v1/chat/me'); break;
            case 'fetch-me-messages': await api('GET', '/api/v1/chat/me/messages', null, { page, limit }); break;
            case 'list-chats': await api('GET', '/api/v1/chat/users', null, { page, limit }); break;
            case 'fetch-user-messages':
                if (!userId) throw new Error('User ID is required');
                await api('GET', `/api/v1/chat/users/${userId}/messages`, null, { page, limit });
                break;
            case 'send-user-message':
                if (!userId) throw new Error('User ID is required');
                if (!message) throw new Error('Message body is required');
                await api('POST', `/api/v1/chat/users/${userId}/messages`, { content: message });
                break;
            case 'presence-count': await api('GET', '/api/v1/chat/presence/online/count'); break;
            case 'presence-user':
                if (!userId) throw new Error('User ID is required');
                await api('GET', `/api/v1/chat/presence/${userId}`); break;
            default: log('Unknown action', action);
        }
    } catch (error) {
        log('REST helper error', error.message);
    }
}
