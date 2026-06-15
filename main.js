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

// Helper to format Uint8Array to binary string with spaces
function format_bin(bytes) {
    return Array.from(bytes, byte => byte.toString(2).padStart(8, '0')).join(' ');
}

// Helper to format Uint8Array to hex string with spaces
function format_hex(bytes) {
    return Array.from(bytes, byte => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

// Render text in SVG box using group translation
function renderTextInBox(text, boxSvgElement) {
    const boxPathGroup = boxSvgElement.querySelector('#box-path');
    boxSvgElement.innerHTML = '';
    if (boxPathGroup) {
        boxSvgElement.appendChild(boxPathGroup);
    }

    const cleanText = text.replace(/\s+/g, '');
    const N = cleanText.length;

    if (N > 8) {
        // Render as 4x4 grid of bytes (AES mode, 32 hex characters = 16 bytes)
        const numBytes = Math.min(Math.floor(N / 2), 16);
        const colSpacing = 85;
        const rowSpacing = 24;
        const charScale = 0.24;
        const byteCharSpacing = 16;
        
        const gridWidth = 3 * colSpacing + (byteCharSpacing + 60 * charScale); 
        const gridHeight = 3 * rowSpacing + (80 * charScale); 
        const startX = (475.19 - gridWidth) / 2;
        const startY = (112.03 - gridHeight) / 2;

        for (let b = 0; b < numBytes; b++) {
            const byteStr = cleanText.slice(b * 2, b * 2 + 2);
            const col = b % 4;
            const row = Math.floor(b / 4);

            const bx = startX + col * colSpacing;
            const by = startY + row * rowSpacing;

            for (let c = 0; c < 2; c++) {
                const char = byteStr[c];
                const paths = HEX_PATHS[char.toUpperCase()];
                if (!paths) continue;

                const cx = bx + c * byteCharSpacing;

                const charGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                charGroup.setAttribute('class', 'char-group');
                charGroup.setAttribute('transform', `translate(${cx}, ${by}) scale(${charScale})`);
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
    } else {
        // Render in a single row (XOR mode, 4 hex characters = 2 bytes)
        const spacing = 65;
        const charWidth = 60;
        const totalWidth = (N - 1) * spacing + charWidth;
        const startX = (475.19 - totalWidth) / 2;
        const posY = 20;

        for (let i = 0; i < N; i++) {
            const char = cleanText[i];
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

// Calculate Crypto values (XOR or AES ECB simulated)
async function getCryptoValues() {
    const plainHex = txtPlaintext.value.replace(/\s+/g, '');
    const keyHex = txtKey.value.replace(/\s+/g, '');
    
    const algo = selectAlgo.value;
    
    if (algo === 'xor') {
        // 16-bit XOR (2 bytes)
        const plainBytes = hexToBytes(plainHex.padStart(4, '0').slice(0, 4));
        const keyBytes = hexToBytes(keyHex.padStart(4, '0').slice(0, 4));
        
        const cipherBytes = new Uint8Array([
            plainBytes[0] ^ keyBytes[0],
            plainBytes[1] ^ keyBytes[1]
        ]);
        
        return {
            plainBytes,
            keyBytes,
            cipherBytes,
            cipherHex: bytesToHex(cipherBytes)
        };
    } else {
        // 128-bit AES ECB simulation via AES-CBC with zero IV (16 bytes)
        const plainBytes = hexToBytes(plainHex.padStart(32, '0').slice(0, 32));
        const keyBytes = hexToBytes(keyHex.padStart(32, '0').slice(0, 32));
        
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyBytes,
            { name: 'AES-CBC' },
            false,
            ['encrypt', 'decrypt']
        );
        
        const iv = new Uint8Array(16); // Zero IV
        
        const cipherBuffer = await crypto.subtle.encrypt(
            { name: 'AES-CBC', iv },
            cryptoKey,
            plainBytes
        );
        const cipherBytes = new Uint8Array(cipherBuffer).slice(0, 16);
        
        return {
            plainBytes,
            keyBytes,
            cipherBytes,
            cipherHex: bytesToHex(cipherBytes)
        };
    }
}

function updateMathPanel(inputBytes, keyBytes, outputBytes, inputLabel = 'Input', outputLabel = 'Output') {
    mathInputBin.textContent = format_bin(inputBytes);
    mathInputHex.textContent = `(${format_hex(inputBytes)})`;
    
    mathKeyBin.textContent = format_bin(keyBytes);
    mathKeyHex.textContent = `(${format_hex(keyBytes)})`;
    
    mathOutputBin.textContent = format_bin(outputBytes);
    mathOutputHex.textContent = `(${format_hex(outputBytes)})`;
    
    const algo = selectAlgo.value;
    if (algo === 'aes') {
        mathKeyLabel.textContent = 'Key (AES Block):';
        document.querySelector('#math-panel h3').textContent = `Symmetric Encryption Process (AES-128 Block Cipher)`;
    } else {
        mathKeyLabel.textContent = 'Key:';
        document.querySelector('#math-panel h3').textContent = `Symmetric Encryption Process (${inputLabel} XOR Key = ${outputLabel})`;
    }
}

// Clear Math Panel
function clearMathPanel() {
    const algo = selectAlgo.value;
    const len = algo === 'aes' ? 16 : 2;
    const zeros = new Uint8Array(len);
    
    mathInputBin.textContent = format_bin(zeros);
    mathInputHex.textContent = `(${format_hex(zeros)})`;
    mathKeyBin.textContent = format_bin(zeros);
    mathKeyHex.textContent = `(${format_hex(zeros)})`;
    mathOutputBin.textContent = format_bin(zeros);
    mathOutputHex.textContent = `(${format_hex(zeros)})`;
}

// Animation Steps
async function runEncryptionCycle(onComplete) {
    const { plainBytes, keyBytes, cipherBytes } = await getCryptoValues();
    const t = (name) => BASE_TIMINGS[name] / animationSpeed;

    // Step 1: Idle state
    activePhase = 'encrypt';
    animSpace.className = 'animation-space';
    keyContainer.className = 'key-container neutral';
    renderTextInBox(format_hex(plainBytes), leftBox);
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
            renderTextInBox(format_hex(cipherBytes), rightBox);
            rightBoxContainer.style.opacity = '1';
            leftBoxContainer.style.opacity = '0';
            updateMathPanel(plainBytes, keyBytes, cipherBytes, 'Plain', 'Cipher');

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
    const { plainBytes, keyBytes, cipherBytes } = await getCryptoValues();
    const t = (name) => BASE_TIMINGS[name] / animationSpeed;

    activePhase = 'decrypt';
    // Ensure right box has ciphertext, left box is hidden
    renderTextInBox(format_hex(cipherBytes), rightBox);
    rightBoxContainer.style.opacity = '1';
    leftBoxContainer.style.opacity = '0';

    currentTimeout = setTimeout(() => {
        // Step 2: Decrypt Start (Right arrows appear, key rotates left)
        animSpace.classList.add('state-decrypt-start');
        keyContainer.className = 'key-container decrypting';

        currentTimeout = setTimeout(() => {
            // Step 3: Decrypt Active (Plaintext appears, ciphertext fades)
            animSpace.classList.add('state-decrypt-active');
            renderTextInBox(format_hex(plainBytes), leftBox);
            leftBoxContainer.style.opacity = '1';
            rightBoxContainer.style.opacity = '0';
            updateMathPanel(cipherBytes, keyBytes, plainBytes, 'Cipher', 'Plain');

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

async function updateInitialVisuals() {
    const { plainBytes, keyBytes, cipherBytes } = await getCryptoValues();
    renderTextInBox(format_hex(plainBytes), leftBox);
    renderTextInBox('', rightBox);
    leftBoxContainer.style.opacity = '1';
    rightBoxContainer.style.opacity = '0';
    updateMathPanel(plainBytes, keyBytes, cipherBytes, 'Plain', 'Cipher');
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
    
    if (algo === 'aes') {
        txtPlaintext.maxLength = 47;
        txtKey.maxLength = 47;
        txtPlaintext.value = '00 11 22 33 44 55 66 77 88 99 AA BB CC DD EE FF';
        txtKey.value = '00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F';
        document.querySelector('label[for="plaintext-input"]').textContent = 'Plaintext (Hex, 16 bytes):';
        document.querySelector('label[for="key-input"]').textContent = 'Key (Hex, 16 bytes):';
    } else {
        txtPlaintext.maxLength = 4;
        txtKey.maxLength = 4;
        txtPlaintext.value = 'AAAA';
        txtKey.value = '6A95';
        document.querySelector('label[for="plaintext-input"]').textContent = 'Plaintext (Hex, 4 chars):';
        document.querySelector('label[for="key-input"]').textContent = 'Key (Hex, 4 chars):';
    }
    
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
const initialAlgo = selectAlgo.value;
if (initialAlgo === 'aes') {
    txtPlaintext.maxLength = 47;
    txtKey.maxLength = 47;
    txtPlaintext.value = '00 11 22 33 44 55 66 77 88 99 AA BB CC DD EE FF';
    txtKey.value = '00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F';
    document.querySelector('label[for="plaintext-input"]').textContent = 'Plaintext (Hex, 16 bytes):';
    document.querySelector('label[for="key-input"]').textContent = 'Key (Hex, 16 bytes):';
} else {
    txtPlaintext.maxLength = 4;
    txtKey.maxLength = 4;
    txtPlaintext.value = 'AAAA';
    txtKey.value = '6A95';
}
explanationPanel.style.display = initialAlgo === 'aes' ? 'block' : 'none';
updateInitialVisuals();
