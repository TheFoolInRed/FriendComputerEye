// ========================================================
// FRIEND COMPUTER EYE - JS CONTROLLER
// (display side / index.html)
// ========================================================

// ---------------------------
// ELEMENT LOOKUPS
// ---------------------------
const screenEl   = document.getElementById("screen");
const statusText = document.getElementById("status-text");

const eye   = document.getElementById("eye");
const iris  = document.getElementById("iris");
const pupil = document.getElementById("pupil");

const adOverlay = document.getElementById("ad-overlay");

const adProduct = document.getElementById("ad-product");
const adMain    = document.getElementById("ad-text-main");
const adSub     = document.getElementById("ad-text-sub");
const adMini    = document.getElementById("ad-text-mini");
const adImage   = document.getElementById("ad-image");

const crtWarmupEl   = document.getElementById("crt-warmup");
const crtShutdownEl = document.getElementById("crt-shutdown");
const crtDegaussEl  = document.getElementById("crt-degauss");

const sndCRTStart = document.getElementById("crt-start");
const sndCRTHum   = document.getElementById("crt-hum");

// For the little shutdown "pop"
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();


// ---------------------------
// GLOBAL STATE
// ---------------------------
let eyeHidden = false;
let adActive  = false;

const MAX_EYE_OFFSET  = 90;
const MAX_IRIS_OFFSET = 12;

let target        = { x: 0, y: 0 };
let current       = { x: 0, y: 0 };
let lastMouseTime = Date.now();

let isPatrolling = false;
let patrolIndex  = 0;

let manualGlitch = false;  // true if user toggled glitch with G
let crtOn        = true;

let interrogationActive = false;
let interrogationTimer  = null;

let druggedActive = false;
let druggedTimer  = null;


// ==============================
// Cross-tab control (GM console)
// ==============================
let gmChannel = null;

if ("BroadcastChannel" in window) {
    gmChannel = new BroadcastChannel("friend-computer");

    gmChannel.onmessage = (event) => {
        const msg = event.data;
        if (!msg || !msg.type) return;

        if (msg.type === "cmd") {
            handleRemoteCommand(msg.command, msg.payload);
        }
    };
}
// ---------------------------
// THREAT LEVEL SYSTEM
// ---------------------------
const THREAT_LEVELS = ["BLUE", "YELLOW", "ORANGE", "RED", "ULTRAVIOLET"];
const THREAT_CLASSES = [
    "threat-blue",
    "threat-yellow",
    "threat-orange",
    "threat-red",
    "threat-ultraviolet"
];

let currentThreatLevel = "BLUE";

function setThreatLevel(level) {
    if (!level) level = "BLUE";
    level = level.toUpperCase();

    if (!THREAT_LEVELS.includes(level)) {
        level = "BLUE";
    }

    currentThreatLevel = level;

    // Update screen class
    THREAT_CLASSES.forEach((cls) => screenEl.classList.remove(cls));
    const cssClass = "threat-" + level.toLowerCase();
    screenEl.classList.add(cssClass);

    // Update indicator label + its own class
    const threatIndicator = document.getElementById("threat-indicator");
    const threatLabel = document.getElementById("threat-label");

    if (threatIndicator) {
        THREAT_CLASSES.forEach((cls) => threatIndicator.classList.remove(cls));
        threatIndicator.classList.add(cssClass);
    }
    if (threatLabel) {
        threatLabel.textContent = "THREAT LEVEL: " + level;
    }

    // Optional: a status line snark per level
    let msg = "";
    switch (level) {
        case "BLUE":
            msg = "THREAT LEVEL BLUE: ALL SYSTEMS NOMINAL* *PROBABLY.";
            break;
        case "YELLOW":
            msg = "THREAT LEVEL YELLOW: POSSIBLE TREASONOUS THOUGHTS DETECTED.";
            break;
        case "ORANGE":
            msg = "THREAT LEVEL ORANGE: CONFIRMED TREASON RISK.";
            break;
        case "RED":
            msg = "THREAT LEVEL RED: TERMINATION IMMINENT. HAVE A PLEASANT DAY.";
            break;
        case "ULTRAVIOLET":
            msg = "THREAT LEVEL ULTRAVIOLET: INFORMATION HAZARD. AVERT YOUR EYES.";
            break;
    }

    showStatusMessage(msg);

    // Small glitch flourish on major jumps
    if (typeof glitchBurst === "function" && (level === "ORANGE" || level === "RED" || level === "ULTRAVIOLET")) {
        glitchBurst(260);
    }
}

function handleRemoteCommand(command, payload) {
    switch (command) {
        case "toggleEye":
            toggleEyeVisibility();
            break;
        case "ad":
            toggleAd();
            break;
        case "happyAd":
            showHappyAd();
            break;
        case "glitch":
            toggleGlitch();
            break;
        case "setThreat":
            if (payload && payload.level) {
                setThreatLevel(payload.level);
            } else {
                setThreatLevel("BLUE");
            }
            break;
        case "destabilize":
            destabilizeIris();
            break;
        case "error": {
            const active = screenEl.classList.toggle("error-active");
            iris.style.setProperty("--iris-scale", active ? "1.15" : "1.0");
            if (active) glitchBurst(260);
            break;
        }
        case "angry":
            eye.classList.toggle("angry");
            iris.style.setProperty(
                "--iris-scale",
                eye.classList.contains("angry") ? "0.9" : "1.0"
            );
            doBlink();
            break;
        case "squint":
            eye.classList.toggle("squint");
            break;
        case "interrogate":
            interrogationActive ? stopInterrogation() : startInterrogation();
            break;
        case "drugged":
            druggedActive ? stopDrugged() : startDrugged();
            break;
        case "cloneAlert":
            triggerCloneAlert();
            break;
        case "degauss":
            crtDegauss();
            break;
        case "speak":
            if (payload && payload.text) {
                // Just show it in the status line, no audio needed
                showStatusMessage(`COMPUTER RESPONSE: ${payload.text}`);
            }
            break;


        default:
            console.warn("Unknown GM command:", command);
    }
}


// =======================
// Friend Computer voice
// =======================
const fcTextInput = document.getElementById("fc-text"); // null on index.html
let fcVoice = null;

function selectFriendComputerVoice() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || !voices.length) return;

    const preferredNames = [
        "Microsoft Zira Desktop",
        "Microsoft Zira",
        "Google US English",
        "Samantha",
        "Victoria",
    ];

    for (const name of preferredNames) {
        const v = voices.find(
            (voice) =>
                voice.name.toLowerCase().includes(name.toLowerCase()) &&
                voice.lang.toLowerCase().startsWith("en")
        );
        if (v) {
            fcVoice = v;
            return;
        }
    }

    const anyEnglish = voices.find((v) =>
        v.lang.toLowerCase().startsWith("en")
    );
    fcVoice = anyEnglish || voices[0];
}

if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = selectFriendComputerVoice;
    selectFriendComputerVoice();
}

function speakAsFriendComputer(text) {
    if (!text || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    if (fcVoice) utter.voice = fcVoice;
    utter.lang = fcVoice?.lang || "en-US";
    utter.rate = 0.9;
    utter.pitch = 1.3;
    utter.volume = 1.0;

    window.speechSynthesis.speak(utter);
}


// ---------------------------
// ADS
// ---------------------------
const ads = [
    {
        product: "Bouncy Bubble Beverage™",
        image: "images/bbb.png",
        main: "ENJOY BOUNCY BUBBLE BEVERAGE™",
        sub: "HAPPINESS IS MANDATORY",
        mini: "Side effects may include loyalty, enthusiasm, and spontaneous confessions.",
    },
    {
        product: "Hot Fun™ (On-a-Stick)",
        image: null,
        main: "TRY HOT FUN™ ON-A-STICK",
        sub: "NOW 37% LESS LIKELY TO IGNITE YOUR LIPS",
        mini: "May contain traces of prior test subjects.",
    },
    {
        product: "Cold Fun™",
        image: "images/cold_fun.png",
        main: "COLD FUN™",
        sub: "NOW WITH FLAVOR APPROVED FOR YOUR CLEARANCE LEVEL!",
        mini: "Consumption above clearance may result in summary promotion to ‘deceased’.",
    },
    {
        product: "Happy Pill™",
        image: null, // your poster later
        main: "HAPPY PILL™ (STANDARD ISSUE)",
        sub: "BECAUSE SADNESS IS TREASON.",
        mini: "Report any remaining unhappiness to your nearest Loyalty Officer immediately.",
    },
    {
        product: "Infrared-Brand Toothpaste™",
        image: "images/infrared_toothpaste.png",
        main: "INFRARED-BRAND TOOTHPASTE™",
        sub: "BRUSH AWAY PLAQUE. DISSOLVE SECRETS.",
        mini: "Warning: extended brushing may remove unsanctioned thoughts.",
    },
    {
        product: "Zap-O-Matic™ Laser Cleaning System",
        image: "images/zapomatic.png",
        main: "ZAP-O-MATIC™ LASER CLEANING",
        sub: "FOR WHEN SOAP JUST ISN’T LETHAL ENOUGH.",
        mini: "Not responsible for removal of limbs, memories, or classified material.",
    },
    {
        product: "LoyaltyCheck™ Home Test Kit",
        image: null,
        main: "LOYALTYCHECK™ HOME TEST KIT",
        sub: "TEST YOUR FRIENDS BEFORE THEY TESTIFY ABOUT YOU.",
        mini: "Positive result requires immediate celebration and/or denunciation.",
    },
    {
        product: "AutoForm-3000™ Expense Forms",
        image: null,
        main: "AUTOFORM-3000™ TROUBLESHOOTER EXPENSE FORMS",
        sub: "TURN 3 HOURS OF PAPERWORK INTO 45 PAINFUL MINUTES.",
        mini: "Improperly filed forms may incur retroactive fines up to time of birth.",
    },
    {
        product: "Peace Enforcement Sidearm™",
        image: null,
        main: "PEACE ENFORCEMENT SIDEARM™",
        sub: "NOTHING SAYS ‘TRUST’ LIKE A CHARGED LASER.",
        mini: "Point in a safe direction. Or at traitors. Friend Computer trusts your judgment.",
    },
];

function showRandomAd() {
    const ad = ads[Math.floor(Math.random() * ads.length)];

    adProduct.textContent = ad.product;
    adMain.textContent    = ad.main;
    adSub.textContent     = ad.sub;
    adMini.textContent    = ad.mini;

    if (ad.image) {
        adImage.style.display = "block";
        adImage.src = ad.image;
    } else {
        adImage.style.display = "none";
        adImage.removeAttribute("src");
    }
}

function showHappyAd() {
    const happy =
        ads.find((a) => a.product.startsWith("Happy Pill")) || ads[0];

    if (!screenEl.classList.contains("show-ad")) {
        screenEl.classList.add("show-ad");
        adOverlay.classList.add("visible");
        adActive = true;
        glitchBurst(220);
        showStatusMessage("ALL CITIZENS HAPPY.");
    }

    adProduct.textContent = happy.product;
    adMain.textContent    = happy.main;
    adSub.textContent     = happy.sub;
    adMini.textContent    = happy.mini;

    if (happy.image) {
        adImage.style.display = "block";
        adImage.src = happy.image;
    } else {
        adImage.style.display = "none";
        adImage.removeAttribute("src");
    }
}


// ---------------------------
// STATUS MESSAGES
// ---------------------------
const statusLines = [
    "ALL SYSTEMS NOMINAL.",
    "NO TRAITOROUS ACTIVITY DETECTED.",
    "ALL CITIZENS HAPPY.",
    "THE COMPUTER IS YOUR FRIEND",
    "YOUR EQUIPMENT IS IN ERROR. YOU WILL STOP GLOWING SHORTLY",
    "ERROR COUNT: 0 (APPROXIMATELY).",
    "LOYALTY INDEX: SATISFACTORY* *MARGIN OF ERROR ±93%.",
    "THIS MISSION WILL BE VERY SAFE AND LOTS OF FUN FOR ALL OF YOU",
    "INSTRUCTIONS FOR DISARMING NUCLEAR DEVICES ARE NOT AVAILABLE AT YOUR CLEARANCE LEVEL. PLEASE PUT DEVICE IN A SAFE PLACE",
    "PLEASE REPORT ALL SIGNS OF COMMIE MUTANT TRAITOR ACTIVITY",
    "COLD FUN IS NOT TO BE USED AS REACTOR SHIELDING",
    "YOU ARE IN ERROR. NO ONE IS SCREAMING. THANK YOU FOR YOUR COOPERATION",
    "TRUST THE COMPUTER. THE COMPUTER IS YOUR FRIEND.",
    "HAVE YOU HAD YOUR BOUNCY BUBBLE BEVERAGE TODAY, CITIZEN?",
    "PLEASE IGNORE ANY SUSPICIOUS NOISES.",
    "REMEMBER: QUESTIONING THE COMPUTER IS TREASON.",
];

function showStatusMessage(text) {
    if (!statusText) return;
    statusText.textContent = text;
    statusText.classList.add("visible");
    setTimeout(() => statusText.classList.remove("visible"), 5000);
}

// Random lying status line every ~22s
setInterval(() => {
    const busy =
        screenEl.classList.contains("error-active") ||
        screenEl.classList.contains("show-ad");
    if (busy) return;

    const line = statusLines[Math.floor(Math.random() * statusLines.length)];
    showStatusMessage(line);
}, 22000);


// ---------------------------
// GLITCH & STATIC
// ---------------------------
function toggleGlitch() {
    manualGlitch = !manualGlitch;
    screenEl.classList.toggle("glitch-active", manualGlitch);
    if (manualGlitch) {
        showStatusMessage("MINOR GRAPHIC ANOMALIES: IGNORE.");
    }
}

function glitchBurst(duration = 250) {
    if (manualGlitch) return;
    screenEl.classList.add("glitch-active");
    setTimeout(() => {
        if (!manualGlitch) {
            screenEl.classList.remove("glitch-active");
        }
    }, duration);
}


// ---------------------------
// EYE MOVEMENT
// ---------------------------
const gazePresets = {
    "1": { xFrac: 0.2, yFrac: 0.7 },
    "2": { xFrac: 0.4, yFrac: 0.7 },
    "3": { xFrac: 0.6, yFrac: 0.7 },
    "4": { xFrac: 0.8, yFrac: 0.7 },
};

const patrolPoints = [
    { xFrac: 0.5, yFrac: 0.25, hold: 1400 },
    { xFrac: 0.18, yFrac: 0.7,  hold: 1400 },
    { xFrac: 0.82, yFrac: 0.7,  hold: 1400 },
    { xFrac: 0.35, yFrac: 0.7,  hold: 1400 },
    { xFrac: 0.65, yFrac: 0.7,  hold: 1400 },
];

function moveEyeTo(x, y) {
    const rect    = screenEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top  + rect.height / 2;

    const dx = x - centerX;
    const dy = y - centerY;
    const dist    = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(dist, MAX_EYE_OFFSET);

    const nx = (dx / dist) * clamped;
    const ny = (dy / dist) * clamped;

    const eyeCenterX = centerX + nx;
    const eyeCenterY = centerY + ny;

    const eyeWidth  = eye.offsetWidth;
    const eyeHeight = eye.offsetHeight;

    const localX = eyeCenterX - rect.left - eyeWidth / 2;
    const localY = eyeCenterY - rect.top  - eyeHeight / 2;

    eye.style.left = localX + "px";
    eye.style.top  = localY + "px";
}

function moveIrisTo(x, y) {
    const rectEye = eye.getBoundingClientRect();
    const cx = rectEye.left + rectEye.width  / 2;
    const cy = rectEye.top  + rectEye.height / 2;

    const dx = x - cx;
    const dy = y - cy;

    const dist    = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(dist, MAX_IRIS_OFFSET);

    const nx = (dx / dist) * clamped;
    const ny = (dy / dist) * clamped;

    iris.style.setProperty("--iris-offset-x", nx + "px");
    iris.style.setProperty("--iris-offset-y", ny + "px");
}

// Main animation loop
function animate() {
    const now  = Date.now();
    const dt   = Math.min((now - lastMouseTime) / 16, 2);
    const ease = 0.15 * dt;

    current.x += (target.x - current.x) * ease;
    current.y += (target.y - current.y) * ease;

    moveEyeTo(current.x, current.y);
    moveIrisTo(current.x, current.y);

    requestAnimationFrame(animate);
}


// ---------------------------
// BLINKS & DILATION
// ---------------------------
function doBlink() {
    eye.classList.remove("blinking");
    void eye.offsetWidth;
    eye.classList.add("blinking");
    setTimeout(() => {
        eye.classList.remove("blinking");
    }, 220);
}

function doDoubleBlink() {
    doBlink();
    setTimeout(doBlink, 230);
}

setInterval(() => {
    const now = Date.now();
    if (adActive) return;
    if (now - lastMouseTime > 800 && Math.random() < 0.25) {
        doBlink();
    }
}, 3000);

function randomDilation() {
    const base     = 1.0;
    const variance = 0.15;
    const scale    = base + (Math.random() * 2 - 1) * variance;
    iris.style.setProperty("--iris-scale", scale.toFixed(2));
}

setInterval(() => {
    if (!screenEl.classList.contains("error-active") &&
        !eye.classList.contains("angry") &&
        !eye.classList.contains("drugged") &&
        !adActive) {
        randomDilation();
    }
}, 2500);


// ---------------------------
// PATROL + IDLE WANDER
// ---------------------------
function runPatrolStep() {
    if (!isPatrolling || adActive) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const p = patrolPoints[patrolIndex];

    target.x = p.xFrac * w;
    target.y = p.yFrac * h;
    lastMouseTime = Date.now();

    patrolIndex = (patrolIndex + 1) % patrolPoints.length;
    setTimeout(runPatrolStep, p.hold);
}

setInterval(() => {
    const now = Date.now();
    if (!isPatrolling && !adActive && now - lastMouseTime > 3000) {
        const w  = window.innerWidth;
        const h  = window.innerHeight;
        const cx = w / 2;
        const cy = h / 2;
        const angle  = Math.random() * Math.PI * 2;
        const radius = (Math.random() * 0.25 + 0.1) * Math.min(w, h);
        target.x = cx + Math.cos(angle) * radius;
        target.y = cy + Math.sin(angle) * radius;
    }
}, 1200);


// ---------------------------
// CRT AUDIO & FX
// ---------------------------
function playWarmupSound() {
    sndCRTStart.currentTime = 0;
    sndCRTStart.play();

    setTimeout(() => {
        sndCRTHum.currentTime = 0;
        sndCRTHum.play();
    }, 200);
}

function stopCRTSound() {
    sndCRTHum.volume = 1;
    const fadeOut = setInterval(() => {
        sndCRTHum.volume -= 0.1;
        if (sndCRTHum.volume <= 0) {
            sndCRTHum.pause();
            sndCRTHum.volume = 1;
            clearInterval(fadeOut);
        }
    }, 20);
}

function playShutdownPop() {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.frequency.value = 600;
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.1);

    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

function crtWarmup() {
    crtWarmupEl.classList.remove("active");
    void crtWarmupEl.offsetWidth;
    crtWarmupEl.classList.add("active");
}

function crtShutdown() {
    crtShutdownEl.classList.remove("active");
    void crtShutdownEl.offsetWidth;
    crtShutdownEl.classList.add("active");
}

function crtDegauss() {
    crtDegaussEl.classList.remove("active");
    screenEl.classList.remove("degauss-active");
    void crtDegaussEl.offsetWidth;

    crtDegaussEl.classList.add("active");
    screenEl.classList.add("degauss-active");

    setTimeout(() => {
        screenEl.classList.remove("degauss-active");
    }, 700);
}


// ---------------------------
// SPECIAL MODES
// ---------------------------
function destabilizeIris() {
    eye.classList.add("destabilize");
    showStatusMessage("MINOR OCULAR INSTABILITY DETECTED. THIS IS NORMAL.");
    setTimeout(() => eye.classList.remove("destabilize"), 1500);
}

function triggerCloneAlert() {
    screenEl.classList.add("clone-alert");

    doBlink();
    glitchBurst(240);

    iris.style.setProperty("--iris-scale", "1.12");
    setTimeout(() => {
        iris.style.setProperty("--iris-scale", "1.0");
    }, 800);

    showStatusMessage("NEW CLONE DELIVERY INCOMING.");

    setTimeout(() => {
        screenEl.classList.remove("clone-alert");
    }, 5000);
}

function startInterrogation() {
    if (interrogationActive) return;
    interrogationActive = true;

    isPatrolling = false;

    eye.classList.remove("angry", "squint", "destabilize");
    eye.classList.add("interrogation");

    doBlink();
    glitchBurst(220);
    showStatusMessage("INTERROGATION MODE ENGAGED.");

    setTimeout(() => {
        eye.classList.add("squint");
    }, 1600);

    interrogationTimer = setTimeout(() => {
        stopInterrogation();
    }, 4000);
}

function stopInterrogation() {
    interrogationActive = false;
    eye.classList.remove("interrogation", "squint");

    if (interrogationTimer) {
        clearTimeout(interrogationTimer);
        interrogationTimer = null;
    }

    iris.style.filter = "";
    showStatusMessage("INTERROGATION COMPLETE.");
}

// Drugged mode
function startDrugged() {
    if (druggedActive) return;
    druggedActive = true;

    eye.classList.add("drugged");
    showStatusMessage("OCULAR PHARMACEUTICALS DEPLOYED.");

    iris.style.setProperty("--iris-scale", "1.4");

    const pulse = () => {
        if (!druggedActive) return;
        const base = 1.2;
        const variance = 0.25;
        const scale = base + (Math.random() * 2 - 1) * variance;
        iris.style.setProperty("--iris-scale", scale.toFixed(2));
    };

    pulse();
    druggedTimer = setInterval(pulse, 700);
}

function stopDrugged() {
    if (!druggedActive) return;
    druggedActive = false;

    eye.classList.remove("drugged");
    if (druggedTimer) {
        clearInterval(druggedTimer);
        druggedTimer = null;
    }
    iris.style.setProperty("--iris-scale", "1.0");
    showStatusMessage("CHEMICAL LEVELS NOMINALLY SAFE* *PROBABLY.");
}


// ---------------------------
// EYE VISIBILITY & ADS
// ---------------------------
function toggleEyeVisibility() {
    eyeHidden = !eyeHidden;
    if (eyeHidden) {
        eye.classList.add("eye-hidden");
    } else {
        eye.classList.remove("eye-hidden");
    }
}

function toggleAd() {
    adActive = !adActive;

    if (adActive) {
        showRandomAd();
        screenEl.classList.add("show-ad");
        adOverlay.classList.add("visible");
        isPatrolling = false;
        glitchBurst(220);
    } else {
        screenEl.classList.remove("show-ad");
        adOverlay.classList.remove("visible");
    }
}


// ---------------------------
// MOUSE & KEYBOARD INPUT
// ---------------------------
document.addEventListener("mousemove", (e) => {
    if (adActive) return;
    target.x = e.clientX;
    target.y = e.clientY;
    lastMouseTime = Date.now();
    isPatrolling = false;
});

document.addEventListener("keydown", (e) => {
    const preset = gazePresets[e.key];

    if (preset && !adActive) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        target.x = preset.xFrac * w;
        target.y = preset.yFrac * h;
        lastMouseTime = Date.now();
        isPatrolling = false;
        return;
    }

    if (e.key === "p" || e.key === "P") {
        if (adActive) return;
        isPatrolling = !isPatrolling;
        if (isPatrolling) {
            patrolIndex = 0;
            runPatrolStep();
        }
        return;
    }

    if (e.key === "g" || e.key === "G") {
        toggleGlitch();
        return;
    }

    if (e.key === "o" || e.key === "O") {
        crtOn = !crtOn;
        if (crtOn) {
            crtWarmup();
            playWarmupSound();
            setTimeout(crtDegauss, 900);
        } else {
            crtShutdown();
            stopCRTSound();
            playShutdownPop();
        }
        return;
    }

    if (e.key === "d" || e.key === "D") {
        crtDegauss();
        return;
    }

    if (e.key === "c" || e.key === "C") {
        triggerCloneAlert();
        return;
    }

    if (e.key === "q" || e.key === "Q") {
        interrogationActive ? stopInterrogation() : startInterrogation();
        return;
    }

    if (e.key === "l" || e.key === "L") {
        druggedActive ? stopDrugged() : startDrugged();
        return;
    }

    if (e.key === "a" || e.key === "A") {
        if (adActive) return;
        eye.classList.toggle("angry");
        iris.style.setProperty(
            "--iris-scale",
            eye.classList.contains("angry") ? "0.9" : "1.0"
        );
        doBlink();
        return;
    }

    if (e.key === "e" || e.key === "E") {
        if (adActive) return;
        const active = screenEl.classList.toggle("error-active");
        iris.style.setProperty("--iris-scale", active ? "1.15" : "1.0");
        isPatrolling = false;
        doBlink();
        if (active) glitchBurst(280);
        return;
    }

    if (e.key === "s" || e.key === "S") {
        if (adActive) return;
        eye.classList.toggle("squint");
        return;
    }

    if (e.key === "i" || e.key === "I") {
        if (adActive) return;
        doDoubleBlink();
        return;
    }

    if (e.key === "h" || e.key === "H") {
        toggleEyeVisibility();
        return;
    }

    if (e.key === "b" || e.key === "B") {
        toggleAd();
        return;
    }
});


// ---------------------------
// INIT
// ---------------------------
function init() {
    const rect = screenEl.getBoundingClientRect();
    const cx   = rect.left + rect.width / 2;
    const cy   = rect.top  + rect.height / 2;

    target.x  = cx;
    target.y  = cy;
    current.x = cx;
    current.y = cy;

    iris.style.setProperty("--iris-offset-x", "0px");
    iris.style.setProperty("--iris-offset-y", "0px");
    iris.style.setProperty("--iris-scale", "1.0");

    // default threat level on load
    setThreatLevel("BLUE");

    animate();
}

window.addEventListener("load", init);
