// GM console script
let gmChannel = null;

if ("BroadcastChannel" in window) {
    gmChannel = new BroadcastChannel("friend-computer");
} else {
    alert("BroadcastChannel not supported in this browser. Use a modern Chrome/Edge/Firefox.");
}

// Helper to send a simple command to the display tab
function sendCommand(command, payload = {}) {
    if (!gmChannel) return;
    gmChannel.postMessage({
        type: "cmd",
        command,
        payload
    });
}

// ---------------------------
// FRIEND COMPUTER VOICE (LOCAL TO GM PAGE)
// ---------------------------
let gmVoice = null;

function selectGMVoice() {
    if (!("speechSynthesis" in window)) return;

    const voices = window.speechSynthesis.getVoices();
    if (!voices || !voices.length) return;

    const preferredNames = [
        "Microsoft Zira Desktop",
        "Microsoft Zira",
        "Google US English",
        "Samantha",
        "Victoria"
    ];

    // Try preferred "female-ish" English voices first
    for (const name of preferredNames) {
        const v = voices.find(
            (voice) =>
                voice.name.toLowerCase().includes(name.toLowerCase()) &&
                voice.lang.toLowerCase().startsWith("en")
        );
        if (v) {
            gmVoice = v;
            console.log("[GM] Using voice:", v.name, v.lang);
            return;
        }
    }

    // Fallback: any English voice
    const anyEnglish = voices.find((v) =>
        v.lang.toLowerCase().startsWith("en")
    );
    gmVoice = anyEnglish || voices[0];
    if (gmVoice) {
        console.log("[GM] Fallback voice:", gmVoice.name, gmVoice.lang);
    }
}

// Some browsers load voices async
if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = selectGMVoice;
    selectGMVoice();
}

function speakLocallyAsFriendComputer(text) {
    if (!("speechSynthesis" in window)) {
        console.warn("[GM] speechSynthesis not supported in this browser.");
        return;
    }
    if (!text) return;

    const utter = new SpeechSynthesisUtterance(text);

    // If we’ve managed to pick a voice, use it
    if (gmVoice) {
        utter.voice = gmVoice;
        utter.lang = gmVoice.lang;
    } else {
        // Fallback – still speak using default
        utter.lang = "en-US";
    }

    utter.rate = 0.9;   // slightly slower
    utter.pitch = 1.3;  // slightly higher
    utter.volume = 1.0;

    // Cancel any ongoing speech so it doesn't overlap weirdly
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
}

// ---------------------------
// BUTTONS / UI WIRING
// ---------------------------
// Wire up buttons (no need for a single container)
const gmButtons = document.querySelectorAll("button[data-cmd]");

gmButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        const cmd = btn.getAttribute("data-cmd");
        const level = btn.getAttribute("data-level");
        const payload = level ? { level } : {};
        sendCommand(cmd, payload);
    });
});


// Speech box
const textArea = document.getElementById("gm-text");
const speakBtn = document.getElementById("gm-speak");

function sendSpeech() {
    const text = textArea.value.trim();
    if (!text) return;

    // 1) Tell the display tab what was said (for status line or logging)
    sendCommand("speak", { text });

    // 2) Actually speak here on the GM page
    speakLocallyAsFriendComputer(text);

    // Optional: clear or keep text – your choice
    // textArea.value = "";
}

speakBtn.addEventListener("click", sendSpeech);

textArea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        sendSpeech();
    }
});

// Keyboard shortcuts for GM commands (NOT speech)
document.addEventListener("keydown", (e) => {
    // Avoid triggering while typing into the textarea
    if (e.target && e.target.tagName === "TEXTAREA") return;

    switch (e.key) {
        case "1":
            sendCommand("setThreat", { level: "BLUE" });
            break;
        case "2":
            sendCommand("setThreat", { level: "YELLOW" });
            break;
        case "3":
            sendCommand("setThreat", { level: "ORANGE" });
            break;
        case "4":
            sendCommand("setThreat", { level: "RED" });
            break;
        case "5":
            sendCommand("setThreat", { level: "ULTRAVIOLET" });
            break;

        case "a":
        case "A":
            sendCommand("angry");
            break;
        case "e":
        case "E":
            sendCommand("error");
            break;
        case "s":
        case "S":
            sendCommand("squint");
            break;
        case "i":
        case "I":
            sendCommand("interrogate");
            break;
        case "b":
        case "B":
            sendCommand("ad");
            break;
        case "h":
        case "H":
            sendCommand("toggleEye");
            break;
        case "d":
        case "D":
            sendCommand("drugged");
            break;
        case "c":
        case "C":
            sendCommand("cloneAlert");
            break;
        default:
            break;
    }
});

