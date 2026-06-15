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
let activeTimeout = null;
let loopActive = false;
let isAnimating = false;

// Layout Constants (800 x 480 viewBox)
const COLS = 4;
const COL_SPACING = 190;
const START_X = 115;

// Y levels for Encryption
const ENCRYPT_Y = {
    plain: 40,
    xor: 130,
    block: 230,
    cipher: 360,
    iv: 130
};

// Y levels for Decryption
const DECRYPT_Y = {
    cipher: 40,
    block: 140,
    xor: 260,
    plain: 360,
    iv: 260
};

// SVG Draw Helpers
function createSVGElement(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, v);
    }
    return el;
}

function drawWobblyBox(x, y, label, textVal, isInput, idPrefix) {
    const group = createSVGElement('g', { id: `${idPrefix}-group` });
    
    // Outlines (width ~119, height ~45)
    // Scaled & translated wobbly path template
    const useEl = createSVGElement('use', {
        href: '#wobbly-outline',
        class: `box-outline ${isInput ? 'input-block' : 'output-block'}`,
        transform: `translate(${x - 59.4}, ${y - 22.4}) scale(0.25, 0.4)`
    });
    group.appendChild(useEl);

    // Text Label (e.g. P1)
    const labelEl = createSVGElement('text', {
        class: 'block-label',
        x: x,
        y: y - 28
    });
    labelEl.textContent = label;
    group.appendChild(labelEl);

    // Value Text (e.g. AAAA)
    const valEl = createSVGElement('text', {
        class: 'block-val-text',
        x: x,
        y: y + 2,
        id: `${idPrefix}-val`
    });
    valEl.textContent = textVal;
    group.appendChild(valEl);

    return group;
}

function drawRectBox(x, y, label, idPrefix) {
    const group = createSVGElement('g', { id: `${idPrefix}-group` });
    
    const rect = createSVGElement('rect', {
        class: 'block-rect',
        x: x - 50,
        y: y - 25,
        width: 100,
        height: 50,
        rx: 5
    });
    group.appendChild(rect);

    const txt = createSVGElement('text', {
        class: 'block-rect-text',
        x: x,
        y: y
    });
    txt.textContent = label;
    group.appendChild(txt);

    return group;
}

function drawXORCircle(x, y, idPrefix) {
    const group = createSVGElement('g', { id: `${idPrefix}-group` });
    
    const circle = createSVGElement('circle', {
        class: 'xor-circle',
        cx: x,
        cy: y,
        r: 14
    });
    group.appendChild(circle);

    const txt = createSVGElement('text', {
        class: 'xor-text',
        x: x,
        y: y + 1
    });
    txt.textContent = '+';
    group.appendChild(txt);

    return group;
}

function drawArrow(d, id) {
    return createSVGElement('path', {
        id: id,
        class: 'arrow-path',
        d: d,
        'marker-end': 'url(#arrow)'
    });
}

// Clear visual state to standard base layout
function setupDiagramLayout(mode) {
    // Remove old dynamic elements
    const oldGroups = svg.querySelectorAll('g:not(#Layer_2), path, marker, defs');
    oldGroups.forEach(el => {
        if (el.tagName !== 'DEFS') el.remove();
    });

    const isEnc = mode === 'encrypt';
    const Y = isEnc ? ENCRYPT_Y : DECRYPT_Y;

    // 1. Draw IV Box (on the left)
    const ivVal = txtIV.value.toUpperCase().padStart(4, '0');
    const ivBox = drawWobblyBox(25, Y.iv, 'IV', ivVal, false, 'iv');
    svg.appendChild(ivBox);

    // 2. Draw Columns
    for (let i = 0; i < COLS; i++) {
        const colX = START_X + i * COL_SPACING;

        if (isEnc) {
            // ENCRYPTION LAYOUT:
            // Plaintext block (input, light green)
            const plainBox = drawWobblyBox(colX, Y.plain, `P${i+1}`, '', true, `plain-${i}`);
            svg.appendChild(plainBox);

            // XOR Gate
            const xorGate = drawXORCircle(colX, Y.xor, `xor-${i}`);
            svg.appendChild(xorGate);

            // Enc block rect
            const encBox = drawRectBox(colX, Y.block, 'AES Enc', `encrypt-${i}`);
            svg.appendChild(encBox);

            // Ciphertext block (output, light red)
            const cipherBox = drawWobblyBox(colX, Y.cipher, `C${i+1}`, '', false, `cipher-${i}`);
            svg.appendChild(cipherBox);

            // Arrows within column:
            // P_i -> XOR
            svg.appendChild(drawArrow(`M ${colX},${Y.plain + 23} L ${colX},${Y.xor - 15}`, `arrow-p-xor-${i}`));
            // XOR -> Enc
            svg.appendChild(drawArrow(`M ${colX},${Y.xor + 15} L ${colX},${Y.block - 26}`, `arrow-xor-enc-${i}`));
            // Enc -> C_i
            svg.appendChild(drawArrow(`M ${colX},${Y.block + 26} L ${colX},${Y.cipher - 24}`, `arrow-enc-c-${i}`));

            // Key arrow input to Enc box (from left)
            svg.appendChild(drawArrow(`M ${colX - 70},${Y.block} L ${colX - 51},${Y.block}`, `arrow-key-${i}`));
            const keyText = createSVGElement('text', {
                x: colX - 80,
                y: Y.block + 4,
                class: 'block-label'
            });
            keyText.textContent = 'Key';
            svg.appendChild(keyText);

        } else {
            // DECRYPTION LAYOUT:
            // Ciphertext block (input, light red)
            const cipherBox = drawWobblyBox(colX, Y.cipher, `C${i+1}`, '', false, `cipher-${i}`);
            svg.appendChild(cipherBox);

            // Dec block rect
            const decBox = drawRectBox(colX, Y.block, 'AES Dec', `decrypt-${i}`);
            svg.appendChild(decBox);

            // XOR Gate
            const xorGate = drawXORCircle(colX, Y.xor, `xor-${i}`);
            svg.appendChild(xorGate);

            // Plaintext block (output, light green)
            const plainBox = drawWobblyBox(colX, Y.plain, `P${i+1}`, '', true, `plain-${i}`);
            svg.appendChild(plainBox);

            // Arrows within column:
            // C_i -> Dec
            svg.appendChild(drawArrow(`M ${colX},${Y.cipher + 23} L ${colX},${Y.block - 26}`, `arrow-c-dec-${i}`));
            // Dec -> XOR
            svg.appendChild(drawArrow(`M ${colX},${Y.block + 26} L ${colX},${Y.xor - 15}`, `arrow-dec-xor-${i}`));
            // XOR -> P_i
            svg.appendChild(drawArrow(`M ${colX},${Y.xor + 15} L ${colX},${Y.plain - 24}`, `arrow-xor-p-${i}`));

            // Key arrow input to Dec box
            svg.appendChild(drawArrow(`M ${colX - 70},${Y.block} L ${colX - 51},${Y.block}`, `arrow-key-${i}`));
            const keyText = createSVGElement('text', {
                x: colX - 80,
                y: Y.block + 4,
                class: 'block-label'
            });
            keyText.textContent = 'Key';
            svg.appendChild(keyText);
        }
    }

    // 3. Draw Chaining Arrows
    for (let i = 0; i < COLS; i++) {
        const colX = START_X + i * COL_SPACING;

        if (isEnc) {
            // Encryption chaining
            if (i === 0) {
                // IV -> XOR 0
                svg.appendChild(drawArrow(`M 50,${Y.iv} L ${colX - 15},${Y.xor}`, `arrow-chain-${i}`));
            } else {
                // C_{i-1} -> XOR_i
                const prevColX = START_X + (i - 1) * COL_SPACING;
                const branchX = (prevColX + colX) / 2;
                // Path below Enc box: M prevColX, 290 -> branchX, 290 -> branchX, 130 -> colX-15, 130
                svg.appendChild(drawArrow(`M ${prevColX},290 L ${branchX},290 L ${branchX},${Y.xor} L ${colX - 15},${Y.xor}`, `arrow-chain-${i}`));
            }
        } else {
            // Decryption chaining
            if (i === 0) {
                // IV -> XOR 0
                svg.appendChild(drawArrow(`M 50,${Y.iv} L ${colX - 15},${Y.xor}`, `arrow-chain-${i}`));
            } else {
                // C_{i-1} -> XOR_i
                const prevColX = START_X + (i - 1) * COL_SPACING;
                const branchX = (prevColX + colX) / 2;
                // Path before Decrypt box: M prevColX, 90 -> branchX, 90 -> branchX, 260 -> colX-15, 260
                svg.appendChild(drawArrow(`M ${prevColX},90 L ${branchX},90 L ${branchX},${Y.xor} L ${colX - 15},${Y.xor}`, `arrow-chain-${i}`));
            }
        }
    }
}

// Calculate the full CBC encryption/decryption chaining values
function runCBCCalculations(mode) {
    const plainInput = txtPlaintext.value.replace(/\s+/g, '').toUpperCase();
    const keyVal = parseInt(txtKey.value, 16) || 0;
    const ivVal = parseInt(txtIV.value, 16) || 0;

    // Split input into 4 blocks of 4 hex chars, padding with 0s
    const blocks = [];
    for (let i = 0; i < COLS; i++) {
        const part = plainInput.substr(i * 4, 4).padEnd(4, '0');
        blocks.push(parseInt(part, 16) || 0);
    }

    const calculations = [];
    let prevBlock = ivVal;

    if (mode === 'encrypt') {
        const cipherBlocks = [];
        for (let i = 0; i < COLS; i++) {
            const p = blocks[i];
            const xorIn = p ^ prevBlock;
            const c = toyEncrypt(xorIn, keyVal);
            cipherBlocks.push(c);
            
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
        // Decrypt expects input to be the ciphertext!
        // So blocks represents the Ciphertext block inputs C_1, C_2...
        const plainBlocks = [];
        for (let i = 0; i < COLS; i++) {
            const c = blocks[i];
            const decOut = toyDecrypt(c, keyVal);
            const p = decOut ^ prevBlock;
            plainBlocks.push(p);

            calculations.push({
                blockIdx: i,
                cipher: c,
                decResult: decOut,
                prev: prevBlock,
                plain: p
            });
            prevBlock = c; // Decrypt chaining uses ciphertext block input as chain
        }
        return calculations;
    }
}

// Set up active states to visually guide the user
function setElementActive(id, isActive) {
    const el = document.getElementById(id);
    if (!el) return;
    if (isActive) {
        el.classList.add('active');
        if (el.tagName === 'path') {
            el.setAttribute('marker-end', 'url(#arrow-active)');
        }
    } else {
        el.classList.remove('active');
        if (el.tagName === 'path') {
            el.setAttribute('marker-end', 'url(#arrow)');
        }
    }
}

// Reset all styles
function resetDiagramHighlights() {
    svg.querySelectorAll('.active').forEach(el => {
        el.classList.remove('active');
        if (el.tagName === 'path') {
            el.setAttribute('marker-end', 'url(#arrow)');
        }
    });
}

// Visual Step-by-Step Animation loop
async function playCBCAnimation() {
    isAnimating = true;
    const mode = selectMode.value;
    const calcs = runCBCCalculations(mode);
    const isEnc = mode === 'encrypt';

    setupDiagramLayout(mode);
    listMathSteps.innerHTML = '';

    const stepDelay = 800 / animationSpeed;

    // Helper sleep
    const sleep = (ms) => new Promise(res => {
        activeTimeout = setTimeout(res, ms);
    });

    // Animate block-by-block
    for (let i = 0; i < COLS; i++) {
        const c = calcs[i];
        const colPrefix = isEnc ? 'encrypt' : 'decrypt';

        // 1. Highlight input block
        if (isEnc) {
            document.getElementById(`plain-${i}-val`).textContent = formatHex16(c.plain);
            setElementActive(`plain-${i}-group`, true);
            setElementActive(`arrow-p-xor-${i}`, true);
        } else {
            document.getElementById(`cipher-${i}-val`).textContent = formatHex16(c.cipher);
            setElementActive(`cipher-${i}-group`, true);
            setElementActive(`arrow-c-dec-${i}`, true);
        }
        await sleep(stepDelay);

        // 2. Highlight chaining path
        setElementActive(`arrow-chain-${i}`, true);
        setElementActive('iv-group', i === 0);
        if (i > 0) {
            // Highlight previous ciphertext block
            if (isEnc) {
                setElementActive(`cipher-${i-1}-group`, true);
            } else {
                setElementActive(`cipher-${i-1}-group`, true);
            }
        }
        await sleep(stepDelay);

        // 3. Highlight XOR / Decrypt Box
        if (isEnc) {
            setElementActive(`xor-${i}-group`, true);
            setElementActive(`arrow-xor-enc-${i}`, true);
        } else {
            setElementActive(`${colPrefix}-${i}-group`, true);
            setElementActive(`arrow-dec-xor-${i}`, true);
        }
        await sleep(stepDelay);

        // 4. Highlight Encrypt Box / XOR gate
        setElementActive(`arrow-key-${i}`, true);
        if (isEnc) {
            setElementActive(`${colPrefix}-${i}-group`, true);
            setElementActive(`arrow-enc-c-${i}`, true);
        } else {
            setElementActive(`xor-${i}-group`, true);
            setElementActive(`arrow-xor-p-${i}`, true);
        }
        await sleep(stepDelay);

        // 5. Show and highlight output block
        if (isEnc) {
            document.getElementById(`cipher-${i}-val`).textContent = formatHex16(c.cipher);
            setElementActive(`cipher-${i}-group`, true);
        } else {
            document.getElementById(`plain-${i}-val`).textContent = formatHex16(c.plain);
            setElementActive(`plain-${i}-group`, true);
        }

        // Add math step description
        const li = document.createElement('li');
        if (isEnc) {
            li.innerHTML = `<strong>Block ${i+1}:</strong> Input <code>${formatHex16(c.plain)}</code> &oplus; Chain <code>${formatHex16(c.prev)}</code> = <code>${formatHex16(c.xorResult)}</code> &rarr; Encrypt = <code>${formatHex16(c.cipher)}</code>`;
        } else {
            li.innerHTML = `<strong>Block ${i+1}:</strong> Decrypt(<code>${formatHex16(c.cipher)}</code>) = <code>${formatHex16(c.decResult)}</code> &oplus; Chain <code>${formatHex16(c.prev)}</code> = <code>${formatHex16(c.plain)}</code>`;
        }
        listMathSteps.appendChild(li);

        await sleep(stepDelay * 1.5);

        // Turn off internal column paths, keep blocks highlighted
        resetDiagramHighlights();
        
        // Highlight active output blocks
        for (let b = 0; b <= i; b++) {
            if (isEnc) {
                setElementActive(`plain-${b}-group`, true);
                setElementActive(`cipher-${b}-group`, true);
            } else {
                setElementActive(`cipher-${b}-group`, true);
                setElementActive(`plain-${b}-group`, true);
            }
        }
    }

    isAnimating = false;
    if (loopActive) {
        activeTimeout = setTimeout(runAutoLoop, 2000 / animationSpeed);
    }
}

function stopAnimation() {
    clearTimeout(activeTimeout);
    isAnimating = false;
    resetDiagramHighlights();
    loopActive = false;
    btnLoop.textContent = 'Auto Loop';
    btnPause.style.display = 'none';
}

function runAutoLoop() {
    if (isAnimating) return;
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
});

selectMode.addEventListener('change', () => {
    stopAnimation();
    setupDiagramLayout(selectMode.value);
});

// Initialization
setupDiagramLayout('encrypt');
