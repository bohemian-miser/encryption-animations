import HEX_PATHS from './hex_paths.js';

// DOM Elements
const animSpace = document.querySelector('.animation-space');
const leftBox = document.getElementById('left-box');
const rightBox = document.getElementById('right-box');
const keyContainer = document.getElementById('key-anim-container');
const leftBoxContainer = document.getElementById('left-box-container');
const rightBoxContainer = document.getElementById('right-box-container');

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
let isLooping = false;
let currentTimeout = null;
let activePhase = null; // 'encrypt' or 'decrypt' or null
let currentStepIndex = 0;
let loopActive = false;

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

// Render text in SVG box using group translation
function renderTextInBox(text, boxSvgElement) {
    // Keep only the box outline path
    const boxPathGroup = boxSvgElement.querySelector('#box-path');
    boxSvgElement.innerHTML = '';
    if (boxPathGroup) {
        boxSvgElement.appendChild(boxPathGroup);
    }

    const N = text.length;
    const spacing = 65;
    const charWidth = 60; // Estimated width
    const totalWidth = (N - 1) * spacing + charWidth;
    const startX = (475.19 - totalWidth) / 2;
    const posY = 20; // Vertical offset to center Y [-10, 80] in [0, 112]

    for (let i = 0; i < N; i++) {
        const char = text[i];
        if (char === ' ') continue;

        const paths = HEX_PATHS[char.toUpperCase()];
        if (!paths) continue;

        const x = startX + i * spacing;

        // Create group for character
        const charGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        charGroup.setAttribute('class', 'char-group');
        charGroup.setAttribute('transform', `translate(${x}, ${posY})`);
        charGroup.style.transition = 'opacity 0.5s ease-in-out';
        charGroup.style.opacity = '1'; // Default visible

        paths.forEach(d => {
            const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathEl.setAttribute('d', d);
            pathEl.setAttribute('fill', '#000');
            charGroup.appendChild(pathEl);
        });

        boxSvgElement.appendChild(charGroup);
    }
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
            keyVal, // Direct key
            cipherVal,
            cipherHex: bytesToHex(cipherBytes)
        };
    } else {
        // Hash key to 256-bit (32 bytes)
        const keyHash = await crypto.subtle.digest('SHA-256', keyBytes);
        
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyHash,
            { name: 'AES-CTR' },
            false,
            ['encrypt', 'decrypt']
        );
        
        const counter = new Uint8Array(16); // All-zero counter block
        
        // Encrypt plaintext to get ciphertext
        const cipherBuffer = await crypto.subtle.encrypt(
            { name: 'AES-CTR', counter, length: 64 },
            cryptoKey,
            plainBytes
        );
        const cipherBytes = new Uint8Array(cipherBuffer);
        
        // Encrypt all-zeros to get Keystream (for display)
        const zeroBytes = new Uint8Array(plainBytes.length);
        const keystreamBuffer = await crypto.subtle.encrypt(
            { name: 'AES-CTR', counter, length: 64 },
            cryptoKey,
            zeroBytes
        );
        const keystreamBytes = new Uint8Array(keystreamBuffer);
        
        const plainVal = bytesToVal(plainBytes);
        const keyVal = bytesToVal(keystreamBytes); // Use keystream as "key" visually
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

// Clear Math Panel
function clearMathPanel() {
    mathInputBin.textContent = '00000000 00000000';
    mathInputHex.textContent = '(00 00)';
    mathKeyBin.textContent = '00000000 00000000';
    mathKeyHex.textContent = '(00 00)';
    mathOutputBin.textContent = '00000000 00000000';
    mathOutputHex.textContent = '(00 00)';
}

// Animation Steps
async function runEncryptionCycle(onComplete) {
    const { plainVal, keyVal, cipherVal } = await getCryptoValues();
    const t = (name) => BASE_TIMINGS[name] / animationSpeed;

    // Step 1: Idle state
    activePhase = 'encrypt';
    animSpace.className = 'animation-space';
    keyContainer.className = 'key-container neutral';
    renderTextInBox(format_hex(plainVal), leftBox);
    leftBoxContainer.style.opacity = '1';
    
    // Hide right box at start
    renderTextInBox('', rightBox);
    rightBoxContainer.style.opacity = '0';
    clearMathPanel();

    currentTimeout = setTimeout(() => {
        // Step 2: Encrypt Start (Arrows appear, key starts rotating)
        animSpace.classList.add('state-encrypt-start');
        keyContainer.className = 'key-container encrypting';
        
        currentTimeout = setTimeout(() => {
            // Step 3: Encrypt Active (Ciphertext appears, plaintext fades)
            animSpace.classList.add('state-encrypt-active');
            renderTextInBox(format_hex(cipherVal), rightBox);
            rightBoxContainer.style.opacity = '1';
            leftBoxContainer.style.opacity = '0';
            updateMathPanel(plainVal, keyVal, cipherVal, 'Plain', 'Cipher');

            currentTimeout = setTimeout(() => {
                // Step 4: Encrypt End (Arrows disappear, key resets)
                animSpace.classList.remove('state-encrypt-start', 'state-encrypt-active');
                keyContainer.className = 'key-container neutral';

                currentTimeout = setTimeout(() => {
                    activePhase = null;
                    if (onComplete) onComplete();
                }, t('encryptEnd'));
            }, t('encryptActive'));
        }, t('encryptStart'));
    }, t('idle'));
}

async function runDecryptionCycle(onComplete) {
    const { plainVal, keyVal, cipherVal } = await getCryptoValues();
    const t = (name) => BASE_TIMINGS[name] / animationSpeed;

    activePhase = 'decrypt';
    // Ensure right box has ciphertext, left box is hidden
    renderTextInBox(format_hex(cipherVal), rightBox);
    rightBoxContainer.style.opacity = '1';
    leftBoxContainer.style.opacity = '0';

    currentTimeout = setTimeout(() => {
        // Step 2: Decrypt Start (Right arrows appear, key rotates left)
        animSpace.classList.add('state-decrypt-start');
        keyContainer.className = 'key-container decrypting';

        currentTimeout = setTimeout(() => {
            // Step 3: Decrypt Active (Plaintext appears, ciphertext fades)
            animSpace.classList.add('state-decrypt-active');
            renderTextInBox(format_hex(plainVal), leftBox);
            leftBoxContainer.style.opacity = '1';
            rightBoxContainer.style.opacity = '0';
            updateMathPanel(cipherVal, keyVal, plainVal, 'Cipher', 'Plain');

            currentTimeout = setTimeout(() => {
                // Step 4: Decrypt End (Arrows disappear, key resets)
                animSpace.classList.remove('state-decrypt-start', 'state-decrypt-active');
                keyContainer.className = 'key-container neutral';

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
    animSpace.className = 'animation-space';
    keyContainer.className = 'key-container neutral';
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

// Update initial visuals and math panel
async function updateInitialVisuals() {
    const { plainVal, keyVal, cipherVal } = await getCryptoValues();
    renderTextInBox(format_hex(plainVal), leftBox);
    renderTextInBox('', rightBox);
    leftBoxContainer.style.opacity = '1';
    rightBoxContainer.style.opacity = '0';
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

rangeSpeed.addEventListener('input', (e) => {
    animationSpeed = parseFloat(e.target.value);
    valSpeed.textContent = animationSpeed.toFixed(1) + 'x';
    document.querySelector('.key-svg').style.transitionDuration = `${0.5 / animationSpeed}s`;
    document.querySelector('.key-svg .bg-circle').style.transitionDuration = `${0.5 / animationSpeed}s`;
    document.querySelectorAll('.box-container').forEach(el => {
        el.style.transitionDuration = `${0.5 / animationSpeed}s`;
    });
    document.querySelectorAll('.arrow-svg').forEach(el => {
        el.style.transitionDuration = `${0.3 / animationSpeed}s`;
    });
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
updateInitialVisuals();
