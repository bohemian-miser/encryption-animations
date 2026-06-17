import HEX_PATHS from './hex_paths.js';
import { EncryptionAnimCanvas, AnimationSequence } from './animation_library.js';

// DOM Elements
const mathInputVal = document.getElementById('math-input-val');
const mathInputHex = document.getElementById('math-input-hex');
const mathOperation = document.getElementById('math-operation');
const mathOutputVal = document.getElementById('math-output-val');
const mathOutputHex = document.getElementById('math-output-hex');

const txtAlicePriv = document.getElementById('alice-priv-input');
const txtBobPriv = document.getElementById('bob-priv-input');
const lblAlicePriv = document.getElementById('alice-priv-lbl');
const lblBobPriv = document.getElementById('bob-priv-lbl');

const btnExchange = document.getElementById('btn-exchange');
const btnLoop = document.getElementById('btn-loop');
const btnPause = document.getElementById('btn-pause');
const rangeSpeed = document.getElementById('speed-input');
const valSpeed = document.getElementById('speed-val');

// DH Parameters
const P_DH = 997n;
const G_DH = 2n;

// State Variables
let animationSpeed = 1.0;
let loopActive = false;
let currentSequence = null;
let activePhase = null;

// Base timings in ms
const BASE_TIMINGS = {
    idle: 400,
    calcA: 800,
    calcB: 800,
    exchange: 1000,
    calcSecret: 1200,
    end: 600
};

// Helper to format to hex
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

// Get numeric value from input
function getAlicePriv() {
    let val = parseInt(txtAlicePriv.value) || 15;
    if (val >= Number(P_DH)) {
        val = Number(P_DH) - 1;
        txtAlicePriv.value = val;
    }
    return val;
}

function getBobPriv() {
    let val = parseInt(txtBobPriv.value) || 23;
    if (val >= Number(P_DH)) {
        val = Number(P_DH) - 1;
        txtBobPriv.value = val;
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
function setupTranscript(a, b) {
    const transcriptBox = document.getElementById('transcript-box');
    if (!transcriptBox) return;

    transcriptBox.innerHTML = '';

    const p = Number(P_DH);
    const g = Number(G_DH);
    const A = Number(powerMod(G_DH, BigInt(a), P_DH));
    const B = Number(powerMod(G_DH, BigInt(b), P_DH));
    const S = Number(powerMod(BigInt(B), BigInt(a), P_DH));
    
    // 1. Setup line
    const setupDiv = document.createElement('div');
    setupDiv.className = 'transcript-line';
    setupDiv.id = 't-line-init';
    setupDiv.innerHTML = `<strong>Setup:</strong> Prime p = ${p}, Generator g = ${g}. Alice Private a = ${a}, Bob Private b = ${b}`;
    transcriptBox.appendChild(setupDiv);

    // 2. Alice Public Key calculation
    const alicePubDiv = document.createElement('div');
    alicePubDiv.className = 'transcript-line';
    alicePubDiv.id = 't-line-alice-pub';
    alicePubDiv.innerHTML = `&bull; Alice computes Public A = g<sup>a</sup> mod p = 2<sup>${a}</sup> mod ${p} = <strong>${A}</strong>`;
    transcriptBox.appendChild(alicePubDiv);

    // 3. Bob Public Key calculation
    const bobPubDiv = document.createElement('div');
    bobPubDiv.className = 'transcript-line';
    bobPubDiv.id = 't-line-bob-pub';
    bobPubDiv.innerHTML = `&bull; Bob computes Public B = g<sup>b</sup> mod p = 2<sup>${b}</sup> mod ${p} = <strong>${B}</strong>`;
    transcriptBox.appendChild(bobPubDiv);

    // 4. Exchange
    const exchangeDiv = document.createElement('div');
    exchangeDiv.className = 'transcript-line';
    exchangeDiv.id = 't-line-exchange';
    exchangeDiv.innerHTML = `<strong>Exchange:</strong> Alice sends A (${A}) &rarr; Bob. Bob sends B (${B}) &rarr; Alice.`;
    transcriptBox.appendChild(exchangeDiv);

    // 5. Alice Secret calculation
    const aliceSecretDiv = document.createElement('div');
    aliceSecretDiv.className = 'transcript-line';
    aliceSecretDiv.id = 't-line-alice-sec';
    aliceSecretDiv.innerHTML = `&bull; Alice computes Secret S = B<sup>a</sup> mod p = ${B}<sup>${a}</sup> mod ${p} = <strong>${S}</strong>`;
    transcriptBox.appendChild(aliceSecretDiv);

    // 6. Bob Secret calculation
    const bobSecretDiv = document.createElement('div');
    bobSecretDiv.className = 'transcript-line';
    bobSecretDiv.id = 't-line-bob-sec';
    bobSecretDiv.innerHTML = `&bull; Bob computes Secret S = A<sup>b</sup> mod p = ${A}<sup>${b}</sup> mod ${p} = <strong>${S}</strong>`;
    transcriptBox.appendChild(bobSecretDiv);

    // 7. Result
    const finalDiv = document.createElement('div');
    finalDiv.className = 'transcript-line';
    finalDiv.id = 't-line-final';
    finalDiv.innerHTML = `<strong>Shared Secret established:</strong> S = <strong>${S}</strong> (Hex: ${format_hex(S)})`;
    transcriptBox.appendChild(finalDiv);
}

function clearTranscript() {
    const transcriptBox = document.getElementById('transcript-box');
    if (transcriptBox) {
        transcriptBox.innerHTML = '<div style="color: #888; font-style: italic;">Awaiting exchange start...</div>';
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

function updateMathPanelStep(base, exp, step, idx, label = 'Calculating') {
    mathInputVal.textContent = base;
    mathInputHex.textContent = `(g=${G_DH}, p=${P_DH})`;
    
    if (step.multiplied) {
        mathOperation.innerHTML = `${label} (${base}<sup>${exp}</sup> mod ${P_DH}): Acc = (${step.resBefore} &times; ${step.baseVal}) mod ${P_DH} &rarr; <strong>${step.resAfter}</strong>`;
    } else {
        mathOperation.innerHTML = `${label} (${base}<sup>${exp}</sup> mod ${P_DH}): Acc = ${step.resBefore} (skip &times; ${step.baseVal})`;
    }
    
    mathOutputVal.textContent = '-';
    mathOutputHex.textContent = '';
}

function updateMathPanelFinal(base, exp, finalVal, label = 'Result') {
    mathInputVal.textContent = base;
    mathInputHex.textContent = `(g=${G_DH}, p=${P_DH})`;
    mathOperation.innerHTML = `${label}: ${base}<sup>${exp}</sup> mod ${P_DH} = <strong>${finalVal}</strong>`;
    mathOutputVal.textContent = finalVal;
    mathOutputHex.textContent = `(${format_hex(finalVal)})`;
}

function clearMathPanel(shouldClearTranscript = true) {
    mathInputVal.textContent = '0';
    mathInputHex.textContent = '(00 00)';
    mathOperation.textContent = 'g^a mod p';
    mathOutputVal.textContent = '0';
    mathOutputHex.textContent = '(00 00)';
    if (shouldClearTranscript) {
        clearTranscript();
    }
}

// Canvas Initialization
const canvas = new EncryptionAnimCanvas('#diagram-svg', { hexPaths: HEX_PATHS });

// Add layout elements (Alice on Left, Bob on Right)
canvas.addBlock({ id: 'alice', x: 180, y: 170, width: 200, height: 60, label: 'Alice', isInput: true });
canvas.addKey({ id: 'key-alice', x: 180, y: 80, type: 'hardware', label: 'Private key a', rotation: 90, className: 'private', size: 60 });

canvas.addBlock({ id: 'bob', x: 620, y: 170, width: 200, height: 60, label: 'Bob', isInput: false });
canvas.addKey({ id: 'key-bob', x: 620, y: 80, type: 'hardware', label: 'Private key b', rotation: -90, className: 'private', size: 60 });

// Add arrows
canvas.addArrow({ id: 'arrow-alice-pub', from: 'key-alice', to: 'alice', fromAnchor: 'bottom', toAnchor: 'top', type: 'straight', initialOpacity: 0 });
canvas.addArrow({ id: 'arrow-bob-pub', from: 'key-bob', to: 'bob', fromAnchor: 'bottom', toAnchor: 'top', type: 'straight', initialOpacity: 0 });
canvas.addArrow({ id: 'arrow-alice-to-bob', from: 'alice', to: 'bob', fromAnchor: 'right', toAnchor: 'left', type: 'straight', initialOpacity: 0 });
canvas.addArrow({ id: 'arrow-bob-to-alice', from: 'bob', to: 'alice', fromAnchor: 'left', toAnchor: 'right', type: 'straight', initialOpacity: 0 });

async function runExchangeCycle(onComplete) {
    const a = getAlicePriv();
    const b = getBobPriv();
    const p = Number(P_DH);
    const g = Number(G_DH);
    
    const A = Number(powerMod(G_DH, BigInt(a), P_DH));
    const B = Number(powerMod(G_DH, BigInt(b), P_DH));
    const S = Number(powerMod(BigInt(B), BigInt(a), P_DH));
    
    setupTranscript(a, b);
    canvas.reset();

    const seq = new AnimationSequence(canvas);

    // Step 1: Idle
    seq.addStep({
        duration: BASE_TIMINGS.idle,
        actions: [
            { type: 'showValue', elementId: 'alice', value: 'a = ' + a },
            { type: 'showValue', elementId: 'bob', value: 'b = ' + b },
            { type: 'fade', elementId: 'alice', opacity: 1 },
            { type: 'fade', elementId: 'bob', opacity: 1 },
            { type: 'fade', elementId: 'arrow-alice-pub', opacity: 0 },
            { type: 'fade', elementId: 'arrow-bob-pub', opacity: 0 },
            { type: 'fade', elementId: 'arrow-alice-to-bob', opacity: 0 },
            { type: 'fade', elementId: 'arrow-bob-to-alice', opacity: 0 },
            { type: 'custom', callback: () => {
                clearMathPanel(false);
                highlightTranscriptLine('t-line-init');
            }}
        ]
    });

    // Step 2: Alice computes A
    seq.addStep({
        duration: BASE_TIMINGS.calcA / 4,
        actions: [
            { type: 'fade', elementId: 'arrow-alice-pub', opacity: 1 },
            { type: 'highlight', elementId: 'key-alice', active: true }
        ]
    });

    const stepsA = getModularExponentiationSteps(g, a, p);
    stepsA.forEach((step, idx) => {
        seq.addStep({
            duration: Math.max(200, 600 / animationSpeed),
            actions: [
                { type: 'custom', callback: () => {
                    highlightTranscriptLine('t-line-alice-pub');
                    updateMathPanelStep(g, a, step, idx, 'Alice computes A');
                }}
            ]
        });
    });

    seq.addStep({
        duration: BASE_TIMINGS.calcA / 4,
        actions: [
            { type: 'showValue', elementId: 'alice', value: 'A = ' + A },
            { type: 'highlight', elementId: 'key-alice', active: false },
            { type: 'custom', callback: () => {
                updateMathPanelFinal(g, a, A, 'Alice Public A');
            }}
        ]
    });

    // Step 3: Bob computes B
    seq.addStep({
        duration: BASE_TIMINGS.calcB / 4,
        actions: [
            { type: 'fade', elementId: 'arrow-bob-pub', opacity: 1 },
            { type: 'highlight', elementId: 'key-bob', active: true }
        ]
    });

    const stepsB = getModularExponentiationSteps(g, b, p);
    stepsB.forEach((step, idx) => {
        seq.addStep({
            duration: Math.max(200, 600 / animationSpeed),
            actions: [
                { type: 'custom', callback: () => {
                    highlightTranscriptLine('t-line-bob-pub');
                    updateMathPanelStep(g, b, step, idx, 'Bob computes B');
                }}
            ]
        });
    });

    seq.addStep({
        duration: BASE_TIMINGS.calcB / 4,
        actions: [
            { type: 'showValue', elementId: 'bob', value: 'B = ' + B },
            { type: 'highlight', elementId: 'key-bob', active: false },
            { type: 'custom', callback: () => {
                updateMathPanelFinal(g, b, B, 'Bob Public B');
            }}
        ]
    });

    // Step 4: Exchange public keys
    seq.addStep({
        duration: BASE_TIMINGS.exchange,
        actions: [
            { type: 'fade', elementId: 'arrow-alice-to-bob', opacity: 1 },
            { type: 'fade', elementId: 'arrow-bob-to-alice', opacity: 1 },
            { type: 'showValue', elementId: 'alice', value: `A=${A}, B=${B}` },
            { type: 'showValue', elementId: 'bob', value: `A=${A}, B=${B}` },
            { type: 'custom', callback: () => {
                highlightTranscriptLine('t-line-exchange');
            }}
        ]
    });

    // Step 5: Alice computes secret
    seq.addStep({
        duration: BASE_TIMINGS.calcSecret / 4,
        actions: [
            { type: 'highlight', elementId: 'key-alice', active: true }
        ]
    });

    const stepsS = getModularExponentiationSteps(B, a, p);
    stepsS.forEach((step, idx) => {
        seq.addStep({
            duration: Math.max(200, 600 / animationSpeed),
            actions: [
                { type: 'custom', callback: () => {
                    highlightTranscriptLine('t-line-alice-sec');
                    updateMathPanelStep(B, a, step, idx, 'Alice computes S');
                }}
            ]
        });
    });

    seq.addStep({
        duration: BASE_TIMINGS.calcSecret / 4,
        actions: [
            { type: 'showValue', elementId: 'alice', value: 'S = ' + S },
            { type: 'highlight', elementId: 'key-alice', active: false },
            { type: 'custom', callback: () => {
                updateMathPanelFinal(B, a, S, 'Alice Secret S');
            }}
        ]
    });

    // Step 6: Bob computes secret
    seq.addStep({
        duration: BASE_TIMINGS.calcSecret / 4,
        actions: [
            { type: 'highlight', elementId: 'key-bob', active: true }
        ]
    });

    const stepsSb = getModularExponentiationSteps(A, b, p);
    stepsSb.forEach((step, idx) => {
        seq.addStep({
            duration: Math.max(200, 600 / animationSpeed),
            actions: [
                { type: 'custom', callback: () => {
                    highlightTranscriptLine('t-line-bob-sec');
                    updateMathPanelStep(A, b, step, idx, 'Bob computes S');
                }}
            ]
        });
    });

    seq.addStep({
        duration: BASE_TIMINGS.calcSecret / 4,
        actions: [
            { type: 'showValue', elementId: 'bob', value: 'S = ' + S },
            { type: 'highlight', elementId: 'key-bob', active: false },
            { type: 'custom', callback: () => {
                updateMathPanelFinal(A, b, S, 'Bob Secret S');
                highlightTranscriptLine('t-line-final');
            }}
        ]
    });

    activePhase = 'exchange';
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
    runExchangeCycle(() => {
        if (!loopActive) return;
        setTimeout(() => {
            if (!loopActive) return;
            runAutoLoop();
        }, 1500);
    });
}

async function updateInitialVisuals() {
    const a = getAlicePriv();
    const b = getBobPriv();
    
    lblAlicePriv.textContent = 'a = ' + a;
    lblBobPriv.textContent = 'b = ' + b;

    canvas.reset();
    canvas.renderText('alice', 'a = ' + a);
    canvas.renderText('bob', 'b = ' + b);
    canvas.setOpacity('alice', 1);
    canvas.setOpacity('bob', 1);
    
    canvas.setOpacity('arrow-alice-pub', 0);
    canvas.setOpacity('arrow-bob-pub', 0);
    canvas.setOpacity('arrow-alice-to-bob', 0);
    canvas.setOpacity('arrow-bob-to-alice', 0);
    
    clearMathPanel(false);
    setupTranscript(a, b);
}

// Event Listeners
btnExchange.addEventListener('click', () => {
    stopAnimation();
    runExchangeCycle();
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

txtAlicePriv.addEventListener('input', () => {
    if (activePhase === null) {
        updateInitialVisuals();
    }
});

txtBobPriv.addEventListener('input', () => {
    if (activePhase === null) {
        updateInitialVisuals();
    }
});

// Initialize
canvas.setSpeed(animationSpeed);
updateInitialVisuals();
