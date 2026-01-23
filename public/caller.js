let ICE_SERVERS = [];
let socket = null;

let heartbeatIntervalId = null;

let pc;
let localStream;
let pendingRemoteCandidates = [];

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const startBtn = document.getElementById("startCall");
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
        console.log("Caller connected:", socket.id);
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

    socket.on("call:answer", async ({ answer }) => {
        if (!pc) {
            console.warn("No active peer connection to apply answer");
            return;
        }

        try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            await drainPendingCandidates();
            console.log("Received answer from trainer");
        } catch (error) {
            console.error("Failed to apply remote answer", error);
        }
    });

    socket.on("call:ice-candidate", async ({ candidate }) => {
        await addOrQueueCandidate(candidate);
    });

    socket.on("call:end", () => {
        console.log("Call ended by peer");
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

startBtn.onclick = async () => {
    if (pc) {
        console.warn("Call already active");
        return;
    }
    if (!socket) {
        console.warn("Socket not connected. Press Connect first.");
        return;
    }

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
            if (event.candidate) {
                socket.emit("call:ice-candidate", { candidate: event.candidate, target: "trainers" });
            }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("call:offer", { offer, target: "trainers" });
    } catch (error) {
        console.error("Failed to start call", error);
        cleanupCall();
    }
};

endBtn.onclick = () => {
    socket.emit("call:end", { status: "ended" });
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
        // if user provided a hostname without protocol, assume https
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
