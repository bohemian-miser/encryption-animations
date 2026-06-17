import HEX_PATHS from './hex_paths.js';
import { EncryptionAnimCanvas, AnimationSequence } from './animation_library.js';

// 16-bit Toy SPN Block Cipher
const SBOX = [0xC, 0x5, 0x6, 0xB, 0x9, 0x0, 0xA, 0xD, 0x3, 0xE, 0xF, 0x8, 0x4, 0x7, 0x1, 0x2];
const INV_SBOX = [0x5, 0xE, 0xF, 0x8, 0xC, 0x1, 0x2, 0xD, 0xB, 0x4, 0x6, 0x3, 0x0, 0x7, 0x9, 0xA];

// P-Box: 16-bit permutation
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

// DOM Elements
const svg = document.getElementById('diagram-svg');
const txtPlaintext = document.getElementById('plaintext-input');
const txtCiphertext = document.getElementById('ciphertext-input');
const txtKey = document.getElementById('key-input');
const txtIV = document.getElementById('iv-input');
const selectMode = document.getElementById('block-mode-select');
const btnEncrypt = document.getElementById('btn-encrypt');
const btnLoop = document.getElementById('btn-loop');
const btnPause = document.getElementById('btn-pause');
const rangeSpeed = document.getElementById('speed-input');
const valSpeed = document.getElementById('speed-val');
const listMathSteps = document.getElementById('math-steps');

// Animation State
let animationSpeed = 1.0;
let loopActive = false;
let currentSequence = null;

// Layout Constants (800 x 480 viewBox)
const NUM_BLOCKS = 4;
const X_COLS = [80, 240, 400, 560, 720];

const Y_PLAIN = 60;
const Y_XOR_ENC = 135;
const Y_CIPHER = 200;
const Y_KEY = 270;
const Y_XOR_DEC = 270;
const Y_INTERM = 340;

const canvas = new EncryptionAnimCanvas('#diagram-svg', { hexPaths: HEX_PATHS });
document.getElementById('diagram-svg').classList.add('canvas-cbc');

function setupDiagramLayout(mode) {
    canvas.reset();
    canvas.elements.clear();
    const defs = svg.querySelector('defs');
    svg.innerHTML = '';
    if (defs) svg.appendChild(defs);

    canvas.setMode(mode);
    const isEnc = mode === 'encrypt';

    // Add IV block at Col 0 (Cipher line)
    canvas.addBlock({ id: `cipher-0`, x: X_COLS[0], y: Y_CIPHER, width: 120, height: 45, label: `IV`, isInput: true, initialOpacity: 1, className: 'block-cipher-mid' });

    // Add elements for columns 0 to 3
    for (let i = 0; i < 4; i++) {
        const colX = X_COLS[i];
        const outX = X_COLS[i + 1];
        const keyX = colX + 80; // Midpoint between columns (160 / 2 = 80)

        if (isEnc) {
            canvas.addBlock({ id: `plain-${i}`, x: colX, y: Y_PLAIN, width: 120, height: 45, label: `P${i}`, isInput: true, className: 'block-plain' });
            canvas.addXOR({ id: `xor-${i}`, x: colX, y: Y_XOR_ENC, initialOpacity: 0 });
            canvas.addBlock({
                id: `xor-res-${i}`,
                x: colX,
                y: Y_INTERM,
                width: 120,
                height: 45,
                label: i === 0 ? 'P0⊕IV' : `P${i}⊕C${i-1}`,
                isInput: true,
                initialOpacity: 0
            });
            canvas.addKey({ id: `key-${i}`, x: keyX, y: Y_KEY, type: 'hardware', size: 60 });
            canvas.addBlock({ id: `cipher-${i+1}`, x: outX, y: Y_CIPHER, width: 120, height: 45, label: `C${i}`, isInput: false, initialOpacity: 0, className: 'block-cipher-mid' });
        } else {
            // Decrypt
            canvas.addBlock({ id: `cipher-${i+1}`, x: outX, y: Y_CIPHER, width: 120, height: 45, label: `C${i}`, isInput: true, initialOpacity: 1, className: 'block-cipher-mid' });
            canvas.addKey({ id: `key-${i}`, x: keyX, y: Y_KEY, type: 'hardware', size: 60 });
            canvas.addBlock({ id: `dec-res-${i}`, x: colX, y: Y_INTERM, width: 120, height: 45, label: `D(C${i})`, isInput: true, initialOpacity: 0 });
            canvas.addXOR({ id: `xor-${i}`, x: colX, y: Y_XOR_DEC, initialOpacity: 0 });
            canvas.addBlock({ id: `plain-${i}`, x: colX, y: Y_PLAIN, width: 120, height: 45, label: `P${i}`, isInput: false, initialOpacity: 0, className: 'block-plain' });
        }
    }

    // Add arrows
    for (let i = 0; i < 4; i++) {
        if (isEnc) {
            // Cipher(i) -> Intermediate(i) (straight down)
            canvas.addArrow({ id: `arrow-c-interm-${i}`, from: `cipher-${i}`, to: `xor-res-${i}`, fromAnchor: 'bottom', toAnchor: 'top', type: 'straight', initialOpacity: 0 });
            // Intermediate(i) -> Key(i) (UP-RIGHT diagonal)
            canvas.addArrow({ id: `arrow-interm-key-${i}`, from: `xor-res-${i}`, to: `key-${i}`, fromAnchor: 'top', toAnchor: 'bottom', type: 'straight', initialOpacity: 0 });
            // Key(i) -> Cipher(i+1) (UP-RIGHT diagonal)
            canvas.addArrow({ id: `arrow-key-c-${i}`, from: `key-${i}`, to: `cipher-${i+1}`, fromAnchor: 'top', toAnchor: 'bottom', type: 'straight', initialOpacity: 0 });
        } else {
            // Decrypt
            // Cipher(i+1) -> Key(i) (DOWN-LEFT diagonal)
            canvas.addArrow({ id: `arrow-c-key-${i}`, from: `cipher-${i+1}`, to: `key-${i}`, fromAnchor: 'bottom', toAnchor: 'top', type: 'straight', initialOpacity: 0 });
            // Key(i) -> Decrypted Intermediate(i) (DOWN-LEFT diagonal)
            canvas.addArrow({ id: `arrow-key-dec-${i}`, from: `key-${i}`, to: `dec-res-${i}`, fromAnchor: 'bottom', toAnchor: 'top', type: 'straight', initialOpacity: 0 });
            // Cipher(i) -> Plain(i) (straight up)
            canvas.addArrow({ id: `arrow-c-p-${i}`, from: `cipher-${i}`, to: `plain-${i}`, fromAnchor: 'top', toAnchor: 'bottom', type: 'straight', initialOpacity: 0 });
        }
    }
}

// Calculate the full CBC encryption/decryption chaining values
// Calculate the full CBC encryption/decryption chaining values
function runCBCCalculations(mode) {
    const keyVal = parseInt(txtKey.value, 16) || 0;
    const ivVal = parseInt(txtIV.value, 16) || 0;
    const calculations = [];
    let prevBlock = ivVal;

    if (mode === 'encrypt') {
        const plainInput = txtPlaintext.value.replace(/\s+/g, '').toUpperCase();
        const blocks = [];
        for (let i = 0; i < NUM_BLOCKS; i++) {
            const part = plainInput.substr(i * 4, 4).padEnd(4, '0');
            blocks.push(parseInt(part, 16) || 0);
        }
        for (let i = 0; i < NUM_BLOCKS; i++) {
            const p = blocks[i];
            const xorIn = p ^ prevBlock;
            const c = toyEncrypt(xorIn, keyVal);
            
            calculations.push({
                blockIdx: i,
                plain: p,
                prev: prevBlock,
                xorResult: xorIn,
                cipher: c
            });
            prevBlock = c;
        }
        return calculations;
    } else {
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
}

async function playCBCAnimation() {
    const mode = selectMode.value;
    const calcs = runCBCCalculations(mode);
    const isEnc = mode === 'encrypt';
    const ivVal = parseInt(txtIV.value, 16) || 0;

    setupDiagramLayout(mode);
    listMathSteps.innerHTML = '';

    const seq = new AnimationSequence(canvas);

    if (isEnc) {
        // ENCRYPT: Sequential block-by-block
        // Show IV and all plaintexts at start
        seq.addStep({
            duration: 400,
            actions: [
                { type: 'showValue', elementId: 'cipher-0', value: formatHex16(ivVal) },
                ...calcs.map((c, idx) => ({
                    type: 'showValue',
                    elementId: `plain-${idx}`,
                    value: formatHex16(c.plain)
                })),
                ...calcs.map((c, idx) => ({
                    type: 'fade',
                    elementId: `plain-${idx}`,
                    opacity: 1
                }))
            ]
        });

        for (let i = 0; i < NUM_BLOCKS; i++) {
            const c = calcs[i];

            // 2. Show XOR inputs: XOR gate and arrow from Cipher(i) to Intermediate(i) fade in
            seq.addStep({
                duration: 800,
                actions: [
                    { type: 'fade', elementId: `xor-${i}`, opacity: 1 },
                    { type: 'fade', elementId: `arrow-c-interm-${i}`, opacity: 1 }
                ]
            });

            // 3. Highlight XOR, show intermediate value
            seq.addStep({
                duration: 800,
                actions: [
                    { type: 'highlight', elementId: `xor-${i}`, active: true },
                    { type: 'showValue', elementId: `xor-res-${i}`, value: formatHex16(c.xorResult) },
                    { type: 'fade', elementId: `xor-res-${i}`, opacity: 1 }
                ]
            });

            // 4. Highlight Key and Key input arrow
            seq.addStep({
                duration: 800,
                actions: [
                    { type: 'fade', elementId: `arrow-interm-key-${i}`, opacity: 1 },
                    { type: 'highlight', elementId: `key-${i}`, active: true }
                ]
            });

            // 5. Highlight Key output path and show Ciphertext
            seq.addStep({
                duration: 800,
                actions: [
                    { type: 'fade', elementId: `arrow-key-c-${i}`, opacity: 1 },
                    { type: 'showValue', elementId: `cipher-${i+1}`, value: formatHex16(c.cipher) },
                    { type: 'fade', elementId: `cipher-${i+1}`, opacity: 1 },
                    {
                        type: 'custom',
                        callback: () => {
                            const li = document.createElement('li');
                            if (i === 0) {
                                li.innerHTML = `<strong>Block 1:</strong> Input <code>${formatHex16(c.plain)}</code> &oplus; IV <code>${formatHex16(c.prev)}</code> = <code>${formatHex16(c.xorResult)}</code> &rarr; Encrypt = <code>${formatHex16(c.cipher)}</code>`;
                            } else {
                                li.innerHTML = `<strong>Block ${i+1}:</strong> Input <code>${formatHex16(c.plain)}</code> &oplus; Chain <code>${formatHex16(c.prev)}</code> = <code>${formatHex16(c.xorResult)}</code> &rarr; Encrypt = <code>${formatHex16(c.cipher)}</code>`;
                            }
                            listMathSteps.appendChild(li);
                        }
                    }
                ]
            });

            // 6. Reset active indicators, leaving values highlighted
            seq.addStep({
                duration: 400,
                actions: [
                    { type: 'fade', elementId: `arrow-c-interm-${i}`, opacity: 0 },
                    { type: 'highlight', elementId: `xor-${i}`, active: false },
                    { type: 'fade', elementId: `arrow-interm-key-${i}`, opacity: 0 },
                    { type: 'highlight', elementId: `key-${i}`, active: false },
                    { type: 'fade', elementId: `arrow-key-c-${i}`, opacity: 0 }
                ]
            });
        }
    } else {
        // DECRYPT: Parallel animation for all blocks
        
        // 1. Initial State: Populate IV and all Ciphertexts at start
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
                // Hide plaintexts and intermediates
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
                    opacity: 1
                }))
            ]
        });

        // 4. Show decrypted intermediates, show arrows to Plain and XOR symbol
        seq.addStep({
            duration: 800,
            actions: [
                ...calcs.map((c, idx) => [
                    { type: 'showValue', elementId: `dec-res-${idx}`, value: formatHex16(c.decResult) },
                    { type: 'fade', elementId: `dec-res-${idx}`, opacity: 1 },
                    { type: 'fade', elementId: `arrow-dec-c-${idx}`, opacity: 1 },
                    { type: 'fade', elementId: `xor-${idx}`, opacity: 1 }
                ]).flat()
            ]
        });

        // 5. Highlight XOR gates and show outputs to Plaintexts
        seq.addStep({
            duration: 800,
            actions: [
                ...calcs.map((c, idx) => [
                    { type: 'highlight', elementId: `xor-${idx}`, active: true }
                ]).flat()
            ]
        });

        // 6. Show final Plaintexts & update Math panel list
        seq.addStep({
            duration: 800,
            actions: [
                ...calcs.map((c, idx) => [
                    { type: 'showValue', elementId: `plain-${idx}`, value: formatHex16(c.plain) },
                    { type: 'fade', elementId: `plain-${idx}`, opacity: 1 }
                ]).flat(),
                {
                    type: 'custom',
                    callback: () => {
                        calcs.forEach((c, idx) => {
                            const li = document.createElement('li');
                            if (idx === 0) {
                                li.innerHTML = `<strong>Block 1:</strong> Decrypt(<code>${formatHex16(c.cipher)}</code>) = <code>${formatHex16(c.decResult)}</code> &oplus; IV <code>${formatHex16(c.prev)}</code> = <code>${formatHex16(c.plain)}</code>`;
                            } else {
                                li.innerHTML = `<strong>Block ${idx+1}:</strong> Decrypt(<code>${formatHex16(c.cipher)}</code>) = <code>${formatHex16(c.decResult)}</code> &oplus; Chain <code>${formatHex16(c.prev)}</code> = <code>${formatHex16(c.plain)}</code>`;
                            }
                            listMathSteps.appendChild(li);
                        });
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
                    { type: 'fade', elementId: `arrow-dec-c-${idx}`, opacity: 0 }
                ]).flat()
            ]
        });
    }

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
    playCBCAnimation();
}

// Event Listeners
btnEncrypt.addEventListener('click', () => {
    stopAnimation();
    playCBCAnimation();
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

function updateInitialVisuals() {
    const mode = selectMode.value;
    const calcs = runCBCCalculations(mode);
    const ivVal = parseInt(txtIV.value, 16) || 0;

    canvas.reset();

    // IV is always at cipher-0
    canvas.renderText('cipher-0', formatHex16(ivVal));

    for (let i = 0; i < NUM_BLOCKS; i++) {
        const c = calcs[i];
        canvas.setOpacity(`xor-${i}`, 0);
        canvas.setElementActive(`key-${i}`, false);

        if (mode === 'encrypt') {
            // Always show input plaintext
            canvas.renderText(`plain-${i}`, formatHex16(c.plain));
            canvas.setOpacity(`plain-${i}`, 1);
            
            // Initially hide intermediate and cipher
            canvas.renderText(`xor-res-${i}`, '');
            canvas.setOpacity(`xor-res-${i}`, 0);
            canvas.renderText(`cipher-${i+1}`, '');
            canvas.setOpacity(`cipher-${i+1}`, 0);

            canvas.setOpacity(`arrow-c-interm-${i}`, 0);
            canvas.setOpacity(`arrow-interm-key-${i}`, 0);
            canvas.setOpacity(`arrow-key-c-${i}`, 0);
        } else {
            // Decrypt
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
    }
}

function showFullStaticDiagram() {
    const mode = selectMode.value;
    const calcs = runCBCCalculations(mode);
    const ivVal = parseInt(txtIV.value, 16) || 0;

    canvas.reset();

    // Show IV
    canvas.renderText('cipher-0', formatHex16(ivVal));

    for (let i = 0; i < NUM_BLOCKS; i++) {
        const c = calcs[i];
        
        // Show XOR gate
        canvas.setOpacity(`xor-${i}`, 1);
        
        // Key active
        canvas.setElementActive(`key-${i}`, true);

        if (mode === 'encrypt') {
            // Show plain
            canvas.renderText(`plain-${i}`, formatHex16(c.plain));
            canvas.setOpacity(`plain-${i}`, 1);
            
            // Show intermediate
            canvas.renderText(`xor-res-${i}`, formatHex16(c.xorResult));
            canvas.setOpacity(`xor-res-${i}`, 1);
            
            // Show cipher
            canvas.renderText(`cipher-${i+1}`, formatHex16(c.cipher));
            canvas.setOpacity(`cipher-${i+1}`, 1);
            
            // Show arrows
            canvas.setOpacity(`arrow-c-interm-${i}`, 1);
            canvas.setOpacity(`arrow-interm-key-${i}`, 1);
            canvas.setOpacity(`arrow-key-c-${i}`, 1);
        } else {
            // Decrypt
            // Show cipher
            canvas.renderText(`cipher-${i+1}`, formatHex16(c.cipher));
            canvas.setOpacity(`cipher-${i+1}`, 1);
            
            // Show decrypted intermediate
            canvas.renderText(`dec-res-${i}`, formatHex16(c.decResult));
            canvas.setOpacity(`dec-res-${i}`, 1);
            
            // Show plain
            canvas.renderText(`plain-${i}`, formatHex16(c.plain));
            canvas.setOpacity(`plain-${i}`, 1);
            
            // Show arrows
            canvas.setOpacity(`arrow-c-key-${i}`, 1);
            canvas.setOpacity(`arrow-key-dec-${i}`, 1);
            canvas.setOpacity(`arrow-c-p-${i}`, 1);
        }
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

selectMode.addEventListener('change', () => {
    stopAnimation();
    const mode = selectMode.value;
    setupDiagramLayout(mode);
    showFullStaticDiagram();
});

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
    if (selectMode.value === 'encrypt') {
        syncCiphertextFromPlaintext();
    } else {
        syncPlaintextFromCiphertext();
    }
    showFullStaticDiagram();
});

txtIV.addEventListener('input', () => {
    stopAnimation();
    if (selectMode.value === 'encrypt') {
        syncCiphertextFromPlaintext();
    } else {
        syncPlaintextFromCiphertext();
    }
    showFullStaticDiagram();
});

// Initialization
canvas.setSpeed(animationSpeed);
setupDiagramLayout('encrypt');
showFullStaticDiagram();
