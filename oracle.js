import HEX_PATHS from './hex_paths.js';
import { EncryptionAnimCanvas, AnimationSequence } from './animation_library.js';

// 16-bit Toy SPN Block Cipher S-box and P-box
const SBOX = [0xC, 0x5, 0x6, 0xB, 0x9, 0x0, 0xA, 0xD, 0x3, 0xE, 0xF, 0x8, 0x4, 0x7, 0x1, 0x2];
const INV_SBOX = [0x5, 0xE, 0xF, 0x8, 0xC, 0x1, 0x2, 0xD, 0xB, 0x4, 0x6, 0x3, 0x0, 0x7, 0x9, 0xA];

function permute(val) {
    let out = 0;
    const p = [0, 4, 8, 12, 1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15];
    for (let i = 0; i < 16; i++) {
        if ((val >> i) & 1) {
            out |= (1 << p[i]);
        }
    }
    return out;
}

function invPermute(val) {
    let out = 0;
    const p = [0, 4, 8, 12, 1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15];
    for (let i = 0; i < 16; i++) {
        if ((val >> p[i]) & 1) {
            out |= (1 << i);
        }
    }
    return out;
}

function substitute(val, box) {
    let out = 0;
    for (let i = 0; i < 4; i++) {
        const nibble = (val >> (i * 4)) & 0xF;
        out |= (box[nibble] << (i * 4));
    }
    return out;
}

function toyEncrypt(plain, key) {
    let state = plain;
    const roundKeys = [
        key,
        key ^ 0x5555,
        key ^ 0xAAAA,
        key ^ 0xF0F0
    ];

    for (let r = 0; r < 3; r++) {
        state ^= roundKeys[r];
        state = substitute(state, SBOX);
        state = permute(state);
    }
    state ^= roundKeys[3];
    return state;
}

function toyDecrypt(cipher, key) {
    let state = cipher;
    const roundKeys = [
        key,
        key ^ 0x5555,
        key ^ 0xAAAA,
        key ^ 0xF0F0
    ];

    state ^= roundKeys[3];
    for (let r = 2; r >= 0; r--) {
        state = invPermute(state);
        state = substitute(state, INV_SBOX);
        state ^= roundKeys[r];
    }
    return state;
}

// Helper formatting
function formatHex16(val) {
    return val.toString(16).toUpperCase().padStart(4, '0');
}

// Check if a 16-bit block has valid character-level padding (1, 22, 333, 4444)
function checkPadding(plainVal) {
    const hex = formatHex16(plainVal);
    
    // Case 1: 1 padding character (ends with '1')
    if (hex.substring(3, 4) === '1') {
        return true;
    }
    // Case 2: 2 padding characters (ends with '22')
    if (hex.substring(2, 4) === '22') {
        return true;
    }
    // Case 3: 3 padding characters (ends with '333')
    if (hex.substring(1, 4) === '333') {
        return true;
    }
    // Case 4: 4 padding characters (exactly '4444')
    if (hex === '4444') {
        return true;
    }
    return false;
}

// Format the math step description, applying redaction blocks if blocksVisible is false
function formatMathStep(blockIdx, cipher, decResult, prev, plain, isCorrect, blocksVisible) {
    const cipherStr = formatHex16(cipher);
    const decResultStr = formatHex16(decResult);
    const prevStr = formatHex16(prev);
    const plainStr = formatHex16(plain);

    const stepLabel = blockIdx === 0 ? 'IV' : 'Chain';
    const formula = `Decrypt(<code>${cipherStr}</code>) = <code>${decResultStr}</code> &oplus; ${stepLabel} <code>${prevStr}</code> = <code>${plainStr}</code>`;
    
    if (blockIdx === 0) {
        if (blocksVisible) {
            return `<strong>Block 1:</strong> ${formula}`;
        } else {
            return `<strong>Block 1:</strong> <span style="background: #151513; color: #151513; border-radius: 3px; padding: 0 4px; user-select: none;">${formula}</span>`;
        }
    } else {
        const padText = isCorrect 
            ? '<span style="color:#28a745; font-weight:bold;">Valid Padding</span>' 
            : '<span style="color:#dc3545; font-weight:bold;">Invalid Padding</span>';
            
        if (blocksVisible) {
            return `<strong>Block 2:</strong> ${formula} &rarr; ${padText}`;
        } else {
            return `<strong>Block 2:</strong> <span style="background: #151513; color: #151513; border-radius: 3px; padding: 0 4px; user-select: none;">${formula}</span> &rarr; ${padText}`;
        }
    }
}

// Helper to create SVG elements
function createSVG(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, v);
    }
    return el;
}

// DOM Elements
const svg = document.getElementById('diagram-svg');
const txtPlaintext = document.getElementById('plaintext-input');
const txtCiphertext = document.getElementById('ciphertext-input');
const txtKey = document.getElementById('key-input');
const txtIV = document.getElementById('iv-input');
const btnDecrypt = document.getElementById('btn-decrypt');
const btnLoop = document.getElementById('btn-loop');
const btnPause = document.getElementById('btn-pause');
const rangeSpeed = document.getElementById('speed-input');
const valSpeed = document.getElementById('speed-val');
const listMathSteps = document.getElementById('math-steps');
const toggleBlocks = document.getElementById('toggle-blocks');
const calcA = document.getElementById('calc-a');
const calcB = document.getElementById('calc-b');
const calcResult = document.getElementById('calc-result');
const plainInputGroup = document.getElementById('plaintext-input-group');
const keyInputGroup = document.getElementById('key-input-group');

// Animation State
let animationSpeed = 1.0;
let loopActive = false;
let currentSequence = null;
let blocksVisible = toggleBlocks.checked;

// Layout Constants (800 x 480 viewBox) - 3 Columns centered
const NUM_BLOCKS = 2;
const X_COLS = [200, 400, 600];

const Y_PLAIN = 60;
const Y_CIPHER = 200;
const Y_KEY = 270;
const Y_XOR_DEC = 270;
const Y_INTERM = 340;

const canvas = new EncryptionAnimCanvas('#diagram-svg', { hexPaths: HEX_PATHS });
document.getElementById('diagram-svg').classList.add('canvas-cbc');
document.getElementById('diagram-svg').classList.add('mode-decrypt');

function getTargetBlockOpacity() {
    return blocksVisible ? 0.3 : 0;
}

function setupDiagramLayout() {
    canvas.reset();
    canvas.elements.clear();
    const defs = svg.querySelector('defs');
    svg.innerHTML = '';
    if (defs) svg.appendChild(defs);

    canvas.setMode('decrypt');

    const op = getTargetBlockOpacity();

    // Col 0 has IV (cipher-0)
    canvas.addBlock({ id: 'cipher-0', x: X_COLS[0], y: Y_CIPHER, width: 120, height: 45, label: 'IV', isInput: true, className: 'block-iv' });

    // Columns 0 and 1
    for (let i = 0; i < 2; i++) {
        const colX = X_COLS[i];
        const outX = X_COLS[i + 1];
        const keyX = (colX + outX) / 2;

        // Cipher block
        canvas.addBlock({ id: `cipher-${i+1}`, x: outX, y: Y_CIPHER, width: 120, height: 45, label: `C${i}`, isInput: true, className: 'block-cipher-mid' });
        
        // Decryption Key
        canvas.addKey({ id: `key-${i}`, x: keyX, y: Y_KEY, type: 'hardware', size: 60 });
        
        // Decrypted Intermediate D(C_i)
        canvas.addBlock({ id: `dec-res-${i}`, x: colX, y: Y_INTERM, width: 120, height: 45, label: `D(C${i})`, isInput: true, initialOpacity: op });
        
        // XOR gate
        canvas.addXOR({ id: `xor-${i}`, x: colX, y: Y_XOR_DEC, initialOpacity: op });
        
        // Plaintext block P_i
        canvas.addBlock({ id: `plain-${i}`, x: colX, y: Y_PLAIN, width: 120, height: 45, label: `P${i}`, isInput: false, initialOpacity: op, className: 'block-plain' });
    }

    // Arrows
    for (let i = 0; i < 2; i++) {
        // Cipher(i+1) -> Key(i) (DOWN-LEFT diagonal)
        canvas.addArrow({ id: `arrow-c-key-${i}`, from: `cipher-${i+1}`, to: `key-${i}`, fromAnchor: 'bottom', toAnchor: 'top', type: 'straight', initialOpacity: 0 });
        // Key(i) -> Decrypted Intermediate(i) (DOWN-LEFT diagonal)
        canvas.addArrow({ id: `arrow-key-dec-${i}`, from: `key-${i}`, to: `dec-res-${i}`, fromAnchor: 'bottom', toAnchor: 'top', type: 'straight', initialOpacity: 0 });
        // Cipher(i) -> Plain(i) (straight up)
        canvas.addArrow({ id: `arrow-c-p-${i}`, from: `cipher-${i}`, to: `plain-${i}`, fromAnchor: 'top', toAnchor: 'bottom', type: 'straight', initialOpacity: 0 });
    }

    // Add padding indicator group to the right of plain-1 (Col 1 is x=400)
    const indicatorGroup = createSVG('g', {
        id: 'padding-indicator-group',
        transform: `translate(${X_COLS[1] + 85}, ${Y_PLAIN})`,
        opacity: 0
    });

    const tickImg = createSVG('image', {
        id: 'padding-tick',
        href: 'svg/tick.svg',
        x: -15,
        y: -15,
        width: 30,
        height: 30,
        display: 'none'
    });

    const crossImg = createSVG('image', {
        id: 'padding-cross',
        href: 'svg/cross.svg',
        x: -15,
        y: -15,
        width: 30,
        height: 30,
        display: 'none'
    });

    indicatorGroup.appendChild(tickImg);
    indicatorGroup.appendChild(crossImg);
    svg.appendChild(indicatorGroup);
}

function runDecryptionCalculations() {
    const keyVal = parseInt(txtKey.value, 16) || 0;
    const ivVal = parseInt(txtIV.value, 16) || 0;
    const calculations = [];
    let prevBlock = ivVal;

    const cipherInput = txtCiphertext.value.replace(/\s+/g, '').toUpperCase();
    const blocks = [];
    for (let i = 0; i < NUM_BLOCKS; i++) {
        const part = cipherInput.substr(i * 4, 4).padEnd(4, '0');
        blocks.push(parseInt(part, 16) || 0);
    }
    for (let i = 0; i < NUM_BLOCKS; i++) {
        const c = blocks[i];
        const decOut = toyDecrypt(c, keyVal);
        const p = decOut ^ prevBlock;

        calculations.push({
            blockIdx: i,
            cipher: c,
            decResult: decOut,
            prev: prevBlock,
            plain: p
        });
        prevBlock = c;
    }
    return calculations;
}

async function playDecryptionAnimation() {
    const calcs = runDecryptionCalculations();
    const ivVal = parseInt(txtIV.value, 16) || 0;

    setupDiagramLayout();
    listMathSteps.innerHTML = '';

    const seq = new AnimationSequence(canvas);
    const op = getTargetBlockOpacity();

    // 1. Initial State: Populate IV and Ciphertexts
    seq.addStep({
        duration: 800,
        actions: [
            { type: 'showValue', elementId: 'cipher-0', value: formatHex16(ivVal) },
            ...calcs.map((c, idx) => ({
                type: 'showValue',
                elementId: `cipher-${idx+1}`,
                value: formatHex16(c.cipher)
            })),
            ...calcs.map((c, idx) => ({
                type: 'fade',
                elementId: `cipher-${idx+1}`,
                opacity: 1
            })),
            // Reset opacity of path elements
            ...calcs.map((c, idx) => ({
                type: 'fade',
                elementId: `plain-${idx}`,
                opacity: 0
            })),
            ...calcs.map((c, idx) => ({
                type: 'fade',
                elementId: `dec-res-${idx}`,
                opacity: 0
            }))
        ]
    });

    // 2. Show arrows from Ciphertexts into Keys
    seq.addStep({
        duration: 800,
        actions: [
            ...calcs.map((c, idx) => ({
                type: 'fade',
                elementId: `arrow-c-key-${idx}`,
                opacity: 1
            }))
        ]
    });

    // 3. Highlight Keys (green) and show Key outputs
    seq.addStep({
        duration: 800,
        actions: [
            ...calcs.map((c, idx) => ({
                type: 'highlight',
                elementId: `key-${idx}`,
                active: true
            })),
            ...calcs.map((c, idx) => ({
                type: 'fade',
                elementId: `arrow-key-dec-${idx}`,
                opacity: op
            }))
        ]
    });

    // 4. Show decrypted intermediates, show XOR symbol
    seq.addStep({
        duration: 800,
        actions: [
            ...calcs.map((c, idx) => [
                { type: 'showValue', elementId: `dec-res-${idx}`, value: formatHex16(c.decResult) },
                { type: 'fade', elementId: `dec-res-${idx}`, opacity: op },
                { type: 'fade', elementId: `xor-${idx}`, opacity: op }
            ]).flat()
        ]
    });

    // 5A. Highlight XOR gates
    seq.addStep({
        duration: 400,
        actions: [
            ...calcs.map((c, idx) => ({
                type: 'highlight',
                elementId: `xor-${idx}`,
                active: true
            }))
        ]
    });

    // 5B. Show output arrows to Plaintexts
    seq.addStep({
        duration: 400,
        actions: [
            ...calcs.map((c, idx) => ({
                type: 'fade',
                elementId: `arrow-c-p-${idx}`,
                opacity: op
            }))
        ]
    });

    // 6. Show final Plaintexts & update Math panel list
    seq.addStep({
        duration: 800,
        actions: [
            ...calcs.map((c, idx) => [
                { type: 'showValue', elementId: `plain-${idx}`, value: formatHex16(c.plain) },
                { type: 'fade', elementId: `plain-${idx}`, opacity: op }
            ]).flat(),
            {
                type: 'custom',
                callback: () => {
                    calcs.forEach((c, idx) => {
                        const li = document.createElement('li');
                        const isCorrect = idx === 0 ? false : checkPadding(c.plain);
                        li.innerHTML = formatMathStep(idx, c.cipher, c.decResult, c.prev, c.plain, isCorrect, blocksVisible);
                        listMathSteps.appendChild(li);
                    });

                    // Update padding indicator
                    const finalPlain = calcs[1].plain;
                    const isCorrect = checkPadding(finalPlain);
                    const tick = document.getElementById('padding-tick');
                    const cross = document.getElementById('padding-cross');
                    if (tick && cross) {
                        if (isCorrect) {
                            tick.style.display = 'block';
                            cross.style.display = 'none';
                        } else {
                            tick.style.display = 'none';
                            cross.style.display = 'block';
                        }
                    }
                    const group = document.getElementById('padding-indicator-group');
                    if (group) {
                        group.style.transition = 'opacity 0.5s ease-in-out';
                        group.style.opacity = '1';
                    }
                }
            }
        ]
    });

    // 7. Reset active indicators
    seq.addStep({
        duration: 400,
        actions: [
            ...calcs.map((c, idx) => ({
                type: 'highlight',
                elementId: `key-${idx}`,
                active: false
            })),
            ...calcs.map((c, idx) => ({
                type: 'highlight',
                elementId: `xor-${idx}`,
                active: false
            })),
            ...calcs.map((c, idx) => [
                { type: 'fade', elementId: `arrow-c-key-${idx}`, opacity: 0 },
                { type: 'fade', elementId: `arrow-key-dec-${idx}`, opacity: 0 },
                { type: 'fade', elementId: `arrow-c-p-${idx}`, opacity: 0 }
            ]).flat()
        ]
    });

    currentSequence = seq;
    await seq.play();
    if (currentSequence === seq) {
        showFullStaticDiagram();
    }
    if (loopActive) {
        setTimeout(runAutoLoop, 2000 / animationSpeed);
    }
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
    playDecryptionAnimation();
}

// Event Listeners
btnDecrypt.addEventListener('click', () => {
    stopAnimation();
    playDecryptionAnimation();
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

function updateInputVisibility() {
    if (blocksVisible) {
        plainInputGroup.style.display = 'flex';
        keyInputGroup.style.display = 'flex';
    } else {
        plainInputGroup.style.display = 'none';
        keyInputGroup.style.display = 'none';
    }
}

toggleBlocks.addEventListener('change', () => {
    blocksVisible = toggleBlocks.checked;
    updateInputVisibility();
    stopAnimation();
    showFullStaticDiagram();
});

function updateInitialVisuals() {
    const calcs = runDecryptionCalculations();
    const ivVal = parseInt(txtIV.value, 16) || 0;

    canvas.reset();

    // IV is always at cipher-0
    canvas.renderText('cipher-0', formatHex16(ivVal));

    const op = getTargetBlockOpacity();

    for (let i = 0; i < NUM_BLOCKS; i++) {
        const c = calcs[i];
        canvas.setOpacity(`xor-${i}`, op);
        canvas.setElementActive(`key-${i}`, false);

        // Always show input ciphertext
        canvas.renderText(`cipher-${i+1}`, formatHex16(c.cipher));
        canvas.setOpacity(`cipher-${i+1}`, 1);
        
        // Initially hide decrypted intermediate and plain output
        canvas.renderText(`dec-res-${i}`, '');
        canvas.setOpacity(`dec-res-${i}`, 0);
        canvas.renderText(`plain-${i}`, '');
        canvas.setOpacity(`plain-${i}`, 0);

        canvas.setOpacity(`arrow-c-key-${i}`, 0);
        canvas.setOpacity(`arrow-key-dec-${i}`, 0);
        canvas.setOpacity(`arrow-c-p-${i}`, 0);
    }

    const group = document.getElementById('padding-indicator-group');
    if (group) {
        group.style.opacity = '0';
    }
}

function showFullStaticDiagram() {
    const calcs = runDecryptionCalculations();
    const ivVal = parseInt(txtIV.value, 16) || 0;

    canvas.reset();

    // Show IV
    canvas.renderText('cipher-0', formatHex16(ivVal));

    const op = getTargetBlockOpacity();

    for (let i = 0; i < NUM_BLOCKS; i++) {
        const c = calcs[i];
        
        // Show XOR gate
        canvas.setOpacity(`xor-${i}`, op);
        
        // Key active
        canvas.setElementActive(`key-${i}`, true);

        // Show cipher
        canvas.renderText(`cipher-${i+1}`, formatHex16(c.cipher));
        canvas.setOpacity(`cipher-${i+1}`, 1);
        
        // Show decrypted intermediate
        canvas.renderText(`dec-res-${i}`, formatHex16(c.decResult));
        canvas.setOpacity(`dec-res-${i}`, op);
        
        // Show plain
        canvas.renderText(`plain-${i}`, formatHex16(c.plain));
        canvas.setOpacity(`plain-${i}`, op);
        
        // Show arrows
        canvas.setOpacity(`arrow-c-key-${i}`, 1);
        canvas.setOpacity(`arrow-key-dec-${i}`, op);
        canvas.setOpacity(`arrow-c-p-${i}`, op);
    }

    // Update math steps list statically
    listMathSteps.innerHTML = '';
    calcs.forEach((c, idx) => {
        const li = document.createElement('li');
        const isCorrect = idx === 0 ? false : checkPadding(c.plain);
        li.innerHTML = formatMathStep(idx, c.cipher, c.decResult, c.prev, c.plain, isCorrect, blocksVisible);
        listMathSteps.appendChild(li);
    });

    // Statically show padding indicator
    const finalPlain = calcs[1].plain;
    const isCorrect = checkPadding(finalPlain);
    const tick = document.getElementById('padding-tick');
    const cross = document.getElementById('padding-cross');
    if (tick && cross) {
        if (isCorrect) {
            tick.style.display = 'block';
            cross.style.display = 'none';
        } else {
            tick.style.display = 'none';
            cross.style.display = 'block';
        }
    }
    const group = document.getElementById('padding-indicator-group');
    if (group) {
        group.style.opacity = '1';
    }
}

function syncCiphertextFromPlaintext() {
    const keyVal = parseInt(txtKey.value, 16) || 0;
    const ivVal = parseInt(txtIV.value, 16) || 0;
    const plainInput = txtPlaintext.value.replace(/\s+/g, '').toUpperCase();
    
    const blocks = [];
    for (let i = 0; i < NUM_BLOCKS; i++) {
        const part = plainInput.substr(i * 4, 4).padEnd(4, '0');
        blocks.push(parseInt(part, 16) || 0);
    }
    
    let prevBlock = ivVal;
    let cipherHex = '';
    for (let i = 0; i < NUM_BLOCKS; i++) {
        const p = blocks[i];
        const xorIn = p ^ prevBlock;
        const c = toyEncrypt(xorIn, keyVal);
        cipherHex += formatHex16(c);
        prevBlock = c;
    }
    txtCiphertext.value = cipherHex;
}

function syncPlaintextFromCiphertext() {
    const keyVal = parseInt(txtKey.value, 16) || 0;
    const ivVal = parseInt(txtIV.value, 16) || 0;
    const cipherInput = txtCiphertext.value.replace(/\s+/g, '').toUpperCase();
    
    const blocks = [];
    for (let i = 0; i < NUM_BLOCKS; i++) {
        const part = cipherInput.substr(i * 4, 4).padEnd(4, '0');
        blocks.push(parseInt(part, 16) || 0);
    }
    
    let prevBlock = ivVal;
    let plainHex = '';
    for (let i = 0; i < NUM_BLOCKS; i++) {
        const c = blocks[i];
        const decOut = toyDecrypt(c, keyVal);
        const p = decOut ^ prevBlock;
        plainHex += formatHex16(p);
        prevBlock = c;
    }
    txtPlaintext.value = plainHex;
}

txtPlaintext.addEventListener('input', () => {
    stopAnimation();
    syncCiphertextFromPlaintext();
    showFullStaticDiagram();
});

txtCiphertext.addEventListener('input', () => {
    stopAnimation();
    syncPlaintextFromCiphertext();
    showFullStaticDiagram();
});

txtKey.addEventListener('input', () => {
    stopAnimation();
    syncPlaintextFromCiphertext();
    showFullStaticDiagram();
});

txtIV.addEventListener('input', () => {
    stopAnimation();
    syncPlaintextFromCiphertext();
    showFullStaticDiagram();
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

// Initialization
canvas.setSpeed(animationSpeed);
syncCiphertextFromPlaintext();
updateInputVisibility();
setupDiagramLayout();
showFullStaticDiagram();
runCalculator();
