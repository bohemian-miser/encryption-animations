import HEX_PATHS from './hex_paths.js';
import { EncryptionAnimCanvas, AnimationSequence } from './animation_library.js';

// DOM Elements
const mathInputVal = document.getElementById('math-input-val');
const mathInputHex = document.getElementById('math-input-hex');
const mathOperation = document.getElementById('math-operation');
const mathOutputVal = document.getElementById('math-output-val');
const mathOutputHex = document.getElementById('math-output-hex');

const txtPlaintext = document.getElementById('plaintext-input');
const btnEncrypt = document.getElementById('btn-encrypt');
const btnDecrypt = document.getElementById('btn-decrypt');
const btnLoop = document.getElementById('btn-loop');
const btnPause = document.getElementById('btn-pause');
const rangeSpeed = document.getElementById('speed-input');
const valSpeed = document.getElementById('speed-val');

// RSA Parameters
const N_RSA = 64507n;
const E_RSA = 17n;
const D_RSA = 56473n;

// State Variables
let animationSpeed = 1.0;
let loopActive = false;
let currentSequence = null;
let activePhase = null;

// Base timings in ms (corresponds to 1x speed, total 4000ms)
const BASE_TIMINGS = {
    idle: 200,
    encryptStart: 400,
    encryptActive: 600,
    encryptEnd: 600,
    midIdle: 600,
    decryptStart: 600,
    decryptActive: 600,
    decryptEnd: 400
};

// Helper to format 16-bit number to hex string with space
function format_hex(val) {
    const hex = val.toString(16).toUpperCase().padStart(4, '0');
    return hex.slice(0, 2) + ' ' + hex.slice(2);
}

// Modular Exponentiation: (base^exp) % mod
function powerMod(base, exp, mod) {
    let res = 1n;
    base = base % mod;
    while (exp > 0n) {
        if (exp % 2n === 1n) {
            res = (res * base) % mod;
        }
        base = (base * base) % mod;
        exp = exp / 2n;
    }
    return res;
}

// Get numeric value from input (clamped to max RSA plaintext)
function getPlainValue() {
    const cleanHex = txtPlaintext.value.replace(/\s+/g, '').padStart(4, '0');
    let val = parseInt(cleanHex, 16) || 0;
    
    if (val >= Number(N_RSA)) {
        val = Number(N_RSA) - 1;
        txtPlaintext.value = val.toString(16).toUpperCase();
    }
    return val;
}

// Update Math Panel for Encryption
function updateMathPanelEncrypt(plainVal, cipherVal) {
    mathInputVal.textContent = plainVal;
    mathInputHex.textContent = `(${format_hex(plainVal)})`;
    mathOperation.textContent = `${plainVal} ^ 17 mod 64507`;
    mathOutputVal.textContent = cipherVal;
    mathOutputHex.textContent = `(${format_hex(cipherVal)})`;
}

// Update Math Panel for Decryption
function updateMathPanelDecrypt(cipherVal, plainVal) {
    mathInputVal.textContent = cipherVal;
    mathInputHex.textContent = `(${format_hex(cipherVal)})`;
    mathOperation.textContent = `${cipherVal} ^ 56473 mod 64507`;
    mathOutputVal.textContent = plainVal;
    mathOutputHex.textContent = `(${format_hex(plainVal)})`;
}

function clearMathPanel() {
    mathInputVal.textContent = '0';
    mathInputHex.textContent = '(00 00)';
    mathOperation.textContent = 'm^e mod n';
    mathOutputVal.textContent = '0';
    mathOutputHex.textContent = '(00 00)';
}

// Canvas Initialization
const canvas = new EncryptionAnimCanvas('#diagram-svg', { hexPaths: HEX_PATHS });

// Add layout elements
canvas.addBlock({ id: 'plain', x: 180, y: 170, width: 220, height: 60, label: 'Plaintext', isInput: true });
canvas.addKey({ id: 'key-public', x: 400, y: 100, type: 'hardware', label: 'Public Key (e, n)', rotation: 90, className: 'public', size: 160 });
canvas.addKey({ id: 'key-private', x: 400, y: 240, type: 'hardware', label: 'Private Key (d, n)', rotation: -90, className: 'private', size: 160 });
canvas.addBlock({ id: 'cipher', x: 620, y: 170, width: 220, height: 60, label: 'Ciphertext', isInput: false, initialOpacity: 0 });

// Add arrows
canvas.addArrow({ id: 'arrow-encrypt-in', from: 'plain', to: 'key-public', fromAnchor: 'right', toAnchor: 'left', type: 'straight', initialOpacity: 0 });
canvas.addArrow({ id: 'arrow-encrypt-out', from: 'key-public', to: 'cipher', fromAnchor: 'right', toAnchor: 'left', type: 'straight', initialOpacity: 0 });
canvas.addArrow({ id: 'arrow-decrypt-in', from: 'cipher', to: 'key-private', fromAnchor: 'left', toAnchor: 'right', type: 'straight', initialOpacity: 0 });
canvas.addArrow({ id: 'arrow-decrypt-out', from: 'key-private', to: 'plain', fromAnchor: 'left', toAnchor: 'right', type: 'straight', initialOpacity: 0 });

// Animation Steps
async function runEncryptionCycle(onComplete) {
    const plainVal = getPlainValue();
    const cipherVal = Number(powerMod(BigInt(plainVal), E_RSA, N_RSA));
    
    canvas.setMode('encrypt');
    canvas.reset();

    const seq = new AnimationSequence(canvas);

    // Step 1: Idle
    seq.addStep({
        duration: BASE_TIMINGS.idle,
        actions: [
            { type: 'showValue', elementId: 'plain', value: format_hex(plainVal) },
            { type: 'fade', elementId: 'plain', opacity: 1 },
            { type: 'fade', elementId: 'cipher', opacity: 0 },
            { type: 'fade', elementId: 'arrow-encrypt-in', opacity: 0 },
            { type: 'fade', elementId: 'arrow-encrypt-out', opacity: 0 },
            { type: 'fade', elementId: 'arrow-decrypt-in', opacity: 0 },
            { type: 'fade', elementId: 'arrow-decrypt-out', opacity: 0 },
            { type: 'custom', callback: clearMathPanel }
        ]
    });

    // Step 2: Encrypt Start (Arrows appear to public key, public key wiggles)
    seq.addStep({
        duration: BASE_TIMINGS.encryptStart,
        actions: [
            { type: 'fade', elementId: 'arrow-encrypt-in', opacity: 1 },
            { type: 'highlight', elementId: 'key-public', active: true }
        ]
    });

    // Step 3: Encrypt Active (Ciphertext appears, plaintext fades, arrow out appears)
    seq.addStep({
        duration: BASE_TIMINGS.encryptActive,
        actions: [
            { type: 'showValue', elementId: 'cipher', value: format_hex(cipherVal) },
            { type: 'fade', elementId: 'cipher', opacity: 1 },
            { type: 'fade', elementId: 'plain', opacity: 0 },
            { type: 'fade', elementId: 'arrow-encrypt-out', opacity: 1 },
            { type: 'custom', callback: () => updateMathPanelEncrypt(plainVal, cipherVal) }
        ]
    });

    // Step 4: Encrypt End (Arrows disappear, public key stops)
    seq.addStep({
        duration: BASE_TIMINGS.encryptEnd,
        actions: [
            { type: 'fade', elementId: 'arrow-encrypt-in', opacity: 0 },
            { type: 'fade', elementId: 'arrow-encrypt-out', opacity: 0 },
            { type: 'highlight', elementId: 'key-public', active: false }
        ]
    });

    activePhase = 'encrypt';
    currentSequence = seq;
    await seq.play();
    activePhase = null;
    if (onComplete) onComplete();
}

async function runDecryptionCycle(onComplete) {
    const plainVal = getPlainValue();
    const cipherVal = Number(powerMod(BigInt(plainVal), E_RSA, N_RSA));
    
    canvas.setMode('decrypt');
    canvas.reset();

    const seq = new AnimationSequence(canvas);

    // Step 1: Mid Idle
    seq.addStep({
        duration: BASE_TIMINGS.midIdle,
        actions: [
            { type: 'showValue', elementId: 'cipher', value: format_hex(cipherVal) },
            { type: 'fade', elementId: 'cipher', opacity: 1 },
            { type: 'fade', elementId: 'plain', opacity: 0 },
            { type: 'fade', elementId: 'arrow-encrypt-in', opacity: 0 },
            { type: 'fade', elementId: 'arrow-encrypt-out', opacity: 0 },
            { type: 'fade', elementId: 'arrow-decrypt-in', opacity: 0 },
            { type: 'fade', elementId: 'arrow-decrypt-out', opacity: 0 }
        ]
    });

    // Step 2: Decrypt Start (Right arrows to private key, private key wiggles)
    seq.addStep({
        duration: BASE_TIMINGS.decryptStart,
        actions: [
            { type: 'fade', elementId: 'arrow-decrypt-in', opacity: 1 },
            { type: 'highlight', elementId: 'key-private', active: true }
        ]
    });

    // Step 3: Decrypt Active (Plaintext appears, ciphertext fades, left arrows appear)
    seq.addStep({
        duration: BASE_TIMINGS.decryptActive,
        actions: [
            { type: 'showValue', elementId: 'plain', value: format_hex(plainVal) },
            { type: 'fade', elementId: 'plain', opacity: 1 },
            { type: 'fade', elementId: 'cipher', opacity: 0 },
            { type: 'fade', elementId: 'arrow-decrypt-out', opacity: 1 },
            { type: 'custom', callback: () => updateMathPanelDecrypt(cipherVal, plainVal) }
        ]
    });

    // Step 4: Decrypt End (Arrows disappear, private key stops)
    seq.addStep({
        duration: BASE_TIMINGS.decryptEnd,
        actions: [
            { type: 'fade', elementId: 'arrow-decrypt-in', opacity: 0 },
            { type: 'fade', elementId: 'arrow-decrypt-out', opacity: 0 },
            { type: 'highlight', elementId: 'key-private', active: false }
        ]
    });

    activePhase = 'decrypt';
    currentSequence = seq;
    await seq.play();
    activePhase = null;
    if (onComplete) onComplete();
}

function stopAnimation() {
    if (currentSequence) {
        currentSequence.stop();
    }
    canvas.reset();
    loopActive = false;
    btnLoop.textContent = 'Auto Loop';
    btnPause.style.display = 'none';
}

function runAutoLoop() {
    if (!loopActive) return;
    runEncryptionCycle(() => {
        if (!loopActive) return;
        runDecryptionCycle(() => {
            if (!loopActive) return;
            runAutoLoop();
        });
    });
}

async function updateInitialVisuals() {
    const plainVal = getPlainValue();
    canvas.reset();
    canvas.renderText('plain', format_hex(plainVal));
    canvas.renderText('cipher', '');
    canvas.setOpacity('plain', 1);
    canvas.setOpacity('cipher', 0);
    canvas.setOpacity('arrow-encrypt-in', 0);
    canvas.setOpacity('arrow-encrypt-out', 0);
    canvas.setOpacity('arrow-decrypt-in', 0);
    canvas.setOpacity('arrow-decrypt-out', 0);
    clearMathPanel();
}

// Event Listeners
btnEncrypt.addEventListener('click', () => {
    stopAnimation();
    runEncryptionCycle();
});

btnDecrypt.addEventListener('click', () => {
    stopAnimation();
    runDecryptionCycle();
});

btnLoop.addEventListener('click', () => {
    if (loopActive) {
        stopAnimation();
    } else {
        stopAnimation();
        loopActive = true;
        btnLoop.textContent = 'Stop Loop';
        btnPause.style.display = 'inline-block';
        runAutoLoop();
    }
});

btnPause.addEventListener('click', () => {
    stopAnimation();
});

rangeSpeed.addEventListener('input', (e) => {
    animationSpeed = parseFloat(e.target.value);
    valSpeed.textContent = animationSpeed.toFixed(1) + 'x';
    canvas.setSpeed(animationSpeed);
});

txtPlaintext.addEventListener('input', () => {
    if (activePhase === null) {
        updateInitialVisuals();
    }
});

// Initialize
canvas.setSpeed(animationSpeed);
updateInitialVisuals();
