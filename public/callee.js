let ICE_SERVERS = [];
let socket = null;

let heartbeatIntervalId = null;

let pc;
let localStream;
let activeUserId;
let pendingRemoteCandidates = [];

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const endBtn = document.getElementById("endCall");

// UI for dynamic backend URL and token
const backendInput = document.getElementById("backendUrl");
const tokenInput = document.getElementById("token");
const connectBtn = document.getElementById("connectBtn");

function startHeartbeat() {
    stopHeartbeat();
    heartbeatIntervalId = setInterval(() => {
        if (socket && socket.connected) {
            socket.emit("heartbeat");
        }
    }, 5000);
}

function stopHeartbeat() {
    if (heartbeatIntervalId) {
        clearInterval(heartbeatIntervalId);
        heartbeatIntervalId = null;
    }
}

function setupSocketHandlers() {
    if (!socket) return;

    socket.on("connect", () => {
        console.log("Callee connected:", socket.id);
        connectBtn.disabled = true;
        backendInput.disabled = true;
        tokenInput.disabled = true;
        startHeartbeat();
    });

    // Server sends heartbeat pings; respond to keep the connection alive.
    socket.on("heartbeat", () => {
        if (socket && socket.connected) {
            socket.emit("heartbeat");
        }
    });

    socket.on("call:offer", async ({ offer, userId }) => {
        console.log("Received offer from user:", userId);

        if (pc) {
            cleanupCall();
        }

        activeUserId = userId;

        try {
            pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localVideo.srcObject = localStream;
            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

            pc.ontrack = event => {
                if (event.streams && event.streams[0]) {
                    remoteVideo.srcObject = event.streams[0];
                }
            };

            pc.onicecandidate = event => {
                if (event.candidate && activeUserId) {
                    socket.emit("call:ice-candidate", { candidate: event.candidate, target: activeUserId });
                }
            };

            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            await drainPendingCandidates();

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socket.emit("call:answer", { answer, target: activeUserId });
        } catch (error) {
            console.error("Failed to handle incoming offer", error);
            cleanupCall();
        }
    });

    socket.on("call:ice-candidate", async ({ candidate, userId }) => {
        if (!pc || (activeUserId && userId && userId !== activeUserId)) {
            return;
        }
        await addOrQueueCandidate(candidate);
    });

    socket.on("call:end", ({ userId, reason }) => {
        if (!activeUserId || (userId && userId !== activeUserId)) {
            return;
        }

        console.log("Call ended by peer", reason ? `(${reason})` : "");
        cleanupCall();
    });

    socket.on("disconnect", () => {
        stopHeartbeat();
        cleanupCall();
    });
}

function cleanupCall() {
    if (pc) {
        pc.close();
        pc = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    activeUserId = undefined;
    pendingRemoteCandidates = [];
}

async function addOrQueueCandidate(candidate) {
    if (!pc || !candidate) return;
    if (!pc.remoteDescription) {
        pendingRemoteCandidates.push(candidate);
        return;
    }
    try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
        console.error("Error adding remote candidate", error);
    }
}

async function drainPendingCandidates() {
    if (!pc) return;
    for (const c of pendingRemoteCandidates) {
        try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch (error) {
            console.error("Error adding queued candidate", error);
        }
    }
    pendingRemoteCandidates = [];
}
endBtn.onclick = () => {
    if (activeUserId) {
        socket.emit("call:end", { target: activeUserId, status: "ended" });
    }
    cleanupCall();
};


// Connect button creates socket and registers handlers
connectBtn.onclick = () => {
    const backend = (backendInput.value || window.location.origin).trim();
    const token = (tokenInput.value || "").trim();

    let origin;
    try {
        origin = new URL(backend).origin;
    } catch (e) {
        try {
            origin = new URL(`https://${backend}`).origin;
        } catch (err) {
            console.error("Invalid backend URL");
            return;
        }
    }

    const host = new URL(origin).hostname;

    ICE_SERVERS = [
        { urls: `stun:${host}:3478` },
        { urls: `turn:${host}:3478?transport=udp`, username: "test", credential: "testpass" },
        { urls: `turn:${host}:5349?transport=tcp`, username: "test", credential: "testpass" }
    ];

    socket = io(origin, { auth: { token } });
    setupSocketHandlers();
};
