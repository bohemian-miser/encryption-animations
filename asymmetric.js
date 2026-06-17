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
const D_RSA = 26353n;

// State Variables
let animationSpeed = 1.0;
let loopActive = false;
let currentSequence = null;
let activePhase = null;
let currentMode = 'encrypt';

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

// Modular Exponentiation Steps Generator
function getModularExponentiationSteps(base, exp, mod) {
    const steps = [];
    let res = 1n;
    let currentBase = BigInt(base) % BigInt(mod);
    let currentExp = BigInt(exp);
    let nVal = BigInt(mod);
    
    let power = 0;
    while (currentExp > 0n) {
        const bit = currentExp % 2n;
        const isOdd = bit === 1n;
        
        const stepInfo = {
            power: power,
            baseVal: Number(currentBase),
            expVal: 2**power,
            bit: Number(bit),
            resBefore: Number(res),
            resAfter: Number(res)
        };
        
        if (isOdd) {
            res = (res * currentBase) % nVal;
            stepInfo.resAfter = Number(res);
            stepInfo.multiplied = true;
        } else {
            stepInfo.multiplied = false;
        }
        
        steps.push(stepInfo);
        
        currentBase = (currentBase * currentBase) % nVal;
        currentExp = currentExp / 2n;
        power++;
    }
    return steps;
}

// Transcript Setup
function setupTranscript(inputVal, isEncrypt) {
    const transcriptBox = document.getElementById('transcript-box');
    if (!transcriptBox) return;

    transcriptBox.innerHTML = '';

    const opSymbol = isEncrypt ? 'e' : 'd';
    const keyVal = isEncrypt ? E_RSA : D_RSA;
    const outName = isEncrypt ? 'c' : 'm';
    const inName = isEncrypt ? 'm' : 'c';
    const finalVal = Number(powerMod(BigInt(inputVal), keyVal, N_RSA));
    
    // 1. Init line
    const initDiv = document.createElement('div');
    initDiv.className = 'transcript-line';
    initDiv.id = 't-line-init';
    initDiv.innerHTML = `<strong>Input ${inName}</strong> = ${inputVal} (Hex: ${format_hex(inputVal)}). Key (${opSymbol} = ${keyVal}, n = ${N_RSA})`;
    transcriptBox.appendChild(initDiv);

    // 2. Formula line
    const formDiv = document.createElement('div');
    formDiv.className = 'transcript-line';
    formDiv.id = 't-line-formula';
    formDiv.innerHTML = `Calculate <strong>${outName}</strong> = ${inName}<sup>${keyVal}</sup> mod ${N_RSA}`;
    transcriptBox.appendChild(formDiv);

    // Get exponent breakdown
    let currentExp = BigInt(keyVal);
    const activePowers = [];
    let powerOf2 = 1;
    while (currentExp > 0n) {
        if (currentExp % 2n === 1n) {
            activePowers.push(powerOf2);
        }
        powerOf2 *= 2;
        currentExp = currentExp / 2n;
    }
    activePowers.reverse();
    
    // 3. Exponent breakdown line
    const breakdownDiv = document.createElement('div');
    breakdownDiv.className = 'transcript-line';
    breakdownDiv.id = 't-line-breakdown';
    breakdownDiv.innerHTML = `Exponent ${keyVal} = ${activePowers.join(' + ')}. We need: ${activePowers.map(p => `${inName}<sup>${p}</sup>`).join(', ')}`;
    transcriptBox.appendChild(breakdownDiv);

    // 4. Squaring steps
    const steps = getModularExponentiationSteps(inputVal, keyVal, N_RSA);
    steps.forEach((step, idx) => {
        const stepDiv = document.createElement('div');
        stepDiv.className = 'transcript-line';
        stepDiv.id = `t-line-step-${idx}`;
        
        let detail = '';
        if (idx === 0) {
            detail = `${inName}<sup>1</sup> = ${step.baseVal}`;
        } else {
            const prevExp = step.expVal / 2;
            const prevVal = steps[idx - 1].baseVal;
            const squareVal = (prevVal * prevVal) % Number(N_RSA);
            detail = `${inName}<sup>${step.expVal}</sup> = (${inName}<sup>${prevExp}</sup>)<sup>2</sup> = ${prevVal}<sup>2</sup> &equiv; ${squareVal} mod ${N_RSA}`;
        }
        
        const needed = activePowers.includes(step.expVal);
        if (needed) {
            detail += ` <strong style="color: #2e7d32;">(needed)</strong>`;
        } else {
            detail += ` <span style="color: #999;">(skip)</span>`;
        }
        
        stepDiv.innerHTML = `&bull; ${detail}`;
        transcriptBox.appendChild(stepDiv);
    });

    // 5. Accumulation steps
    const multDiv = document.createElement('div');
    multDiv.className = 'transcript-line';
    multDiv.id = 't-line-mult';
    
    let multHTML = `Multiply needed terms: <strong>${outName}</strong> = `;
    const termStrings = activePowers.map(p => `${inName}<sup>${p}</sup>`);
    multHTML += termStrings.join(' &times; ') + ` mod ${N_RSA}<br>`;
    
    let accVal = 1n;
    const nVal = BigInt(N_RSA);
    const stepsHTML = [];
    
    let accCount = 0;
    steps.forEach((step) => {
        if (step.multiplied) {
            if (accCount === 0) {
                stepsHTML.push(`&bull; Start: ${step.baseVal}`);
                accVal = BigInt(step.baseVal);
            } else {
                const nextVal = (accVal * BigInt(step.baseVal)) % nVal;
                stepsHTML.push(`&bull; Multiply ${inName}<sup>${step.expVal}</sup>: ${accVal} &times; ${step.baseVal} &equiv; <strong>${nextVal}</strong> mod ${N_RSA}`);
                accVal = nextVal;
            }
            accCount++;
        }
    });
    
    multHTML += stepsHTML.join('<br>');
    multDiv.innerHTML = multHTML;
    transcriptBox.appendChild(multDiv);

    // 6. Final result
    const finalDiv = document.createElement('div');
    finalDiv.className = 'transcript-line';
    finalDiv.id = 't-line-final';
    finalDiv.innerHTML = `<strong>Result:</strong> ${outName} = ${finalVal} (Hex: ${format_hex(finalVal)})`;
    transcriptBox.appendChild(finalDiv);
}

function clearTranscript() {
    const transcriptBox = document.getElementById('transcript-box');
    if (transcriptBox) {
        transcriptBox.innerHTML = '<div style="color: #888; font-style: italic;">Awaiting animation start...</div>';
    }
}

function highlightTranscriptLine(stepId) {
    const lines = document.querySelectorAll('.transcript-line');
    let foundActive = false;
    lines.forEach(line => {
        if (line.id === stepId) {
            line.classList.add('active');
            line.classList.remove('completed');
            foundActive = true;
            line.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            line.classList.remove('active');
            if (foundActive) {
                line.classList.remove('completed');
            } else {
                line.classList.add('completed');
            }
        }
    });
}

// Update Math Panel for Encryption
function updateMathPanelEncrypt(plainVal, cipherVal) {
    mathInputVal.textContent = plainVal;
    mathInputHex.textContent = `(${format_hex(plainVal)})`;
    mathOperation.textContent = `${plainVal} ^ 17 mod 64507 = ${cipherVal}`;
    mathOutputVal.textContent = cipherVal;
    mathOutputHex.textContent = `(${format_hex(cipherVal)})`;
    highlightTranscriptLine('t-line-final');
}

function updateMathPanelEncryptStep(plainVal, step, idx) {
    mathInputVal.textContent = plainVal;
    mathInputHex.textContent = `(${format_hex(plainVal)})`;
    
    if (step.multiplied) {
        mathOperation.innerHTML = `Step ${idx+1}: Acc = (${step.resBefore} &times; ${step.baseVal}) mod ${N_RSA} &rarr; <strong>${step.resAfter}</strong>`;
    } else {
        mathOperation.innerHTML = `Step ${idx+1}: Acc = ${step.resBefore} (bit=0, skip &times; ${step.baseVal})`;
    }
    
    mathOutputVal.textContent = '-';
    mathOutputHex.textContent = '';
}

// Update Math Panel for Decryption
function updateMathPanelDecrypt(cipherVal, plainVal) {
    mathInputVal.textContent = cipherVal;
    mathInputHex.textContent = `(${format_hex(cipherVal)})`;
    mathOperation.textContent = `${cipherVal} ^ 56473 mod 64507 = ${plainVal}`;
    mathOutputVal.textContent = plainVal;
    mathOutputHex.textContent = `(${format_hex(plainVal)})`;
    highlightTranscriptLine('t-line-final');
}

function updateMathPanelDecryptStep(cipherVal, step, idx) {
    mathInputVal.textContent = cipherVal;
    mathInputHex.textContent = `(${format_hex(cipherVal)})`;
    
    if (step.multiplied) {
        mathOperation.innerHTML = `Step ${idx+1}: Acc = (${step.resBefore} &times; ${step.baseVal}) mod ${N_RSA} &rarr; <strong>${step.resAfter}</strong>`;
    } else {
        mathOperation.innerHTML = `Step ${idx+1}: Acc = ${step.resBefore} (bit=0, skip &times; ${step.baseVal})`;
    }
    
    mathOutputVal.textContent = '-';
    mathOutputHex.textContent = '';
}

function clearMathPanel(shouldClearTranscript = true) {
    mathInputVal.textContent = '0';
    mathInputHex.textContent = '(00 00)';
    mathOperation.textContent = 'm^e mod n';
    mathOutputVal.textContent = '0';
    mathOutputHex.textContent = '(00 00)';
    if (shouldClearTranscript) {
        clearTranscript();
    }
}

// Canvas Initialization
const canvas = new EncryptionAnimCanvas('#diagram-svg', { hexPaths: HEX_PATHS });

// Add layout elements
canvas.addBlock({ id: 'plain', x: 180, y: 170, width: 220, height: 60, label: 'Plaintext', isInput: true });
canvas.addKey({ id: 'key-public', x: 400, y: 100, type: 'hardware', label: 'Public Key (e, n)', rotation: 90, className: 'public', size: 80 });
canvas.addKey({ id: 'key-private', x: 400, y: 240, type: 'hardware', label: 'Private Key (d, n)', rotation: -90, className: 'private', size: 80 });
canvas.addBlock({ id: 'cipher', x: 620, y: 170, width: 220, height: 60, label: 'Ciphertext', isInput: false, initialOpacity: 0 });

// Add arrows
canvas.addArrow({ id: 'arrow-encrypt-in', from: 'plain', to: 'key-public', fromAnchor: 'right', toAnchor: 'left', type: 'straight', initialOpacity: 0 });
canvas.addArrow({ id: 'arrow-encrypt-out', from: 'key-public', to: 'cipher', fromAnchor: 'right', toAnchor: 'left', type: 'straight', initialOpacity: 0 });
canvas.addArrow({ id: 'arrow-decrypt-in', from: 'cipher', to: 'key-private', fromAnchor: 'left', toAnchor: 'right', type: 'straight', initialOpacity: 0 });
canvas.addArrow({ id: 'arrow-decrypt-out', from: 'key-private', to: 'plain', fromAnchor: 'left', toAnchor: 'right', type: 'straight', initialOpacity: 0 });

// Animation Steps
async function runEncryptionCycle(onComplete) {
    currentMode = 'encrypt';
    const plainVal = getPlainValue();
    const cipherVal = Number(powerMod(BigInt(plainVal), E_RSA, N_RSA));
    
    setupTranscript(plainVal, true);
    
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
            { type: 'custom', callback: () => {
                clearMathPanel(false);
                highlightTranscriptLine('t-line-init');
            } }
        ]
    });

    // Step 2: Encrypt Start (Arrows appear to public key, public key wiggles)
    seq.addStep({
        duration: BASE_TIMINGS.encryptStart,
        actions: [
            { type: 'fade', elementId: 'arrow-encrypt-in', opacity: 1 },
            { type: 'highlight', elementId: 'key-public', active: true },
            { type: 'custom', callback: () => highlightTranscriptLine('t-line-formula') }
        ]
    });

    // Step 2.x: Modular Exponentiation Steps
    const steps = getModularExponentiationSteps(plainVal, E_RSA, N_RSA);
    steps.forEach((step, idx) => {
        seq.addStep({
            duration: Math.max(300, 1000 / animationSpeed),
            actions: [
                { type: 'custom', callback: () => {
                    if (idx === 0) {
                        highlightTranscriptLine('t-line-breakdown');
                    }
                    highlightTranscriptLine(`t-line-step-${idx}`);
                    updateMathPanelEncryptStep(plainVal, step, idx);
                }}
            ]
        });
    });

    // Step 3: Encrypt Active (Ciphertext appears, plaintext fades, arrow out appears)
    seq.addStep({
        duration: BASE_TIMINGS.encryptActive,
        actions: [
            { type: 'showValue', elementId: 'cipher', value: format_hex(cipherVal) },
            { type: 'fade', elementId: 'cipher', opacity: 1 },
            { type: 'fade', elementId: 'plain', opacity: 0 },
            { type: 'fade', elementId: 'arrow-encrypt-out', opacity: 1 },
            { type: 'custom', callback: () => {
                highlightTranscriptLine('t-line-mult');
                updateMathPanelEncrypt(plainVal, cipherVal);
            }}
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
    currentMode = 'decrypt';
    const plainVal = getPlainValue();
    const cipherVal = Number(powerMod(BigInt(plainVal), E_RSA, N_RSA));
    
    setupTranscript(cipherVal, false);
    
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
            { type: 'fade', elementId: 'arrow-decrypt-out', opacity: 0 },
            { type: 'custom', callback: () => {
                clearMathPanel(false);
                highlightTranscriptLine('t-line-init');
            }}
        ]
    });

    // Step 2: Decrypt Start (Right arrows to private key, private key wiggles)
    seq.addStep({
        duration: BASE_TIMINGS.decryptStart,
        actions: [
            { type: 'fade', elementId: 'arrow-decrypt-in', opacity: 1 },
            { type: 'highlight', elementId: 'key-private', active: true },
            { type: 'custom', callback: () => highlightTranscriptLine('t-line-formula') }
        ]
    });

    // Step 2.x: Decryption Exponentiation Steps
    const steps = getModularExponentiationSteps(cipherVal, D_RSA, N_RSA);
    steps.forEach((step, idx) => {
        seq.addStep({
            duration: Math.max(150, 400 / animationSpeed),
            actions: [
                { type: 'custom', callback: () => {
                    if (idx === 0) {
                        highlightTranscriptLine('t-line-breakdown');
                    }
                    highlightTranscriptLine(`t-line-step-${idx}`);
                    updateMathPanelDecryptStep(cipherVal, step, idx);
                }}
            ]
        });
    });

    // Step 3: Decrypt Active (Plaintext appears, ciphertext fades, left arrows appear)
    seq.addStep({
        duration: BASE_TIMINGS.decryptActive,
        actions: [
            { type: 'showValue', elementId: 'plain', value: format_hex(plainVal) },
            { type: 'fade', elementId: 'plain', opacity: 1 },
            { type: 'fade', elementId: 'cipher', opacity: 0 },
            { type: 'fade', elementId: 'arrow-decrypt-out', opacity: 1 },
            { type: 'custom', callback: () => {
                highlightTranscriptLine('t-line-mult');
                updateMathPanelDecrypt(cipherVal, plainVal);
            }}
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
    loopActive = false;
    btnLoop.textContent = 'Auto Loop';
    btnPause.style.display = 'none';
    updateInitialVisuals();
}

function runAutoLoop() {
    if (!loopActive) return;
    currentMode = 'encrypt';
    runEncryptionCycle(() => {
        if (!loopActive) return;
        currentMode = 'decrypt';
        runDecryptionCycle(() => {
            if (!loopActive) return;
            runAutoLoop();
        });
    });
}

async function updateInitialVisuals() {
    const plainVal = getPlainValue();
    const cipherVal = Number(powerMod(BigInt(plainVal), E_RSA, N_RSA));
    
    canvas.reset();
    
    if (currentMode === 'decrypt') {
        canvas.setMode('decrypt');
        canvas.renderText('cipher', format_hex(cipherVal));
        canvas.renderText('plain', '');
        canvas.setOpacity('cipher', 1);
        canvas.setOpacity('plain', 0);
        
        updateMathPanelDecrypt(cipherVal, plainVal);
        setupTranscript(cipherVal, false);
    } else {
        canvas.setMode('encrypt');
        canvas.renderText('plain', format_hex(plainVal));
        canvas.renderText('cipher', '');
        canvas.setOpacity('plain', 1);
        canvas.setOpacity('cipher', 0);
        
        updateMathPanelEncrypt(plainVal, cipherVal);
        setupTranscript(plainVal, true);
    }
    
    canvas.setOpacity('arrow-encrypt-in', 0);
    canvas.setOpacity('arrow-encrypt-out', 0);
    canvas.setOpacity('arrow-decrypt-in', 0);
    canvas.setOpacity('arrow-decrypt-out', 0);
}

// Event Listeners
btnEncrypt.addEventListener('click', () => {
    stopAnimation();
    currentMode = 'encrypt';
    runEncryptionCycle();
});

btnDecrypt.addEventListener('click', () => {
    stopAnimation();
    currentMode = 'decrypt';
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
