import HEX_PATHS from './hex_paths.js';
import { EncryptionAnimCanvas, AnimationSequence } from './animation_library.js';

// DOM Elements
const mathInputBin = document.getElementById('math-input-bin');
const mathInputHex = document.getElementById('math-input-hex');
const mathKeyBin = document.getElementById('math-key-bin');
const mathKeyHex = document.getElementById('math-key-hex');
const mathKeyLabel = document.getElementById('math-key-label');
const mathOutputBin = document.getElementById('math-output-bin');
const mathOutputHex = document.getElementById('math-output-hex');

const txtPlaintext = document.getElementById('plaintext-input');
const txtKey = document.getElementById('key-input');
const btnEncrypt = document.getElementById('btn-encrypt');
const btnDecrypt = document.getElementById('btn-decrypt');
const btnLoop = document.getElementById('btn-loop');
const btnPause = document.getElementById('btn-pause');
const rangeSpeed = document.getElementById('speed-input');
const valSpeed = document.getElementById('speed-val');
const selectAlgo = document.getElementById('algo-select');
const explanationPanel = document.getElementById('explanation-panel');

// State Variables
let animationSpeed = 1.0;
let activePhase = null; // 'encrypt' or 'decrypt' or null
let loopActive = false;
let currentSequence = null;

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

// Helper to format 16-bit number to binary string with space
function format_bin(val) {
    const bin = val.toString(2).padStart(16, '0');
    return bin.slice(0, 8) + ' ' + bin.slice(8);
}

// Helper to format 16-bit number to hex string with space
function format_hex(val) {
    const hex = val.toString(16).toUpperCase().padStart(4, '0');
    return hex.slice(0, 2) + ' ' + hex.slice(2);
}

// Helper to convert hex string to Uint8Array
function hexToBytes(hex) {
    const cleanHex = hex.replace(/\s+/g, '');
    const bytes = [];
    for (let c = 0; c < cleanHex.length; c += 2) {
        bytes.push(parseInt(cleanHex.substr(c, 2), 16));
    }
    return new Uint8Array(bytes);
}

// Helper to convert Uint8Array to hex string
function bytesToHex(bytes) {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Helper to convert 2-byte Uint8Array to 16-bit integer
function bytesToVal(bytes) {
    return (bytes[0] << 8) | bytes[1];
}

// Calculate Crypto values (XOR or AES-CTR)
async function getCryptoValues() {
    const plainHex = txtPlaintext.value.padStart(4, '0');
    const keyHex = txtKey.value.padStart(4, '0');
    
    const plainBytes = hexToBytes(plainHex);
    const keyBytes = hexToBytes(keyHex);
    
    const algo = selectAlgo.value;
    
    if (algo === 'xor') {
        const plainVal = bytesToVal(plainBytes);
        const keyVal = bytesToVal(keyBytes);
        const cipherVal = plainVal ^ keyVal;
        
        const cipherBytes = new Uint8Array([
            (cipherVal >> 8) & 0xFF,
            cipherVal & 0xFF
        ]);
        
        return {
            plainVal,
            keyVal,
            cipherVal,
            cipherHex: bytesToHex(cipherBytes)
        };
    } else {
        const keyHash = await crypto.subtle.digest('SHA-256', keyBytes);
        
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyHash,
            { name: 'AES-CTR' },
            false,
            ['encrypt', 'decrypt']
        );
        
        const counter = new Uint8Array(16);
        
        const cipherBuffer = await crypto.subtle.encrypt(
            { name: 'AES-CTR', counter, length: 64 },
            cryptoKey,
            plainBytes
        );
        const cipherBytes = new Uint8Array(cipherBuffer);
        
        const zeroBytes = new Uint8Array(plainBytes.length);
        const keystreamBuffer = await crypto.subtle.encrypt(
            { name: 'AES-CTR', counter, length: 64 },
            cryptoKey,
            zeroBytes
        );
        const keystreamBytes = new Uint8Array(keystreamBuffer);
        
        const plainVal = bytesToVal(plainBytes);
        const keyVal = bytesToVal(keystreamBytes);
        const cipherVal = bytesToVal(cipherBytes);
        
        return {
            plainVal,
            keyVal,
            cipherVal,
            cipherHex: bytesToHex(cipherBytes)
        };
    }
}

function updateMathPanel(inputVal, keyVal, outputVal, inputLabel = 'Input', outputLabel = 'Output') {
    mathInputBin.textContent = format_bin(inputVal);
    mathInputHex.textContent = `(${format_hex(inputVal)})`;
    
    mathKeyBin.textContent = format_bin(keyVal);
    mathKeyHex.textContent = `(${format_hex(keyVal)})`;
    
    mathOutputBin.textContent = format_bin(outputVal);
    mathOutputHex.textContent = `(${format_hex(outputVal)})`;
    
    const algo = selectAlgo.value;
    if (algo === 'aes') {
        mathKeyLabel.textContent = 'Keystream:';
        document.querySelector('#math-panel h3').textContent = `Symmetric Encryption Process (${inputLabel} XOR Keystream = ${outputLabel})`;
    } else {
        mathKeyLabel.textContent = 'Key:';
        document.querySelector('#math-panel h3').textContent = `Symmetric Encryption Process (${inputLabel} XOR Key = ${outputLabel})`;
    }
}

function clearMathPanel() {
    mathInputBin.textContent = '00000000 00000000';
    mathInputHex.textContent = '(00 00)';
    mathKeyBin.textContent = '00000000 00000000';
    mathKeyHex.textContent = '(00 00)';
    mathOutputBin.textContent = '00000000 00000000';
    mathOutputHex.textContent = '(00 00)';
}

const canvas = new EncryptionAnimCanvas('#diagram-svg', { hexPaths: HEX_PATHS });
document.getElementById('diagram-svg').classList.add('canvas-symmetric');

// Add layout elements
canvas.addBlock({ id: 'plain', x: 130, y: 125, width: 220, height: 60, label: 'Plaintext', isInput: true });
canvas.addKey({ id: 'key', x: 400, y: 125, type: 'hardware', label: 'Key' });
canvas.addBlock({ id: 'cipher', x: 670, y: 125, width: 220, height: 60, label: 'Ciphertext', isInput: false, initialOpacity: 0 });

// Add arrows
canvas.addArrow({ id: 'arrow-encrypt-in', from: 'plain', to: 'key', fromAnchor: 'right', toAnchor: 'left', type: 'wobbly-horizontal', initialOpacity: 0 });
canvas.addArrow({ id: 'arrow-encrypt-out', from: 'key', to: 'cipher', fromAnchor: 'right', toAnchor: 'left', type: 'wobbly-horizontal', initialOpacity: 0 });
canvas.addArrow({ id: 'arrow-decrypt-in', from: 'cipher', to: 'key', fromAnchor: 'left', toAnchor: 'right', type: 'wobbly-horizontal', initialOpacity: 0 });
canvas.addArrow({ id: 'arrow-decrypt-out', from: 'key', to: 'plain', fromAnchor: 'left', toAnchor: 'right', type: 'wobbly-horizontal', initialOpacity: 0 });

// Animation Steps
async function runEncryptionCycle(onComplete) {
    const { plainVal, keyVal, cipherVal } = await getCryptoValues();
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

    // Step 2: Encrypt Start (Arrows appear, key wiggles)
    seq.addStep({
        duration: BASE_TIMINGS.encryptStart,
        actions: [
            { type: 'fade', elementId: 'arrow-encrypt-in', opacity: 1 },
            { type: 'highlight', elementId: 'key', active: true }
        ]
    });

    // Step 3: Encrypt Active (Ciphertext appears, plaintext fades, arrow-out appears)
    seq.addStep({
        duration: BASE_TIMINGS.encryptActive,
        actions: [
            { type: 'showValue', elementId: 'cipher', value: format_hex(cipherVal) },
            { type: 'fade', elementId: 'cipher', opacity: 1 },
            { type: 'fade', elementId: 'plain', opacity: 0 },
            { type: 'fade', elementId: 'arrow-encrypt-out', opacity: 1 },
            { type: 'custom', callback: () => updateMathPanel(plainVal, keyVal, cipherVal, 'Plain', 'Cipher') }
        ]
    });

    // Step 4: Encrypt End (Arrows disappear, key resets)
    seq.addStep({
        duration: BASE_TIMINGS.encryptEnd,
        actions: [
            { type: 'fade', elementId: 'arrow-encrypt-in', opacity: 0 },
            { type: 'fade', elementId: 'arrow-encrypt-out', opacity: 0 },
            { type: 'highlight', elementId: 'key', active: false }
        ]
    });

    activePhase = 'encrypt';
    currentSequence = seq;
    await seq.play();
    activePhase = null;
    if (onComplete) onComplete();
}

async function runDecryptionCycle(onComplete) {
    const { plainVal, keyVal, cipherVal } = await getCryptoValues();
    canvas.setMode('decrypt');
    canvas.reset();

    const seq = new AnimationSequence(canvas);

    // Step 1: Mid Idle (Ciphertext shown, Plaintext hidden)
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

    // Step 2: Decrypt Start (Right arrows appear, key wiggles)
    seq.addStep({
        duration: BASE_TIMINGS.decryptStart,
        actions: [
            { type: 'fade', elementId: 'arrow-decrypt-in', opacity: 1 },
            { type: 'highlight', elementId: 'key', active: true }
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
            { type: 'custom', callback: () => updateMathPanel(cipherVal, keyVal, plainVal, 'Cipher', 'Plain') }
        ]
    });

    // Step 4: Decrypt End (Arrows disappear, key resets)
    seq.addStep({
        duration: BASE_TIMINGS.decryptEnd,
        actions: [
            { type: 'fade', elementId: 'arrow-decrypt-in', opacity: 0 },
            { type: 'fade', elementId: 'arrow-decrypt-out', opacity: 0 },
            { type: 'highlight', elementId: 'key', active: false }
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
    const { plainVal, keyVal, cipherVal } = await getCryptoValues();
    canvas.reset();
    canvas.renderText('plain', format_hex(plainVal));
    canvas.renderText('cipher', '');
    canvas.setOpacity('plain', 1);
    canvas.setOpacity('cipher', 0);
    canvas.setOpacity('arrow-encrypt-in', 0);
    canvas.setOpacity('arrow-encrypt-out', 0);
    canvas.setOpacity('arrow-decrypt-in', 0);
    canvas.setOpacity('arrow-decrypt-out', 0);
    updateMathPanel(plainVal, keyVal, cipherVal, 'Plain', 'Cipher');
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

selectAlgo.addEventListener('change', () => {
    const algo = selectAlgo.value;
    explanationPanel.style.display = algo === 'aes' ? 'block' : 'none';
    if (activePhase === null) {
        updateInitialVisuals();
    }
});

txtPlaintext.addEventListener('input', () => {
    if (activePhase === null) {
        updateInitialVisuals();
    }
});

txtKey.addEventListener('input', () => {
    if (activePhase === null) {
        updateInitialVisuals();
    }
});

// Initialize
explanationPanel.style.display = selectAlgo.value === 'aes' ? 'block' : 'none';
canvas.setSpeed(animationSpeed);
updateInitialVisuals();
