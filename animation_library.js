import HEX_PATHS from './hex_paths.js';

// Helper to create SVG elements
function createSVG(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, v);
    }
    return el;
}

// Reusable SVG Defs and Templates
const DEFS_TEMPLATE = `
  <!-- Bounding box of original outline is roughly 0,0 to 475.19, 112.03. Center is ~237.6, 56.0 -->
  <path id="wobbly-box-path" d="M473.64,103.31q-6-23.85-9.92-48.07-2.07-13-3.49-26.07c-.56-5.15.43-13.23-3.1-17.66s-13.55-3.73-18.82-4.16c-8.93-.72-17.87-1.21-26.83-1.55-18.3-.7-36.63-.82-54.95-1Q245.78,3.73,135,4.54,76,5,17,5.93c.1-.68.19-1.36.3-2,.36-2.39-3.67-3.43-4-1-.16,1-.3,2.08-.46,3.12L9.62,6a1.9,1.9,0,1,0,0,3.8l2.59,0Q9,32.11,6.38,54.49q-1.48,13-2.73,26.09-.58,6.06-1.1,12.13c-.36,4.11-1.41,8.73-.93,12.82.79,6.65,9.73,4.78,14.92,4.7l29.12-.44,58.24-.88,235-3.56c44.23-.66,88.49-1.2,132.7.37A2,2,0,0,0,473.64,103.31Zm-226.22-.38-224.63,3.4c-4.14.06-13.09,1.73-15.77-1.1S6.57,94.62,6.9,90.84q1.23-14,2.74-28Q12.5,36.26,16.4,9.74,119.59,8.06,222.79,8q53.29,0,106.59.38c35.6.27,71.39-.11,106.88,2.62,4.89.38,12.55-.1,16.34,2.71,3.6,2.67,2.74,8.67,3.16,12.71q1.31,12.66,3.22,25.26,3.81,25.26,10,50.15C395.21,99.34,321.21,101.82,247.42,102.93Z" transform="translate(-237.595, -56.015)" />

  <!-- Arrow markers -->
  <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="#151513" />
  </marker>
  <marker id="arrow-active" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="#007bff" />
  </marker>

  <!-- Gradients for active/inactive key circles -->
  <radialGradient id="encrypt-gradient" cx="118.95" cy="118.62" r="113.29" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fff"/>
    <stop offset="1" stop-color="#c7001a"/>
  </radialGradient>
  <radialGradient id="decrypt-gradient" cx="118.95" cy="118.62" r="113.28" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fff"/>
    <stop offset="1" stop-color="#03d400"/>
  </radialGradient>

  <!-- Pre-drawn Wobbly Arrow Horizontal (pointing right, start coordinate at 0, 0) -->
  <g id="tmpl-wobbly-arrow-horizontal">
     <g transform="translate(-5.77, -37.1)">
        <path class="arrow-bg-line" d="M5.77,43.1a1021.29,1021.29,0,0,1,119.12-1.56c7.72.35,7.7-11.65,0-12A1021.29,1021.29,0,0,0,5.77,31.1c-7.66.55-7.72,12.55,0,12Z" fill="currentColor" />
        <path class="arrow-head-line" d="M90,11.09A217.37,217.37,0,0,0,145,30.8l-2.65-10a273.17,273.17,0,0,0-31.94,51.35c-3.29,6.94,7,13,10.36,6.06a260.18,260.18,0,0,1,30.06-48.92c2.55-3.25,2.23-9-2.65-10A205.46,205.46,0,0,1,96.1.73C89.25-2.82,83.18,7.54,90,11.09Z" fill="currentColor" />
     </g>
  </g>

  <!-- Hardware Key Circle (centered at 0, 0, radius ~114) -->
  <g id="tmpl-key-hardware">
     <g transform="translate(-113.62, -114)">
        <!-- bg-circle is the first path, which can be colored via CSS -->
        <path class="bg-circle" d="M113.62.5C176.1.5,226.74,51.3,226.74,114S176.1,227.4,113.62,227.4.5,176.61.5,114,51.15.5,113.62.5Zm51.66,155.79a50.08,50.08,0,0,0-31-46.35V33.31a11.54,11.54,0,0,0-11.53-11.54h-16A11.54,11.54,0,0,0,95.2,33.31v77.16h0a50,50,0,1,0,70.08,45.81Z" />
        <path d="M134.29,109.94a49.92,49.92,0,1,1-39.09.54v35.24a11.56,11.56,0,0,0,5.32,9.73,14.65,14.65,0,0,0-.22,2.58,15.29,15.29,0,1,0,30.58,0,15.49,15.49,0,0,0-.45-3.7,11.5,11.5,0,0,0,3.86-8.61Z" fill="#e6e7e8" />
        <path d="M134.29,109.94v35.78a11.5,11.5,0,0,1-3.86,8.61,15.29,15.29,0,0,0-29.91,1.12,11.56,11.56,0,0,1-5.32-9.73V110.48h0a49.87,49.87,0,0,1,39.09-.53Z" fill="#e6e7e8" />
        <path d="M134.29,33.31v76.63a49.87,49.87,0,0,0-39.09.53V33.31a11.54,11.54,0,0,1,11.53-11.54h16A11.54,11.54,0,0,1,134.29,33.31Zm-1.45,62.34V85.23l-9,5.21Zm-.69-24.54V60.69l-9,5.21ZM131,48.28V37.85l-9,5.21Z" fill="#e6e7e8" />
        <polygon points="132.84 85.23 132.84 95.65 123.81 90.44 132.84 85.23" fill="#e6e7e8" />
        <polygon points="132.15 60.69 132.15 71.11 123.12 65.9 132.15 60.69" fill="#e6e7e8" />
        <polygon points="130.96 37.85 130.96 48.28 121.93 43.06 130.96 37.85" fill="#e6e7e8" />
        <path d="M130.43,154.33a15.49,15.49,0,0,1,.45,3.7,15.29,15.29,0,1,1-30.58,0,14.65,14.65,0,0,1,.22-2.58,11.55,11.55,0,0,0,6.21,1.81h16A11.45,11.45,0,0,0,130.43,154.33Z" fill="#535454" />
        <path d="M115.59,142.74a15.32,15.32,0,0,1,14.84,11.59,11.45,11.45,0,0,1-7.67,2.93h-16a11.55,11.55,0,0,1-6.21-1.81A15.29,15.29,0,0,1,115.59,142.74Z" fill="#535454" />
        <path d="M.5,114C.5,51.3,51.15.5,113.62.5S226.74,51.3,226.74,114,176.1,227.4,113.62,227.4.5,176.61.5,114Z" fill="none" stroke="#231f20" stroke-linecap="round" stroke-miterlimit="10" stroke-width="11" />
        <path d="M134.29,109.94a49.92,49.92,0,1,1-39.09.54" fill="none" stroke="#231f20" stroke-linecap="round" stroke-miterlimit="10" stroke-width="6" />
        <path d="M95.2,110.47V33.31a11.54,11.54,0,0,1,11.53-11.54h16a11.54,11.54,0,0,1,11.53,11.54v76.63" fill="none" stroke="#231f20" stroke-linecap="round" stroke-miterlimit="10" stroke-width="6" />
        <polygon points="132.84 85.23 132.84 95.65 123.81 90.44 132.84 85.23" fill="none" stroke="#231f20" stroke-linecap="round" stroke-width="7" />
        <polygon points="132.15 60.69 132.15 71.11 123.12 65.9 132.15 60.69" fill="none" stroke="#000" stroke-linecap="round" stroke-width="7" />
        <polygon points="130.96 37.85 130.96 48.28 121.93 43.06 130.96 37.85" fill="none" stroke="#000" stroke-linecap="round" stroke-width="7" />
        <path d="M130.43,154.33a15.49,15.49,0,0,1,.45,3.7,15.29,15.29,0,1,1-30.58,0,14.65,14.65,0,0,1,.22-2.58,15.29,15.29,0,0,1,29.91-1.12Z" fill="none" stroke="#515151" stroke-miterlimit="10" />
     </g>
  </g>

  <!-- Simple Key Circle (centered at 0, 0, radius 20) -->
  <g id="tmpl-key-circle">
     <circle class="bg-circle" cx="0" cy="0" r="20" stroke="none" />
     <circle class="key-circle" cx="0" cy="0" r="20" fill="none" stroke="#151513" stroke-width="2" />
     <path class="key-symbol" d="M -4,-4 A 4,4 0 1,0 4,-4 A 4,4 0 1,0 -4,-4 M 0,0 L 0,8 L 3,8 L 3,6 L 0,6 L 0,4 L 3,4 L 3,2 L 0,2 L 0,0" fill="none" stroke="#151513" stroke-width="1.5" transform="rotate(-45)" />
  </g>

  <!-- Wobbly Box -->
  <g id="tmpl-wobbly-box">
    <g transform="translate(-60, -22.5) scale(0.252, 0.401)">
        <path d="M473.64,103.31q-6-23.85-9.92-48.07-2.07-13-3.49-26.07c-.56-5.15.43-13.23-3.1-17.66s-13.55-3.73-18.82-4.16c-8.93-.72-17.87-1.21-26.83-1.55-18.3-.7-36.63-.82-54.95-1Q245.78,3.73,135,4.54,76,5,17,5.93c.1-.68.19-1.36.3-2,.36-2.39-3.67-3.43-4-1-.16,1-.3,2.08-.46,3.12L9.62,6a1.9,1.9,0,1,0,0,3.8l2.59,0Q9,32.11,6.38,54.49q-1.48,13-2.73,26.09-.58,6.06-1.1,12.13c-.36,4.11-1.41,8.73-.93,12.82.79,6.65,9.73,4.78,14.92,4.7l29.12-.44,58.24-.88,235-3.56c44.23-.66,88.49-1.2,132.7.37A2,2,0,0,0,473.64,103.31Zm-226.22-.38-224.63,3.4c-4.14.06-13.09,1.73-15.77-1.1S6.57,94.62,6.9,90.84q1.23-14,2.74-28Q12.5,36.26,16.4,9.74,119.59,8.06,222.79,8q53.29,0,106.59.38c35.6.27,71.39-.11,106.88,2.62,4.89.38,12.55-.1,16.34,2.71,3.6,2.67,2.74,8.67,3.16,12.71q1.31,12.66,3.22,25.26,3.81,25.26,10,50.15C395.21,99.34,321.21,101.82,247.42,102.93Z" />
    </g>
  </g>

  <!-- XOR Handdrawn (centered at 0, 0, original size 316.87 x 98.41) -->
  <g id="tmpl-xor-handdrawn">
     <g transform="translate(-158.43, -49.2)">
        <path class="xor-path" d="M2.53,92.39,85.4,2.59C86.7,1.17,84.59-1,83.27.47L.41,90.27c-1.31,1.42.81,3.54,2.12,2.12Z"/>
        <path class="xor-path" d="M4.43,13.06A1031.64,1031.64,0,0,0,79.28,97.19a1.5,1.5,0,0,0,2.12-2.12A1031.64,1031.64,0,0,1,6.55,10.93c-1.2-1.51-3.31.63-2.12,2.12Z"/>
        <path class="xor-path" d="M165.84,20.92c-13.18-12.22-35.06,2.2-46,11.1C113.09,37.5,107,44.69,105.62,53.52c-1.35,8.5,2,16.57,7.46,23,12.49,14.81,34.32,23.67,53.57,21.59,17.63-1.91,33.91-14.55,37.82-32.3,5.16-23.44-16.42-43.46-34.29-54.67-1.64-1-3.15,1.57-1.51,2.59C183.15,22.82,200.83,38,202.2,56.35c1.23,16.48-11.48,31.79-26.64,36.82-17,5.65-36.22.18-50.49-9.87-6.9-4.86-13.59-11.48-15.93-19.83s.63-16.49,6.08-22.88c5.69-6.67,13.35-11.63,21-15.74,8-4.3,19.72-9,27.47-1.8,1.41,1.31,3.54-.81,2.12-2.12Z"/>
        <path class="xor-path" d="M252.14,15.65q4.36,38.64,5.68,77.53l1.1-1.45-.72-.53c.44-1.88-2.45-2.68-2.89-.8-.66,2.82,1.57,5.13,4.41,4.22a1.53,1.53,0,0,0,1.1-1.45q-1.32-38.86-5.68-77.53c-.21-1.9-3.22-1.92-3,0Z"/>
        <path class="xor-path" d="M261.73,20.37c3.79-8.77,18-12.49,26.7-12.27,9.64.24,19.34,6,22.07,15.66,2.67,9.48-3.71,18-11.81,22.26-9,4.69-19.66,4.26-29.51,4a1.51,1.51,0,0,0-.76,2.8,214.66,214.66,0,0,1,46,43.06c1.2,1.51,3.31-.62,2.12-2.12A217.25,217.25,0,0,0,269.94,50.2l-.76,2.8c12.26.36,25.65.5,35.78-7.49,7.69-6.06,11.47-15.84,7.48-25.16-4.08-9.53-13.9-15-24-15.25-9.72-.23-25.06,4-29.29,13.75-.76,1.75,1.83,3.28,2.59,1.51Z"/>
        <path class="xor-path" d="M157.61,24.48V93.1a1.5,1.5,0,0,0,3,0V24.48a1.5,1.5,0,0,0-3,0Z"/>
        <path class="xor-path" d="M121.93,57.61h72.9a1.5,1.5,0,0,0,0-3h-72.9a1.5,1.5,0,0,0,0,3Z"/>
     </g>
  </g>
`;

export class EncryptionAnimCanvas {
    constructor(selector, options = {}) {
        this.svg = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!this.svg) {
            throw new Error(`Target SVG element not found: ${selector}`);
        }
        
        this.speed = options.speed || 1.0;
        this.hexPaths = options.hexPaths || HEX_PATHS;
        this.elements = new Map();
        
        this.initCanvas();
    }

    initCanvas() {
        if (!this.svg.getAttribute('viewBox')) {
            this.svg.setAttribute('viewBox', '0 0 800 480');
        }
        
        let defs = this.svg.querySelector('defs');
        if (!defs) {
            this.svg.insertAdjacentHTML('afterbegin', `<defs>${DEFS_TEMPLATE}</defs>`);
        } else {
            defs.innerHTML += DEFS_TEMPLATE;
        }
    }

    setSpeed(newSpeed) {
        this.speed = newSpeed;
        this.updateTransitions();
    }

    setMode(mode) {
        this.svg.classList.remove('mode-encrypt', 'mode-decrypt');
        this.svg.classList.add(`mode-${mode}`);
    }

    updateTransitions() {
        this.elements.forEach(el => {
            const duration = 0.5 / this.speed;
            el.dom.style.transition = `opacity ${duration}s ease-in-out`;
            
            const transitions = el.dom.querySelectorAll('.box-outline, .key-svg, .bg-circle, .arrow-path, .arrow-use, .key-graphic-group');
            transitions.forEach(child => {
                const isArrow = child.classList.contains('arrow-path') || child.classList.contains('arrow-use');
                const transitionDuration = isArrow ? (0.3 / this.speed) : (0.5 / this.speed);
                child.style.transitionDuration = `${transitionDuration}s`;
            });
        });
    }

    reset() {
        this.elements.forEach(el => {
            el.dom.classList.remove('active');
            
            const initialOpacity = el.config.initialOpacity !== undefined ? el.config.initialOpacity : 1.0;
            el.dom.style.opacity = initialOpacity;
            
            const activeChildren = el.dom.querySelectorAll('.active');
            activeChildren.forEach(child => child.classList.remove('active'));
            
            if (el.config.type === 'block') {
                const valGroup = el.dom.querySelector('.block-value-group');
                if (valGroup) valGroup.innerHTML = '';
            }
            
            if (el.config.type === 'arrow' && !el.config.arrowType) {
                const path = el.dom.querySelector('path');
                if (path) path.setAttribute('marker-end', 'url(#arrow)');
            }
        });
    }

    getAnchorCoords(elementId, anchorType) {
        const el = this.elements.get(elementId);
        if (!el) return { x: 0, y: 0 };
        
        const { x, y, width, height, radius } = el.config;
        
        if (radius) {
            const r = radius;
            switch (anchorType) {
                case 'top': return { x, y: y - r };
                case 'bottom': return { x, y: y + r };
                case 'left': return { x: x - r, y };
                case 'right': return { x: x + r, y };
                default: return { x, y };
            }
        } else {
            const w = width || 0;
            const h = height || 0;
            switch (anchorType) {
                case 'top': return { x, y: y - h / 2 };
                case 'bottom': return { x, y: y + h / 2 };
                case 'left': return { x: x - w / 2, y };
                case 'right': return { x: x + w / 2, y };
                default: return { x, y };
            }
        }
    }

    addBlock(config) {
        const { id, x, y, width = 120, height = 45, label = '', isInput = true, initialOpacity = 1.0, className = '' } = config;
        
        const classNames = ['block-group'];
        if (className) classNames.push(className);

        const group = createSVG('g', {
            id: `${id}-group`,
            class: classNames.join(' '),
            transform: `translate(${x}, ${y})`
        });
        group.style.transition = `opacity ${0.5 / this.speed}s ease-in-out`;
        group.style.opacity = initialOpacity;

        const sx = width / 120;
        const sy = height / 45;

        const useEl = createSVG('use', {
            href: '#tmpl-wobbly-box',
            class: `box-outline ${isInput ? 'input-block' : 'output-block'}`,
            transform: `scale(${sx}, ${sy})`
        });
        useEl.style.transition = 'fill 0.3s ease-in-out, stroke 0.3s ease-in-out';
        group.appendChild(useEl);

        if (label) {
            const labelEl = createSVG('text', {
                class: 'block-label',
                x: 0,
                y: - height / 2 - 6,
                'text-anchor': 'middle',
                'font-family': 'monospace',
                'font-size': '11px',
                'font-weight': 'bold',
                fill: '#666'
            });
            labelEl.textContent = label;
            group.appendChild(labelEl);
        }

        const valGroup = createSVG('g', {
            class: 'block-value-group',
            transform: `translate(0, 0)`
        });
        group.appendChild(valGroup);

        this.svg.appendChild(group);
        this.elements.set(id, { dom: group, config: { ...config, type: 'block' } });
    }

    addKey(config) {
        const { id, x, y, type = 'simple', label = '', rotation = 0, initialOpacity = 1.0, className = '', size = type === 'hardware' ? 80 : 40 } = config;
        const radius = size / 2;

        const classNames = ['key-group'];
        if (className) classNames.push(className);
        if (type) classNames.push(type);

        const group = createSVG('g', {
            id: `${id}-group`,
            class: classNames.join(' '),
            transform: `translate(${x}, ${y})`
        });
        group.style.transition = `opacity ${0.5 / this.speed}s ease-in-out`;
        group.style.opacity = initialOpacity;

        // Inner scale wrapper and graphic group to decouple scale from rotation
        const scale = type === 'hardware' ? (size / 227.24) : (size / 40);
        const scaleWrapper = createSVG('g', {
            class: 'key-scale-wrapper',
            transform: `scale(${scale})`
        });

        const graphicGroup = createSVG('g', {
            class: 'key-graphic-group',
            transform: `rotate(${rotation})`
        });

        const useEl = createSVG('use', {
            href: type === 'hardware' ? '#tmpl-key-hardware' : '#tmpl-key-circle',
            class: 'key-svg',
            id: `${id}-circle`
        });
        useEl.style.transition = 'fill 0.3s ease-in-out';
        graphicGroup.appendChild(useEl);

        if (config.showF) {
            const fText = createSVG('text', {
                class: 'key-f-label',
                x: 0,
                y: type === 'hardware' ? 5 : 0,
                'text-anchor': 'middle',
                'dominant-baseline': 'middle',
                'font-family': 'sans-serif',
                'font-size': type === 'hardware' ? '28px' : '14px',
                'font-weight': 'bold',
                fill: '#231f20'
            });
            fText.textContent = 'F';
            graphicGroup.appendChild(fText);
        }

        scaleWrapper.appendChild(graphicGroup);
        group.appendChild(scaleWrapper);

        if (label) {
            const labelEl = createSVG('text', {
                class: 'key-label',
                x: 0,
                y: - radius - 6,
                'text-anchor': 'middle',
                'font-family': 'monospace',
                'font-size': '11px',
                'font-weight': 'bold',
                fill: '#666'
            });
            labelEl.textContent = label;
            group.appendChild(labelEl);
        }

        this.svg.appendChild(group);
        this.elements.set(id, { dom: group, config: { ...config, radius, type: 'key', keyType: type } });
    }

    addXOR(config) {
        const { id, x, y, initialOpacity = 1.0, scale = 0.34 } = config;

        const group = createSVG('g', {
            id: `${id}-group`,
            class: 'xor-group',
            transform: `translate(${x}, ${y})`
        });
        group.style.transition = `opacity ${0.5 / this.speed}s ease-in-out`;
        group.style.opacity = initialOpacity;

        const wrapper = createSVG('g', {
            transform: `scale(${scale})`
        });

        const useEl = createSVG('use', {
            href: '#tmpl-xor-handdrawn'
        });
        wrapper.appendChild(useEl);
        group.appendChild(wrapper);

        this.svg.appendChild(group);
        this.elements.set(id, {
            dom: group,
            config: {
                ...config,
                width: 316.87 * scale,
                height: 98.41 * scale,
                type: 'xor'
            }
        });
    }

    addRect(config) {
        const { id, x, y, width = 60, height = 40, label = '', dashed = false, initialOpacity = 1.0 } = config;

        const group = createSVG('g', {
            id: `${id}-group`,
            class: 'rect-group',
            transform: `translate(${x}, ${y})`
        });
        group.style.transition = `opacity ${0.5 / this.speed}s ease-in-out`;
        group.style.opacity = initialOpacity;

        const rectAttrs = {
            class: 'rect-outline',
            x: - width / 2,
            y: - height / 2,
            width: width,
            height: height,
            rx: 4,
            fill: '#fff',
            stroke: '#151513',
            'stroke-width': 2
        };
        if (dashed) {
            rectAttrs['stroke-dasharray'] = '4 4';
        }

        const rect = createSVG('rect', rectAttrs);
        rect.style.transition = 'fill 0.3s ease-in-out, stroke 0.3s ease-in-out';
        group.appendChild(rect);

        const labelEl = createSVG('text', {
            class: 'rect-label',
            x: 0,
            y: 0,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-family': 'monospace',
            'font-size': '13px',
            'font-weight': 'bold',
            fill: '#151513'
        });
        labelEl.textContent = label;
        group.appendChild(labelEl);

        this.svg.appendChild(group);
        this.elements.set(id, { dom: group, config: { ...config, type: 'rect' } });
    }

    addArrow(config) {
        const { id, from, to, fromAnchor, toAnchor, type = 'straight', d = '', initialOpacity = 1.0 } = config;

        const group = createSVG('g', {
            id: `${id}-group`,
            class: 'arrow-group'
        });
        group.style.transition = `opacity ${0.5 / this.speed}s ease-in-out`;
        group.style.opacity = initialOpacity;

        const fromCoords = fromAnchor ? this.getAnchorCoords(from, fromAnchor) : from;
        const toCoords = toAnchor ? this.getAnchorCoords(to, toAnchor) : to;

        if (type === 'wobbly-horizontal') {
            const dx = toCoords.x - fromCoords.x;
            const dy = toCoords.y - fromCoords.y;
            const distance = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;

            const useEl = createSVG('use', {
                href: '#tmpl-wobbly-arrow-horizontal',
                class: 'arrow-use',
                id: id,
                transform: `translate(${fromCoords.x}, ${fromCoords.y}) rotate(${angle}) scale(${distance / 139.2}, 0.6)`
            });
            useEl.style.transition = 'fill 0.3s ease-in-out';
            group.appendChild(useEl);
        } else {
            const pathData = d || `M ${fromCoords.x} ${fromCoords.y} L ${toCoords.x} ${toCoords.y}`;
            const path = createSVG('path', {
                id: id,
                class: 'arrow-path',
                d: pathData,
                'marker-end': 'url(#arrow)'
            });
            path.style.transition = 'stroke 0.3s ease-in-out, stroke-width 0.3s ease-in-out';
            group.appendChild(path);
        }

        this.svg.appendChild(group);
        this.elements.set(id, { dom: group, config: { ...config, type: 'arrow', arrowType: type } });
    }

    executeActions(actions) {
        actions.forEach(action => {
            const { type, elementId } = action;
            const el = this.elements.get(elementId);
            if (!el) return;

            switch (type) {
                case 'showValue':
                    this.renderText(elementId, action.value);
                    break;
                case 'highlight':
                    this.setElementActive(elementId, action.active);
                    break;
                case 'highlightArrow':
                    this.setArrowActive(elementId, action.active);
                    break;
                case 'fade':
                    this.setOpacity(elementId, action.opacity, action.duration);
                    break;
                case 'rotate':
                    this.setRotation(elementId, action.angle);
                    break;
                case 'setLabel':
                    this.setElementLabel(elementId, action.label);
                    break;
                case 'custom':
                    if (typeof action.callback === 'function') {
                        action.callback();
                    }
                    break;
            }
        });
    }

    renderText(elementId, text) {
        const el = this.elements.get(elementId);
        if (!el || el.config.type !== 'block') return;

        const valGroup = el.dom.querySelector('.block-value-group');
        if (!valGroup) return;

        valGroup.innerHTML = '';
        if (!text) return;

        const lines = Array.isArray(text) ? text : [text];
        const numLines = lines.length;
        const { width = 120, height = 45 } = el.config;

        const lineSpacingY = (height * 0.8) / Math.max(1, numLines);
        const startY = - (numLines - 1) * lineSpacingY / 2;

        lines.forEach((line, lineIdx) => {
            const str = String(line);
            const N = str.length;
            if (N === 0) return;

            let s = (height * 0.45) / 80;
            if (numLines === 1) s = (height * 0.65) / 80;

            let spacing = 65 * s;
            let charWidth = 60 * s;
            let totalWidth = (N - 1) * spacing + charWidth;

            const maxWidth = width * 0.9;
            if (totalWidth > maxWidth) {
                s = maxWidth / ((N - 1) * 65 + 60);
                spacing = 65 * s;
                charWidth = 60 * s;
                totalWidth = (N - 1) * spacing + charWidth;
            }

            const startX = -totalWidth / 2;
            const yOffset = startY + lineIdx * lineSpacingY;

            for (let i = 0; i < N; i++) {
                const char = str[i];
                if (char === ' ') continue;

                const paths = this.hexPaths[char.toUpperCase()];
                if (!paths) continue;

                const x = startX + i * spacing;

                const charGroup = createSVG('g', {
                    class: 'char-group',
                    transform: `translate(${x}, ${yOffset - 40 * s}) scale(${s})`
                });
                charGroup.style.transition = `opacity ${0.3 / this.speed}s ease-in-out`;
                charGroup.style.opacity = '1';

                paths.forEach(d => {
                    const pathEl = createSVG('path', {
                        d: d,
                        fill: '#000'
                    });
                    charGroup.appendChild(pathEl);
                });

                valGroup.appendChild(charGroup);
            }
        });
    }

    setElementActive(elementId, active) {
        const el = this.elements.get(elementId);
        if (!el) return;

        if (active) {
            el.dom.classList.add('active');
        } else {
            el.dom.classList.remove('active');
        }
    }

    setArrowActive(arrowId, active) {
        const el = this.elements.get(arrowId);
        if (!el || el.config.type !== 'arrow') return;

        if (active) {
            el.dom.classList.add('active');
            
            const path = el.dom.querySelector('.arrow-path');
            if (path) {
                path.classList.add('active');
                path.setAttribute('marker-end', 'url(#arrow-active)');
            }
            const useEl = el.dom.querySelector('.arrow-use');
            if (useEl) {
                useEl.classList.add('active');
            }
        } else {
            el.dom.classList.remove('active');
            
            const path = el.dom.querySelector('.arrow-path');
            if (path) {
                path.classList.remove('active');
                path.setAttribute('marker-end', 'url(#arrow)');
            }
            const useEl = el.dom.querySelector('.arrow-use');
            if (useEl) {
                useEl.classList.remove('active');
            }
        }
    }

    setOpacity(elementId, opacity, duration) {
        const el = this.elements.get(elementId);
        if (!el) return;

        const transitionDuration = duration !== undefined ? (duration / 1000) / this.speed : (0.5 / this.speed);
        el.dom.style.transition = `opacity ${transitionDuration}s ease-in-out`;
        el.dom.style.opacity = opacity;
    }

    setRotation(elementId, angle) {
        const el = this.elements.get(elementId);
        if (!el || el.config.type !== 'key') return;

        const graphicGroup = el.dom.querySelector('.key-graphic-group');
        if (!graphicGroup) return;

        graphicGroup.setAttribute('transform', `rotate(${angle})`);
    }

    setElementLabel(elementId, label) {
        const el = this.elements.get(elementId);
        if (!el) return;

        if (el.config.type === 'rect') {
            const labelEl = el.dom.querySelector('.rect-label');
            if (labelEl) labelEl.textContent = label;
        } else if (el.config.type === 'key') {
            const labelEl = el.dom.querySelector('.key-label');
            if (labelEl) labelEl.textContent = label;
        } else if (el.config.type === 'block') {
            const labelEl = el.dom.querySelector('.block-label');
            if (labelEl) labelEl.textContent = label;
        }
    }
}

export class AnimationSequence {
    constructor(canvas) {
        this.canvas = canvas;
        this.steps = [];
        this.currentStepIdx = 0;
        this.isPlaying = false;
        this.loop = false;
        this.timeoutId = null;
    }

    addStep({ actions, duration }) {
        this.steps.push({ actions, duration });
        return this;
    }

    async play({ loop = false, onStepComplete = null } = {}) {
        this.isPlaying = true;
        this.loop = loop;

        while (this.isPlaying) {
            const step = this.steps[this.currentStepIdx];
            if (!step) break;

            this.canvas.executeActions(step.actions);

            const duration = step.duration / this.canvas.speed;
            await this.sleep(duration);

            if (onStepComplete) {
                onStepComplete(this.currentStepIdx);
            }

            this.currentStepIdx++;
            if (this.currentStepIdx >= this.steps.length) {
                if (this.loop) {
                    this.currentStepIdx = 0;
                    this.canvas.reset();
                } else {
                    this.isPlaying = false;
                    break;
                }
            }
        }
    }

    pause() {
        this.isPlaying = false;
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
    }

    stop() {
        this.pause();
        this.currentStepIdx = 0;
        this.canvas.reset();
    }

    sleep(ms) {
        return new Promise(resolve => {
            this.timeoutId = setTimeout(resolve, ms);
        });
    }
}
