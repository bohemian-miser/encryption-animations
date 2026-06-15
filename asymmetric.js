import HEX_PATHS from './hex_paths.js';

// DOM Elements
const animSpace = document.querySelector('.animation-space');
const leftBox = document.getElementById('left-box');
const rightBox = document.getElementById('right-box');
const leftBoxContainer = document.getElementById('left-box-container');
const rightBoxContainer = document.getElementById('right-box-container');

const keyPublicSvg = document.querySelector('#key-public .key-svg');
const keyPrivateSvg = document.querySelector('#key-private .key-svg');

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
let currentTimeout = null;
let activePhase = null; // 'encrypt' or 'decrypt' or null

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

// Render text in SVG box
function renderTextInBox(text, boxSvgElement) {
    const boxPathGroup = boxSvgElement.querySelector('#box-path');
    boxSvgElement.innerHTML = '';
    if (boxPathGroup) {
        boxSvgElement.appendChild(boxPathGroup);
    }

    const N = text.length;
    const spacing = 65;
    const charWidth = 60;
    const totalWidth = (N - 1) * spacing + charWidth;
    const startX = (475.19 - totalWidth) / 2;
    const posY = 20;

    for (let i = 0; i < N; i++) {
        const char = text[i];
        if (char === ' ') continue;

        const paths = HEX_PATHS[char.toUpperCase()];
        if (!paths) continue;

        const x = startX + i * spacing;

        const charGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        charGroup.setAttribute('class', 'char-group');
        charGroup.setAttribute('transform', `translate(${x}, ${posY})`);
        charGroup.style.transition = 'opacity 0.5s ease-in-out';
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

// Get numeric value from input (clamped to max RSA plaintext)
function getPlainValue() {
    const cleanHex = txtPlaintext.value.replace(/\s+/g, '').padStart(4, '0');
    let val = parseInt(cleanHex, 16) || 0;
    
    // Clamp to max value supported by our n=64507 (0xFBF9)
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

// Animation Steps
function runEncryptionCycle(onComplete) {
    const plainVal = getPlainValue();
    // c = m^17 mod 64507
    const cipherVal = Number(powerMod(BigInt(plainVal), E_RSA, N_RSA));
    
    const t = (name) => BASE_TIMINGS[name] / animationSpeed;

    activePhase = 'encrypt';
    animSpace.className = 'animation-space asymmetric-layout';
    
    // Reset keys to idle
    keyPublicSvg.classList.remove('active-key');
    keyPrivateSvg.classList.remove('active-key');
    
    renderTextInBox(format_hex(plainVal), leftBox);
    leftBoxContainer.style.opacity = '1';
    
    renderTextInBox('', rightBox);
    rightBoxContainer.style.opacity = '0';
    clearMathPanel();

    currentTimeout = setTimeout(() => {
        // Step 2: Encrypt Start (Arrows appear to public key, public key wiggles)
        animSpace.classList.add('state-encrypt-start');
        keyPublicSvg.classList.add('active-key');
        
        currentTimeout = setTimeout(() => {
            // Step 3: Encrypt Active (Ciphertext appears, plaintext fades, arrows out)
            animSpace.classList.add('state-encrypt-active');
            renderTextInBox(format_hex(cipherVal), rightBox);
            rightBoxContainer.style.opacity = '1';
            leftBoxContainer.style.opacity = '0';
            updateMathPanelEncrypt(plainVal, cipherVal);

            currentTimeout = setTimeout(() => {
                // Step 4: Encrypt End (Arrows disappear, public key stops wiggling)
                animSpace.classList.remove('state-encrypt-start', 'state-encrypt-active');
                keyPublicSvg.classList.remove('active-key');

                currentTimeout = setTimeout(() => {
                    activePhase = null;
                    if (onComplete) onComplete();
                }, t('encryptEnd'));
            }, t('encryptActive'));
        }, t('encryptStart'));
    }, t('idle'));
}

function runDecryptionCycle(onComplete) {
    const plainVal = getPlainValue();
    const cipherVal = Number(powerMod(BigInt(plainVal), E_RSA, N_RSA));
    const t = (name) => BASE_TIMINGS[name] / animationSpeed;

    activePhase = 'decrypt';
    
    // Reset keys to idle
    keyPublicSvg.classList.remove('active-key');
    keyPrivateSvg.classList.remove('active-key');

    // Ensure right box has ciphertext, left box is hidden
    renderTextInBox(format_hex(cipherVal), rightBox);
    rightBoxContainer.style.opacity = '1';
    leftBoxContainer.style.opacity = '0';

    currentTimeout = setTimeout(() => {
        // Step 2: Decrypt Start (Right arrows to private key, private key wiggles)
        animSpace.classList.add('state-decrypt-start');
        keyPrivateSvg.classList.add('active-key');

        currentTimeout = setTimeout(() => {
            // Step 3: Decrypt Active (Plaintext appears, ciphertext fades)
            animSpace.classList.add('state-decrypt-active');
            renderTextInBox(format_hex(plainVal), leftBox);
            leftBoxContainer.style.opacity = '1';
            rightBoxContainer.style.opacity = '0';
            updateMathPanelDecrypt(cipherVal, plainVal);

            currentTimeout = setTimeout(() => {
                // Step 4: Decrypt End (Arrows disappear, private key stops)
                animSpace.classList.remove('state-decrypt-start', 'state-decrypt-active');
                keyPrivateSvg.classList.remove('active-key');

                currentTimeout = setTimeout(() => {
                    activePhase = null;
                    if (onComplete) onComplete();
                }, t('decryptEnd'));
            }, t('decryptActive'));
        }, t('decryptStart'));
    }, t('midIdle'));
}

function stopAnimation() {
    clearTimeout(currentTimeout);
    animSpace.className = 'animation-space asymmetric-layout';
    keyPublicSvg.classList.remove('active-key');
    keyPrivateSvg.classList.remove('active-key');
    leftBoxContainer.style.opacity = '1';
    rightBoxContainer.style.opacity = '1';
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
    
    // Update durations
    document.querySelectorAll('.key-svg').forEach(el => {
        el.style.transitionDuration = `${0.5 / animationSpeed}s`;
    });
    document.querySelectorAll('.box-container').forEach(el => {
        el.style.transitionDuration = `${0.5 / animationSpeed}s`;
    });
    document.querySelectorAll('.arrow-svg').forEach(el => {
        el.style.transitionDuration = `${0.3 / animationSpeed}s`;
    });
});

// Initialize
const defaultPlainVal = 0xAAAA; // Will be clamped to FBF9 in getPlainValue on run
renderTextInBox(format_hex(getPlainValue()), leftBox);
renderTextInBox('', rightBox);
leftBoxContainer.style.opacity = '1';
rightBoxContainer.style.opacity = '0';
clearMathPanel();
