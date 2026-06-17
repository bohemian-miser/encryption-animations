import HEX_PATHS from './hex_paths.js';
import { EncryptionAnimCanvas, AnimationSequence } from './animation_library.js';

// DOM Elements
const txtPlaintext = document.getElementById('plaintext-input');
const txtKey = document.getElementById('key-input');
const btnEncrypt = document.getElementById('btn-encrypt');
const btnDecrypt = document.getElementById('btn-decrypt');
const btnLoop = document.getElementById('btn-loop');
const btnPause = document.getElementById('btn-pause');
const rangeSpeed = document.getElementById('speed-input');
const valSpeed = document.getElementById('speed-val');
const chkFade = document.getElementById('fade-toggle');

const mathL0Val = document.getElementById('math-l0-val');
const mathR0Val = document.getElementById('math-r0-val');
const mathR0Expr = document.getElementById('math-r0-expr');
const mathK0Expr = document.getElementById('math-k0-expr');
const mathFVal = document.getElementById('math-f-val');
const mathL0Expr = document.getElementById('math-l0-expr');
const mathFExpr = document.getElementById('math-f-expr');
const mathR1Val = document.getElementById('math-r1-val');
const mathL1Val = document.getElementById('math-l1-val');
const mathOutHex = document.getElementById('math-out-hex');

const calcA = document.getElementById('calc-a');
const calcB = document.getElementById('calc-b');
const calcResult = document.getElementById('calc-result');

// State Variables
let animationSpeed = 1.0;
let loopActive = false;
let currentSequence = null;
let activePhase = null; 
let fadeEnabled = true;

// Base timings in ms (total 4000ms at 1x)
const BASE_TIMINGS = {
    idle: 300,
    start: 1000,   
    middle: 1200,  
    active: 1000,  
    end: 500
};

// Helper to format 8-bit to hex
function format_hex8(val) {
    return val.toString(16).toUpperCase().padStart(2, '0');
}

// Helper to format 16-bit to hex
function format_hex16(val) {
    return val.toString(16).toUpperCase().padStart(4, '0');
}

// Split format helpers
function format_left_split(val_8bit) {
    return format_hex8(val_8bit) + '__';
}

function format_right_split(val_8bit) {
    return '__' + format_hex8(val_8bit);
}

function getInputs() {
    const cleanHex = txtPlaintext.value.replace(/\s+/g, '').padStart(4, '0');
    const val16 = parseInt(cleanHex, 16) || 0;
    const l0 = (val16 >> 8) & 0xFF;
    const r0 = val16 & 0xFF;

    const keyHex = txtKey.value.replace(/\s+/g, '').padStart(2, '0');
    const k0 = parseInt(keyHex, 16) || 0;

    return { l0, r0, key: k0, k0, val16 };
}

function clearMathPanel() {
    mathL0Val.textContent = '00__';
    mathR0Val.textContent = '__00';
    mathR0Expr.textContent = '00';
    mathK0Expr.textContent = '00';
    mathFVal.textContent = '00';
    mathL0Expr.textContent = '00';
    mathFExpr.textContent = '00';
    mathR1Val.textContent = '__00';
    mathL1Val.textContent = '00__';
    mathOutHex.textContent = '0000';
}

function updateMathPanel(l0, r0, k0, fOut, r1, l1, finalOut) {
    mathL0Val.textContent = format_left_split(l0);
    mathR0Val.textContent = format_right_split(r0);
    mathR0Expr.textContent = format_hex8(r0);
    mathK0Expr.textContent = format_hex8(k0);
    mathFVal.textContent = format_hex8(fOut);
    mathL0Expr.textContent = format_hex8(l0);
    mathFExpr.textContent = format_hex8(fOut);
    mathR1Val.textContent = format_right_split(r1);
    mathL1Val.textContent = format_left_split(l1);
    mathOutHex.textContent = format_hex16(finalOut);
}

const canvas = new EncryptionAnimCanvas('#diagram-svg', { hexPaths: HEX_PATHS });
document.getElementById('diagram-svg').classList.add('canvas-feistel');

// Add layout elements
canvas.addBlock({ id: 'l0', x: 120, y: 30, width: 120, height: 45, label: 'L₀', isInput: true });
canvas.addBlock({ id: 'r0', x: 480, y: 30, width: 120, height: 45, label: 'R₀', isInput: true });
canvas.addXOR({ id: 'xor', x: 220, y: 100, initialOpacity: 0 });
canvas.addKey({ id: 'k0', x: 480, y: 170, type: 'hardware', showF: true });
canvas.addBlock({ id: 'f-val', x: 320, y: 170, width: 80, height: 45, label: '', initialOpacity: 0 });

canvas.addBlock({ id: 'l1', x: 120, y: 310, width: 120, height: 45, label: 'L₁ = R₀', isInput: true, initialOpacity: 0 });
canvas.addBlock({ id: 'r1', x: 480, y: 310, width: 120, height: 45, label: 'R₁ = L₀ ⊕ F(R₀,K₀)', isInput: true, initialOpacity: 0 });

// Add arrows
canvas.addArrow({ id: 'arrow-r0-k0', from: 'r0', to: 'k0', fromAnchor: 'bottom', toAnchor: 'top', type: 'straight', initialOpacity: 0 });
canvas.addArrow({ id: 'arrow-k0-fval', from: 'k0', to: 'f-val', fromAnchor: 'left', toAnchor: 'right', type: 'straight', initialOpacity: 0 });
canvas.addArrow({ id: 'arrow-fval-r1', from: 'f-val', to: 'r1', fromAnchor: 'bottom', toAnchor: 'top', type: 'straight', initialOpacity: 0 });
canvas.addArrow({ id: 'arrow-r0-l1', from: 'r0', to: 'l1', fromAnchor: 'bottom', toAnchor: 'top', type: 'straight', initialOpacity: 0 });

// Encryption Cycle
async function runEncryptionCycle(onComplete) {
    const { l0, r0, key, k0 } = getInputs();
    const fOut = r0 ^ k0;
    const r1 = l0 ^ fOut;
    const l1 = r0;
    const finalOut = (l1 << 8) | r1;

    canvas.setMode('encrypt');
    canvas.reset();

    const seq = new AnimationSequence(canvas);

    // Step 1: Idle
    seq.addStep({
        duration: BASE_TIMINGS.idle,
        actions: [
            { type: 'showValue', elementId: 'l0', value: format_left_split(l0) },
            { type: 'showValue', elementId: 'r0', value: format_right_split(r0) },
            { type: 'fade', elementId: 'l0', opacity: 1 },
            { type: 'fade', elementId: 'r0', opacity: 1 },
            { type: 'fade', elementId: 'l1', opacity: fadeEnabled ? 0 : 1 },
            { type: 'fade', elementId: 'r1', opacity: fadeEnabled ? 0 : 1 },
            { type: 'setLabel', elementId: 'k0', label: `K₀ = ${format_hex8(k0)}` },
            { type: 'showValue', elementId: 'f-val', value: '' },
            { type: 'fade', elementId: 'f-val', opacity: 0 },
            { type: 'highlight', elementId: 'k0', active: false },
            { type: 'highlight', elementId: 'xor', active: false },
            { type: 'fade', elementId: 'arrow-r0-k0', opacity: 0 },
            { type: 'fade', elementId: 'arrow-k0-fval', opacity: 0 },
            { type: 'fade', elementId: 'arrow-fval-r1', opacity: 0 },
            { type: 'fade', elementId: 'arrow-r0-l1', opacity: 0 },
            { type: 'custom', callback: clearMathPanel }
        ]
    });

    // Step 2: Start (R0 to Key/F)
    seq.addStep({
        duration: BASE_TIMINGS.start,
        actions: [
            { type: 'fade', elementId: 'arrow-r0-k0', opacity: 1 }
        ]
    });

    // Step 3: F evaluates (Key highlights/rotates, outputs to f-val)
    seq.addStep({
        duration: BASE_TIMINGS.middle,
        actions: [
            { type: 'highlight', elementId: 'k0', active: true },
            { type: 'showValue', elementId: 'f-val', value: format_hex8(fOut) },
            { type: 'fade', elementId: 'f-val', opacity: 1 },
            { type: 'fade', elementId: 'arrow-k0-fval', opacity: 1 }
        ]
    });

    // Step 4: XOR evaluates to R1 (XOR fades in, f-val to R1)
    seq.addStep({
        duration: BASE_TIMINGS.active / 2,
        actions: [
            { type: 'fade', elementId: 'xor', opacity: 1 },
            { type: 'highlight', elementId: 'xor', active: true },
            { type: 'fade', elementId: 'arrow-fval-r1', opacity: 1 },
            { type: 'showValue', elementId: 'r1', value: format_right_split(r1) },
            { type: 'fade', elementId: 'r1', opacity: 1 },
            ...(fadeEnabled ? [
                { type: 'fade', elementId: 'l0', opacity: 0 },
                { type: 'fade', elementId: 'r0', opacity: 0 }
            ] : []),
            { type: 'custom', callback: () => updateMathPanel(l0, r0, k0, fOut, r1, l1, finalOut) }
        ]
    });

    // Step 5: Crossover R0 -> L1 (Finally show arrow from R0 to L1)
    seq.addStep({
        duration: BASE_TIMINGS.active / 2,
        actions: [
            { type: 'fade', elementId: 'arrow-r0-l1', opacity: 1 },
            { type: 'showValue', elementId: 'l1', value: format_left_split(l1) },
            { type: 'fade', elementId: 'l1', opacity: 1 }
        ]
    });

    // Step 7: End (Reset highlights and arrows if fade enabled)
    seq.addStep({
        duration: BASE_TIMINGS.end,
        actions: [
            ...(fadeEnabled ? [
                { type: 'fade', elementId: 'arrow-r0-k0', opacity: 0 },
                { type: 'fade', elementId: 'arrow-k0-fval', opacity: 0 },
                { type: 'fade', elementId: 'arrow-fval-r1', opacity: 0 },
                { type: 'fade', elementId: 'arrow-r0-l1', opacity: 0 },
                { type: 'highlight', elementId: 'k0', active: false },
                { type: 'highlight', elementId: 'xor', active: false },
                { type: 'fade', elementId: 'xor', opacity: 0 },
                { type: 'fade', elementId: 'f-val', opacity: 0 }
            ] : [])
        ]
    });

    activePhase = 'encrypt';
    currentSequence = seq;
    await seq.play();
    activePhase = null;
    if (onComplete) onComplete();
}

// Decryption Cycle
async function runDecryptionCycle(onComplete) {
    const { l0, r0, key, k0 } = getInputs();
    const fOutEnc = r0 ^ k0;
    const r1 = l0 ^ fOutEnc;
    const l1 = r0;
    
    const decL0 = r1;
    const decR0 = l1;
    
    const fOutDec = decR0 ^ k0; 
    const decR1 = decL0 ^ fOutDec; 
    const decL1 = decR0; 
    
    const finalOut = (decR1 << 8) | decL1; 

    canvas.setMode('decrypt');
    canvas.reset();

    const seq = new AnimationSequence(canvas);

    // Step 1: Idle (Show swapped inputs decL0, decR0)
    seq.addStep({
        duration: BASE_TIMINGS.idle,
        actions: [
            { type: 'showValue', elementId: 'l0', value: format_left_split(decL0) },
            { type: 'showValue', elementId: 'r0', value: format_right_split(decR0) },
            { type: 'fade', elementId: 'l0', opacity: 1 },
            { type: 'fade', elementId: 'r0', opacity: 1 },
            { type: 'fade', elementId: 'l1', opacity: fadeEnabled ? 0 : 1 },
            { type: 'fade', elementId: 'r1', opacity: fadeEnabled ? 0 : 1 },
            { type: 'setLabel', elementId: 'k0', label: `K₀ = ${format_hex8(k0)}` },
            { type: 'showValue', elementId: 'f-val', value: '' },
            { type: 'fade', elementId: 'f-val', opacity: 0 },
            { type: 'highlight', elementId: 'k0', active: false },
            { type: 'highlight', elementId: 'xor', active: false },
            { type: 'fade', elementId: 'arrow-r0-k0', opacity: 0 },
            { type: 'fade', elementId: 'arrow-k0-fval', opacity: 0 },
            { type: 'fade', elementId: 'arrow-fval-r1', opacity: 0 },
            { type: 'fade', elementId: 'arrow-r0-l1', opacity: 0 },
            { type: 'custom', callback: clearMathPanel }
        ]
    });

    // Step 2: Start (decR0 to Key/F)
    seq.addStep({
        duration: BASE_TIMINGS.start,
        actions: [
            { type: 'fade', elementId: 'arrow-r0-k0', opacity: 1 }
        ]
    });

    // Step 3: F evaluates to f-val (Key highlights/rotates, outputs to f-val)
    seq.addStep({
        duration: BASE_TIMINGS.middle,
        actions: [
            { type: 'highlight', elementId: 'k0', active: true },
            { type: 'showValue', elementId: 'f-val', value: format_hex8(fOutDec) },
            { type: 'fade', elementId: 'f-val', opacity: 1 },
            { type: 'fade', elementId: 'arrow-k0-fval', opacity: 1 }
        ]
    });

    // Step 4: XOR evaluates to decR1 (XOR fades in, f-val to R1)
    seq.addStep({
        duration: BASE_TIMINGS.active / 2,
        actions: [
            { type: 'fade', elementId: 'xor', opacity: 1 },
            { type: 'highlight', elementId: 'xor', active: true },
            { type: 'fade', elementId: 'arrow-fval-r1', opacity: 1 },
            { type: 'showValue', elementId: 'r1', value: format_right_split(decR1) },
            { type: 'fade', elementId: 'r1', opacity: 1 },
            ...(fadeEnabled ? [
                { type: 'fade', elementId: 'l0', opacity: 0 },
                { type: 'fade', elementId: 'r0', opacity: 0 }
            ] : []),
            { type: 'custom', callback: () => updateMathPanel(decL0, decR0, k0, fOutDec, decR1, decL1, finalOut) }
        ]
    });

    // Step 5: Crossover decR0 -> decL1 (Finally show arrow from R0 to L1)
    seq.addStep({
        duration: BASE_TIMINGS.active / 2,
        actions: [
            { type: 'fade', elementId: 'arrow-r0-l1', opacity: 1 },
            { type: 'showValue', elementId: 'l1', value: format_left_split(decL1) },
            { type: 'fade', elementId: 'l1', opacity: 1 }
        ]
    });

    // Step 7: End (Reset highlights and arrows if fade enabled)
    seq.addStep({
        duration: BASE_TIMINGS.end,
        actions: [
            ...(fadeEnabled ? [
                { type: 'fade', elementId: 'arrow-r0-k0', opacity: 0 },
                { type: 'fade', elementId: 'arrow-k0-fval', opacity: 0 },
                { type: 'fade', elementId: 'arrow-fval-r1', opacity: 0 },
                { type: 'fade', elementId: 'arrow-r0-l1', opacity: 0 },
                { type: 'highlight', elementId: 'k0', active: false },
                { type: 'highlight', elementId: 'xor', active: false },
                { type: 'fade', elementId: 'xor', opacity: 0 },
                { type: 'fade', elementId: 'f-val', opacity: 0 }
            ] : [])
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
    const { l0, r0, k0 } = getInputs();
    canvas.reset();
    canvas.renderText('l0', format_left_split(l0));
    canvas.renderText('r0', format_right_split(r0));
    canvas.setOpacity('l0', 1);
    canvas.setOpacity('r0', 1);
    canvas.setOpacity('l1', fadeEnabled ? 0 : 1);
    canvas.setOpacity('r1', fadeEnabled ? 0 : 1);
    canvas.setElementLabel('k0', `K₀ = ${format_hex8(k0)}`);
    canvas.setElementLabel('f-val', '');
    canvas.setOpacity('f-val', 0);
    canvas.setOpacity('arrow-l0-xor', 0);
    canvas.setOpacity('arrow-r0-f', 0);
    canvas.setOpacity('arrow-f-xor', 0);
    canvas.setOpacity('arrow-key-f', 0);
    canvas.setOpacity('arrow-xor-r1', 0);
    canvas.setOpacity('arrow-r0-l1', 0);
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

chkFade.addEventListener('change', () => {
    fadeEnabled = chkFade.checked;
    if (activePhase === null) {
        updateInitialVisuals();
    }
});

// XOR Calculator Logic
function runCalculator() {
    let a = calcA.value.trim().toUpperCase().replace(/[^0-9A-F]/g, '');
    let b = calcB.value.trim().toUpperCase().replace(/[^0-9A-F]/g, '');
    
    calcA.value = a;
    calcB.value = b;
    
    const len = Math.max(a.length, b.length, 1);
    const aPadded = a.padStart(len, '0');
    const bPadded = b.padStart(len, '0');
    
    const valA = parseInt(aPadded, 16) || 0;
    const valB = parseInt(bPadded, 16) || 0;
    
    const res = valA ^ valB;
    const resHex = res.toString(16).toUpperCase().padStart(len, '0');
    
    calcResult.textContent = resHex;
}

calcA.addEventListener('input', runCalculator);
calcB.addEventListener('input', runCalculator);

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
fadeEnabled = chkFade.checked;
canvas.setSpeed(animationSpeed);
updateInitialVisuals();
runCalculator();
