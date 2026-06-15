import HEX_PATHS from './hex_paths.js';

// DOM Elements
const animSpace = document.querySelector('.animation-space');
const leftBox = document.getElementById('left-box');
const rightBox = document.getElementById('right-box');
const keyContainer = document.getElementById('key-anim-container');

const mathInputBin = document.getElementById('math-input-bin');
const mathInputHex = document.getElementById('math-input-hex');
const mathKeyBin = document.getElementById('math-key-bin');
const mathKeyHex = document.getElementById('math-key-hex');
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

// Set text opacity in box for fade effects
function setBoxTextOpacity(boxSvgElement, opacity) {
    const charGroups = boxSvgElement.querySelectorAll('.char-group');
    charGroups.forEach(g => {
        g.style.opacity = opacity;
    });
}

// Calculate XOR values
function getXorValues() {
    const plainHex = txtPlaintext.value.padStart(4, '0');
    const keyHex = txtKey.value.padStart(4, '0');
    
    const plainVal = parseInt(plainHex, 16) || 0;
    const keyVal = parseInt(keyHex, 16) || 0;
    const cipherVal = plainVal ^ keyVal;

    return {
        plainHex,
        keyHex,
        plainVal,
        keyVal,
        cipherVal,
        cipherHex: cipherVal.toString(16).toUpperCase().padStart(4, '0')
    };
}

// Update Math Panel
function updateMathPanel(inputVal, keyVal, outputVal, inputLabel = 'Input', outputLabel = 'Output') {
    mathInputBin.textContent = format_bin(inputVal);
    mathInputHex.textContent = `(${format_hex(inputVal)})`;
    
    mathKeyBin.textContent = format_bin(keyVal);
    mathKeyHex.textContent = `(${format_hex(keyVal)})`;
    
    mathOutputBin.textContent = format_bin(outputVal);
    mathOutputHex.textContent = `(${format_hex(outputVal)})`;
    
    document.querySelector('#math-panel h3').textContent = `XOR Step-by-Step (${inputLabel} XOR Key = ${outputLabel})`;
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
function runEncryptionCycle(onComplete) {
    const { plainHex, keyHex, plainVal, keyVal, cipherVal, cipherHex } = getXorValues();
    const t = (name) => BASE_TIMINGS[name] / animationSpeed;

    // Step 1: Idle state
    activePhase = 'encrypt';
    animSpace.className = 'animation-space';
    keyContainer.className = 'key-container neutral';
    renderTextInBox(format_hex(plainVal), leftBox);
    setBoxTextOpacity(leftBox, 1);
    // Clear right box
    renderTextInBox('', rightBox);
    clearMathPanel();

    currentTimeout = setTimeout(() => {
        // Step 2: Encrypt Start (Arrows appear, key starts rotating)
        animSpace.classList.add('state-encrypt-start');
        keyContainer.className = 'key-container encrypting';
        
        currentTimeout = setTimeout(() => {
            // Step 3: Encrypt Active (Ciphertext appears, plaintext fades)
            animSpace.classList.add('state-encrypt-active');
            renderTextInBox(format_hex(cipherVal), rightBox);
            setBoxTextOpacity(rightBox, 1);
            setBoxTextOpacity(leftBox, 0);
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

function runDecryptionCycle(onComplete) {
    const { plainHex, keyHex, plainVal, keyVal, cipherVal, cipherHex } = getXorValues();
    const t = (name) => BASE_TIMINGS[name] / animationSpeed;

    activePhase = 'decrypt';
    // Ensure right box has ciphertext, left box is empty (or faded)
    renderTextInBox(format_hex(cipherVal), rightBox);
    setBoxTextOpacity(rightBox, 1);
    setBoxTextOpacity(leftBox, 0);

    currentTimeout = setTimeout(() => {
        // Step 2: Decrypt Start (Right arrows appear, key rotates left)
        animSpace.classList.add('state-decrypt-start');
        keyContainer.className = 'key-container decrypting';

        currentTimeout = setTimeout(() => {
            // Step 3: Decrypt Active (Plaintext appears, ciphertext fades)
            animSpace.classList.add('state-decrypt-active');
            renderTextInBox(format_hex(plainVal), leftBox);
            setBoxTextOpacity(leftBox, 1);
            setBoxTextOpacity(rightBox, 0);
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
    }, t('midIdle')); // Use midIdle as the delay before decryption starts
}

function stopAnimation() {
    clearTimeout(currentTimeout);
    animSpace.className = 'animation-space';
    keyContainer.className = 'key-container neutral';
    setBoxTextOpacity(leftBox, 1);
    setBoxTextOpacity(rightBox, 1);
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
    // Update CSS transition durations dynamically if needed,
    // but the JS timeouts will automatically scale on next step.
    document.querySelector('.key-svg').style.transitionDuration = `${0.5 / animationSpeed}s`;
    document.querySelector('.key-svg .bg-circle').style.transitionDuration = `${0.5 / animationSpeed}s`;
    document.querySelectorAll('.arrow-svg').forEach(el => {
        el.style.transitionDuration = `${0.3 / animationSpeed}s`;
    });
});

// Initialize
const { plainVal } = getXorValues();
renderTextInBox(format_hex(plainVal), leftBox);
renderTextInBox('', rightBox);
clearMathPanel();
