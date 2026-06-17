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

let currentMode = 'encrypt';

function setupDiagramLayout(mode) {
    const svgEl = document.getElementById('diagram-svg');
    const defs = svgEl.querySelector('defs');
    svgEl.innerHTML = '';
    if (defs) svgEl.appendChild(defs);
    canvas.elements.clear();
    canvas.setMode(mode);
    const isEnc = mode === 'encrypt';

    if (isEnc) {
        canvas.addBlock({ id: 'l0', x: 120, y: 30, width: 120, height: 45, label: 'L₀', isInput: true, className: 'block-plain' });
        canvas.addBlock({ id: 'r0', x: 480, y: 30, width: 120, height: 45, label: 'R₀', isInput: true, className: 'block-plain' });
        canvas.addXOR({ id: 'xor', x: 220, y: 100, initialOpacity: 0 });
        canvas.addKey({ id: 'k0', x: 480, y: 170, type: 'hardware', showF: true });
        canvas.addBlock({ id: 'f-val', x: 320, y: 170, width: 80, height: 45, label: '', initialOpacity: 0 });

        canvas.addBlock({ id: 'l1', x: 120, y: 310, width: 120, height: 45, label: 'L₁ = R₀', isInput: false, initialOpacity: 0, className: 'block-cipher-mid' });
        canvas.addBlock({ id: 'r1', x: 480, y: 310, width: 120, height: 45, label: 'R₁ = L₀ ⊕ F(R₀,K₀)', isInput: false, initialOpacity: 0, className: 'block-cipher-mid' });

        // Add arrows
        canvas.addArrow({ id: 'arrow-r0-k0', from: 'r0', to: 'k0', fromAnchor: 'bottom', toAnchor: 'top', type: 'straight', initialOpacity: 0 });
        canvas.addArrow({ id: 'arrow-k0-fval', from: 'k0', to: 'f-val', fromAnchor: 'left', toAnchor: 'right', type: 'straight', initialOpacity: 0 });
        canvas.addArrow({ id: 'arrow-fval-r1', from: 'f-val', to: 'r1', fromAnchor: 'bottom', toAnchor: 'top', type: 'straight', initialOpacity: 0 });
        canvas.addArrow({ id: 'arrow-r0-l1', from: 'r0', to: 'l1', fromAnchor: 'bottom', toAnchor: 'top', type: 'straight', initialOpacity: 0 });
    } else {
        // Decrypt mode: inputs at bottom (Y=310), outputs at top (Y=30)
        canvas.addBlock({ id: 'l1', x: 120, y: 310, width: 120, height: 45, label: 'L₁', isInput: true, className: 'block-cipher-mid' });
        canvas.addBlock({ id: 'r1', x: 480, y: 310, width: 120, height: 45, label: 'R₁', isInput: true, className: 'block-cipher-mid' });
        canvas.addXOR({ id: 'xor', x: 400, y: 240, initialOpacity: 0 });
        canvas.addKey({ id: 'k0', x: 480, y: 170, type: 'hardware', showF: true });
        canvas.addBlock({ id: 'f-val', x: 320, y: 170, width: 80, height: 45, label: '', initialOpacity: 0 });

        canvas.addBlock({ id: 'l0', x: 120, y: 30, width: 120, height: 45, label: 'L₀ = R₁ ⊕ F(L₁,K₀)', isInput: false, initialOpacity: 0, className: 'block-plain' });
        canvas.addBlock({ id: 'r0', x: 480, y: 30, width: 120, height: 45, label: 'R₀ = L₁', isInput: false, initialOpacity: 0, className: 'block-plain' });

        // Add arrows
        canvas.addArrow({ id: 'arrow-l1-k0', from: 'l1', to: 'k0', fromAnchor: 'top', toAnchor: 'bottom', type: 'straight', initialOpacity: 0 });
        canvas.addArrow({ id: 'arrow-k0-fval', from: 'k0', to: 'f-val', fromAnchor: 'left', toAnchor: 'right', type: 'straight', initialOpacity: 0 });
        canvas.addArrow({ id: 'arrow-fval-l0', from: 'f-val', to: 'l0', fromAnchor: 'top', toAnchor: 'bottom', type: 'straight', initialOpacity: 0 });
        canvas.addArrow({ id: 'arrow-l1-r0', from: 'l1', to: 'r0', fromAnchor: 'top', toAnchor: 'bottom', type: 'straight', initialOpacity: 0 });
    }
}

// Encryption Cycle
async function runEncryptionCycle(onComplete) {
    const { l0, r0, key, k0 } = getInputs();
    const fOut = r0 ^ k0;
    const r1 = l0 ^ fOut;
    const l1 = r0;
    const finalOut = (l1 << 8) | r1;

    setupDiagramLayout('encrypt');
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

    // Step 4: XOR fades in
    seq.addStep({
        duration: BASE_TIMINGS.active / 5,
        actions: [
            { type: 'fade', elementId: 'xor', opacity: 1 },
            { type: 'highlight', elementId: 'xor', active: true }
        ]
    });

    // Step 5: Arrow-to-target fades in (f-val to r1)
    seq.addStep({
        duration: BASE_TIMINGS.active / 5,
        actions: [
            { type: 'fade', elementId: 'arrow-fval-r1', opacity: 1 }
        ]
    });

    // Step 6: Target shows (R1 value)
    seq.addStep({
        duration: BASE_TIMINGS.active / 5,
        actions: [
            { type: 'showValue', elementId: 'r1', value: format_right_split(r1) },
            { type: 'fade', elementId: 'r1', opacity: 1 }
        ]
    });

    // Step 7: Crossover arrow to L1 fades in
    seq.addStep({
        duration: BASE_TIMINGS.active / 5,
        actions: [
            { type: 'fade', elementId: 'arrow-r0-l1', opacity: 1 }
        ]
    });

    // Step 8: L1 target shows and final math update
    seq.addStep({
        duration: BASE_TIMINGS.active / 5,
        actions: [
            { type: 'showValue', elementId: 'l1', value: format_left_split(l1) },
            { type: 'fade', elementId: 'l1', opacity: 1 },
            ...(fadeEnabled ? [
                { type: 'fade', elementId: 'l0', opacity: 0 },
                { type: 'fade', elementId: 'r0', opacity: 0 }
            ] : []),
            { type: 'custom', callback: () => updateMathPanel(l0, r0, k0, fOut, r1, l1, finalOut) }
        ]
    });

    // Step 9: End (Reset highlights and arrows if fade enabled)
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

    setupDiagramLayout('decrypt');
    canvas.reset();

    const seq = new AnimationSequence(canvas);

    // Step 1: Idle (Inputs at bottom: l1 showing decR0, r1 showing decL0)
    seq.addStep({
        duration: BASE_TIMINGS.idle,
        actions: [
            { type: 'showValue', elementId: 'l1', value: format_left_split(decR0) },
            { type: 'showValue', elementId: 'r1', value: format_right_split(decL0) },
            { type: 'fade', elementId: 'l1', opacity: 1 },
            { type: 'fade', elementId: 'r1', opacity: 1 },
            { type: 'fade', elementId: 'l0', opacity: fadeEnabled ? 0 : 1 },
            { type: 'fade', elementId: 'r0', opacity: fadeEnabled ? 0 : 1 },
            { type: 'setLabel', elementId: 'k0', label: `K₀ = ${format_hex8(k0)}` },
            { type: 'showValue', elementId: 'f-val', value: '' },
            { type: 'fade', elementId: 'f-val', opacity: 0 },
            { type: 'highlight', elementId: 'k0', active: false },
            { type: 'highlight', elementId: 'xor', active: false },
            { type: 'fade', elementId: 'arrow-l1-k0', opacity: 0 },
            { type: 'fade', elementId: 'arrow-k0-fval', opacity: 0 },
            { type: 'fade', elementId: 'arrow-fval-l0', opacity: 0 },
            { type: 'fade', elementId: 'arrow-l1-r0', opacity: 0 },
            { type: 'custom', callback: clearMathPanel }
        ]
    });

    // Step 2: Start (L1 to Key/F via arrow-l1-k0)
    seq.addStep({
        duration: BASE_TIMINGS.start,
        actions: [
            { type: 'fade', elementId: 'arrow-l1-k0', opacity: 1 }
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

    // Step 4: XOR fades in
    seq.addStep({
        duration: BASE_TIMINGS.active / 5,
        actions: [
            { type: 'fade', elementId: 'xor', opacity: 1 },
            { type: 'highlight', elementId: 'xor', active: true }
        ]
    });

    // Step 5: Arrow-to-target fades in (f-val to l0)
    seq.addStep({
        duration: BASE_TIMINGS.active / 5,
        actions: [
            { type: 'fade', elementId: 'arrow-fval-l0', opacity: 1 }
        ]
    });

    // Step 6: Target shows (L0 value in l0)
    seq.addStep({
        duration: BASE_TIMINGS.active / 5,
        actions: [
            { type: 'showValue', elementId: 'l0', value: format_left_split(decR1) },
            { type: 'fade', elementId: 'l0', opacity: 1 }
        ]
    });

    // Step 7: Crossover arrow to R0 fades in
    seq.addStep({
        duration: BASE_TIMINGS.active / 5,
        actions: [
            { type: 'fade', elementId: 'arrow-l1-r0', opacity: 1 }
        ]
    });

    // Step 8: R0 target shows and final math update
    seq.addStep({
        duration: BASE_TIMINGS.active / 5,
        actions: [
            { type: 'showValue', elementId: 'r0', value: format_right_split(decL1) },
            { type: 'fade', elementId: 'r0', opacity: 1 },
            ...(fadeEnabled ? [
                { type: 'fade', elementId: 'l1', opacity: 0 },
                { type: 'fade', elementId: 'r1', opacity: 0 }
            ] : []),
            { type: 'custom', callback: () => updateMathPanel(decL0, decR0, k0, fOutDec, decR1, decL1, finalOut) }
        ]
    });

    // Step 9: End (Reset highlights and arrows if fade enabled)
    seq.addStep({
        duration: BASE_TIMINGS.end,
        actions: [
            ...(fadeEnabled ? [
                { type: 'fade', elementId: 'arrow-l1-k0', opacity: 0 },
                { type: 'fade', elementId: 'arrow-k0-fval', opacity: 0 },
                { type: 'fade', elementId: 'arrow-fval-l0', opacity: 0 },
                { type: 'fade', elementId: 'arrow-l1-r0', opacity: 0 },
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
    if (currentSequence === seq) {
        showFullStaticDiagram();
    }
    activePhase = null;
    if (onComplete) onComplete();
}

function stopAnimation() {
    if (currentSequence) {
        currentSequence.stop();
    }
    showFullStaticDiagram();
    loopActive = false;
    btnLoop.textContent = 'Auto Loop';
    btnPause.style.display = 'none';
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

function showFullStaticDiagram() {
    const { l0, r0, k0 } = getInputs();
    setupDiagramLayout(currentMode);
    canvas.reset();

    const isEnc = currentMode === 'encrypt';

    // Highlight key active in static diagram
    canvas.setElementActive('k0', true);
    // Show XOR gate
    canvas.setOpacity('xor', 1);

    if (isEnc) {
        const fOut = r0 ^ k0;
        const r1Val = l0 ^ fOut;
        const l1Val = r0;
        const finalOut = (l1Val << 8) | r1Val;

        canvas.renderText('l0', format_left_split(l0));
        canvas.setOpacity('l0', 1);
        canvas.renderText('r0', format_right_split(r0));
        canvas.setOpacity('r0', 1);

        canvas.renderText('f-val', format_hex8(fOut));
        canvas.setOpacity('f-val', 1);

        canvas.renderText('l1', format_left_split(l1Val));
        canvas.setOpacity('l1', 1);
        canvas.renderText('r1', format_right_split(r1Val));
        canvas.setOpacity('r1', 1);

        // Arrows visible
        canvas.setOpacity('arrow-r0-k0', 1);
        canvas.setOpacity('arrow-k0-fval', 1);
        canvas.setOpacity('arrow-l0-xor', 1);
        canvas.setOpacity('arrow-fval-xor', 1);
        canvas.setOpacity('arrow-xor-r1', 1);
        canvas.setOpacity('arrow-r0-l1', 1);

        updateMathPanel(l0, r0, k0, fOut, r1Val, l1Val, finalOut);
    } else {
        const fOutEnc = r0 ^ k0;
        const cipherR = l0 ^ fOutEnc;
        const cipherL = r0;
        
        const decL0 = cipherR;
        const decR0 = cipherL;
        const fOutDec = decR0 ^ k0;
        const decR1 = decL0 ^ fOutDec;
        const decL1 = decR0;
        const finalOut = (decR1 << 8) | decL1;

        canvas.renderText('l1', format_left_split(decR0));
        canvas.setOpacity('l1', 1);
        canvas.renderText('r1', format_right_split(decL0));
        canvas.setOpacity('r1', 1);

        canvas.renderText('f-val', format_hex8(fOutDec));
        canvas.setOpacity('f-val', 1);

        canvas.renderText('l0', format_left_split(decR1));
        canvas.setOpacity('l0', 1);
        canvas.renderText('r0', format_right_split(decL1));
        canvas.setOpacity('r0', 1);

        // Arrows visible
        canvas.setOpacity('arrow-l1-k0', 1);
        canvas.setOpacity('arrow-k0-fval', 1);
        canvas.setOpacity('arrow-r1-xor', 1);
        canvas.setOpacity('arrow-fval-xor', 1);
        canvas.setOpacity('arrow-xor-l0', 1);
        canvas.setOpacity('arrow-l1-r0', 1);

        updateMathPanel(decL0, decR0, k0, fOutDec, decR1, decL1, finalOut);
    }
}

async function updateInitialVisuals() {
    const { l0, r0, k0 } = getInputs();
    setupDiagramLayout(currentMode);
    canvas.reset();

    const isEnc = currentMode === 'encrypt';

    if (isEnc) {
        canvas.renderText('l0', format_left_split(l0));
        canvas.renderText('r0', format_right_split(r0));
        canvas.setOpacity('l0', 1);
        canvas.setOpacity('r0', 1);
        canvas.setOpacity('l1', fadeEnabled ? 0 : 1);
        canvas.setOpacity('r1', fadeEnabled ? 0 : 1);
        canvas.setElementLabel('k0', `K₀ = ${format_hex8(k0)}`);
        canvas.setElementLabel('f-val', '');
        canvas.setOpacity('f-val', 0);
        canvas.setOpacity('xor', 0);

        canvas.setOpacity('arrow-r0-k0', 0);
        canvas.setOpacity('arrow-k0-fval', 0);
        canvas.setOpacity('arrow-l0-xor', 0);
        canvas.setOpacity('arrow-fval-xor', 0);
        canvas.setOpacity('arrow-xor-r1', 0);
        canvas.setOpacity('arrow-r0-l1', 0);
    } else {
        const fOutEnc = r0 ^ k0;
        const cipherR = l0 ^ fOutEnc;
        const cipherL = r0;

        canvas.renderText('l1', format_left_split(cipherL)); // L1
        canvas.renderText('r1', format_right_split(cipherR)); // R1
        canvas.setOpacity('l1', 1);
        canvas.setOpacity('r1', 1);
        canvas.setOpacity('l0', fadeEnabled ? 0 : 1);
        canvas.setOpacity('r0', fadeEnabled ? 0 : 1);
        canvas.setElementLabel('k0', `K₀ = ${format_hex8(k0)}`);
        canvas.setElementLabel('f-val', '');
        canvas.setOpacity('f-val', 0);
        canvas.setOpacity('xor', 0);

        canvas.setOpacity('arrow-l1-k0', 0);
        canvas.setOpacity('arrow-k0-fval', 0);
        canvas.setOpacity('arrow-r1-xor', 0);
        canvas.setOpacity('arrow-fval-xor', 0);
        canvas.setOpacity('arrow-xor-l0', 0);
        canvas.setOpacity('arrow-l1-r0', 0);
    }
    clearMathPanel();
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

chkFade.addEventListener('change', () => {
    fadeEnabled = chkFade.checked;
    if (activePhase === null) {
        showFullStaticDiagram();
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
        showFullStaticDiagram();
    }
});

txtKey.addEventListener('input', () => {
    if (activePhase === null) {
        showFullStaticDiagram();
    }
});

// Initialize
fadeEnabled = chkFade.checked;
canvas.setSpeed(animationSpeed);
showFullStaticDiagram();
runCalculator();
