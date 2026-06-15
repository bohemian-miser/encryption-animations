import HEX_PATHS from './hex_paths.js';

// DOM Elements
const animSpace = document.querySelector('.animation-space');
const boxL0 = document.getElementById('box-l0');
const boxR0 = document.getElementById('box-r0');
const boxL1 = document.getElementById('box-l1');
const boxR1 = document.getElementById('box-r1');

const l0Container = document.getElementById('l0-container');
const r0Container = document.getElementById('r0-container');
const l1Container = document.getElementById('l1-container');
const r1Container = document.getElementById('r1-container');

const xorGate = document.getElementById('xor-gate');
const fBlock = document.getElementById('f-block');
const keyNodeVal = document.getElementById('key-node-val');

// Math Panel Elements
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

// Controls
const txtPlaintext = document.getElementById('plaintext-input');
const txtKey = document.getElementById('key-input');
const btnEncrypt = document.getElementById('btn-encrypt');
const btnDecrypt = document.getElementById('btn-decrypt');
const btnLoop = document.getElementById('btn-loop');
const btnPause = document.getElementById('btn-pause');
const rangeSpeed = document.getElementById('speed-input');
const valSpeed = document.getElementById('speed-val');

// State Variables
let animationSpeed = 1.0;
let loopActive = false;
let currentTimeout = null;
let activePhase = null; // 'encrypt' or 'decrypt' or null

// Base timings in ms (total 4000ms at 1x)
const BASE_TIMINGS = {
    idle: 300,
    start: 1000,   // L0, R0 split, Key to F
    middle: 1200,  // F calculates, output to XOR
    active: 1000,  // XOR calculates, output to R1, crossover to L1
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

// Render text in small SVG box (width 240)
function renderTextInBox(text, boxSvgElement) {
    const boxPathGroup = boxSvgElement.querySelector('g') || boxSvgElement.querySelector('#box-path');
    boxSvgElement.innerHTML = '';
    if (boxPathGroup) {
        boxSvgElement.appendChild(boxPathGroup);
    } else {
        // Keep the path if we dynamically cleared it
        const path = boxSvgElement.querySelector('.box-outline');
        if (path) {
             const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
             g.appendChild(path);
             boxSvgElement.appendChild(g);
        }
    }

    const N = text.length;
    const spacing = 55;
    const charWidth = 60;
    const totalWidth = (N - 1) * spacing + charWidth;
    const startX = (240 - totalWidth) / 2;
    const posY = 5; // adjusted for smaller box

    for (let i = 0; i < N; i++) {
        const char = text[i];
        if (char === ' ') continue;

        const paths = HEX_PATHS[char.toUpperCase()];
        if (!paths) continue;

        const x = startX + i * spacing;

        const charGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        charGroup.setAttribute('class', 'char-group');
        // scale down slightly to fit 80px height
        charGroup.setAttribute('transform', `translate(${x}, ${posY}) scale(0.8)`);
        charGroup.style.transition = 'opacity 0.3s ease-in-out';
        charGroup.style.opacity = '1';

        paths.forEach(d => {
            const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathEl.setAttribute('d', d);
            pathEl.setAttribute('fill', '#000');
            charGroup.appendChild(pathEl);
        });

        boxSvgElement.appendChild(charGroup);
    }
}

function getInputs() {
    const cleanHex = txtPlaintext.value.replace(/\s+/g, '').padStart(4, '0');
    const val16 = parseInt(cleanHex, 16) || 0;
    const l0 = (val16 >> 8) & 0xFF;
    const r0 = val16 & 0xFF;

    const keyHex = txtKey.value.replace(/\s+/g, '').padStart(4, '0');
    const keyVal16 = parseInt(keyHex, 16) || 0;
    const k0 = (keyVal16 >> 8) & 0xFF;

    return { l0, r0, key: keyVal16, k0, val16 };
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

// Encryption Cycle
function runEncryptionCycle(onComplete) {
    const { l0, r0, key, k0 } = getInputs();
    
    // Feistel Round 1 Math
    const fOut = r0 ^ k0;
    const r1 = l0 ^ fOut;
    const l1 = r0;
    const finalOut = (l1 << 8) | r1;

    const t = (name) => BASE_TIMINGS[name] / animationSpeed;

    activePhase = 'encrypt';
    animSpace.className = 'animation-space feistel-layout';
    
    // Reset nodes
    fBlock.classList.remove('active');
    xorGate.classList.remove('active');
    keyNodeVal.textContent = format_hex8(k0);

    // Initial state: Top boxes visible with L0, R0
    renderTextInBox(format_left_split(l0), boxL0);
    renderTextInBox(format_right_split(r0), boxR0);
    l0Container.style.opacity = '1';
    r0Container.style.opacity = '1';

    // Clear bottom boxes
    renderTextInBox('', boxL1);
    renderTextInBox('', boxR1);
    l1Container.style.opacity = '0';
    r1Container.style.opacity = '0';
    clearMathPanel();

    currentTimeout = setTimeout(() => {
        // Step 2: Start (Arrows from L0, R0 active, Key to F)
        animSpace.classList.add('state-feistel-start');
        
        currentTimeout = setTimeout(() => {
            // Step 3: Middle (F block calculates, active, F to XOR arrow active)
            animSpace.classList.remove('state-feistel-start');
            animSpace.classList.add('state-feistel-middle');
            fBlock.classList.add('active');

            currentTimeout = setTimeout(() => {
                // Step 4: Active (XOR active, crossover active, bottom boxes fade in)
                animSpace.classList.remove('state-feistel-middle');
                animSpace.classList.add('state-feistel-active');
                xorGate.classList.add('active');

                renderTextInBox(format_left_split(l1), boxL1);
                renderTextInBox(format_right_split(r1), boxR1);
                l1Container.style.opacity = '1';
                r1Container.style.opacity = '1';
                
                // Top boxes fade out
                l0Container.style.opacity = '0';
                r0Container.style.opacity = '0';

                updateMathPanel(l0, r0, k0, fOut, r1, l1, finalOut);

                currentTimeout = setTimeout(() => {
                    // Reset arrows, keep bottom boxes
                    animSpace.classList.remove('state-feistel-active');
                    fBlock.classList.remove('active');
                    xorGate.classList.remove('active');
                    
                    currentTimeout = setTimeout(() => {
                        activePhase = null;
                        if (onComplete) onComplete();
                    }, t('end'));
                }, t('active'));
            }, t('middle'));
        }, t('start'));
    }, t('idle'));
}

// Decryption Cycle
function runDecryptionCycle(onComplete) {
    const { l0, r0, key, k0 } = getInputs();
    
    // Ciphertext is the result of encryption
    const fOutEnc = r0 ^ k0;
    const r1 = l0 ^ fOutEnc;
    const l1 = r0;
    
    // For Decryption round:
    // Left Input is R1, Right Input is L1
    const decL0 = r1;
    const decR0 = l1;
    
    // Math:
    const fOutDec = decR0 ^ k0; // L1 ^ k0 = R0 ^ k0
    const decR1 = decL0 ^ fOutDec; // R1 ^ (R0 ^ k0) = (L0 ^ R0 ^ k0) ^ R0 ^ k0 = L0
    const decL1 = decR0; // L1 = R0
    
    // Output swapped back is decL1, decR1 (which is L1, R1_dec = R0, L0)
    // Combined output should be L0, R0
    const finalOut = (decR1 << 8) | decL1; // L0 | R0

    const t = (name) => BASE_TIMINGS[name] / animationSpeed;

    activePhase = 'decrypt';
    animSpace.className = 'animation-space feistel-layout';
    
    // Reset nodes
    fBlock.classList.remove('active');
    xorGate.classList.remove('active');
    keyNodeVal.textContent = format_hex8(k0);

    // Initial state: Top boxes loaded with swapped inputs (R1 on left, L1 on right)
    renderTextInBox(format_left_split(decL0), boxL0);
    renderTextInBox(format_right_split(decR0), boxR0);
    l0Container.style.opacity = '1';
    r0Container.style.opacity = '1';

    // Clear bottom boxes
    renderTextInBox('', boxL1);
    renderTextInBox('', boxR1);
    l1Container.style.opacity = '0';
    r1Container.style.opacity = '0';
    clearMathPanel();

    currentTimeout = setTimeout(() => {
        // Step 2: Start
        animSpace.classList.add('state-feistel-start');
        
        currentTimeout = setTimeout(() => {
            // Step 3: Middle
            animSpace.classList.remove('state-feistel-start');
            animSpace.classList.add('state-feistel-middle');
            fBlock.classList.add('active');

            currentTimeout = setTimeout(() => {
                // Step 4: Active (Outputs are decL1 and decR1)
                animSpace.classList.remove('state-feistel-middle');
                animSpace.classList.add('state-feistel-active');
                xorGate.classList.add('active');

                renderTextInBox(format_left_split(decL1), boxL1);
                renderTextInBox(format_right_split(decR1), boxR1);
                l1Container.style.opacity = '1';
                r1Container.style.opacity = '1';
                
                // Top boxes fade out
                l0Container.style.opacity = '0';
                r0Container.style.opacity = '0';

                // Display math for decryption
                updateMathPanel(decL0, decR0, k0, fOutDec, decR1, decL1, finalOut);

                currentTimeout = setTimeout(() => {
                    // Reset
                    animSpace.classList.remove('state-feistel-active');
                    fBlock.classList.remove('active');
                    xorGate.classList.remove('active');
                    
                    currentTimeout = setTimeout(() => {
                        activePhase = null;
                        if (onComplete) onComplete();
                    }, t('end'));
                }, t('active'));
            }, t('middle'));
        }, t('start'));
    }, t('idle'));
}

function stopAnimation() {
    clearTimeout(currentTimeout);
    animSpace.className = 'animation-space feistel-layout';
    fBlock.classList.remove('active');
    xorGate.classList.remove('active');
    l0Container.style.opacity = '1';
    r0Container.style.opacity = '1';
    l1Container.style.opacity = '1';
    r1Container.style.opacity = '1';
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

rangeSpeed.addEventListener('input', (e) => {
    animationSpeed = parseFloat(e.target.value);
    valSpeed.textContent = animationSpeed.toFixed(1) + 'x';
    
    document.querySelectorAll('.feistel-arrow').forEach(el => {
        el.style.transitionDuration = `${0.3 / animationSpeed}s`;
    });
    document.querySelectorAll('.box-container').forEach(el => {
        el.style.transitionDuration = `${0.5 / animationSpeed}s`;
    });
});

// Initialize
const { l0, r0, k0 } = getInputs();
renderTextInBox(format_left_split(l0), boxL0);
renderTextInBox(format_right_split(r0), boxR0);
keyNodeVal.textContent = format_hex8(k0);
l0Container.style.opacity = '1';
r0Container.style.opacity = '1';
l1Container.style.opacity = '0';
r1Container.style.opacity = '0';
clearMathPanel();
