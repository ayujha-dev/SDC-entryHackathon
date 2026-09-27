import { Renderer, Program, Mesh, Triangle, Color } from 'ogl';

document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();
    initRotatingText();
    initScrollExpand();
    initSpecularButtons();
});

// --- Theme Toggle ---
function initThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    const html = document.documentElement;
    const sunIcon = btn.querySelector('.icon-sun');
    const moonIcon = btn.querySelector('.icon-moon');

    btn.addEventListener('click', () => {
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        html.setAttribute('data-theme', newTheme);
        
        if (newTheme === 'dark') {
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        } else {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        }
    });
}

// --- Rotating Text ---
function initRotatingText() {
    const container = document.getElementById('rotating-text-container');
    if (!container) return;

    const texts = ['Power', 'Freedom', 'Legacy', 'Adrenaline'];
    let currentIndex = 0;

    // Create spans for each word
    const spans = texts.map((text, i) => {
        const span = document.createElement('span');
        span.textContent = text;
        if (i === 0) span.classList.add('active');
        container.appendChild(span);
        return span;
    });

    setInterval(() => {
        const currentSpan = spans[currentIndex];
        currentSpan.classList.remove('active');
        currentSpan.classList.add('exit');
        
        setTimeout(() => {
            currentSpan.classList.remove('exit');
        }, 600); // match css transition

        currentIndex = (currentIndex + 1) % texts.length;
        
        const nextSpan = spans[currentIndex];
        nextSpan.classList.add('active');
    }, 2000);
}

// --- Scroll Expand ---
function initScrollExpand() {
    const root = document.getElementById('scroll-expand-container');
    if (!root) return;
    
    const track = root.querySelector('.scroll-expand__track');
    const stage = root.querySelector('.scroll-expand__stage');
    const frame = root.querySelector('.scroll-expand__frame');
    const media = root.querySelector('.scroll-expand__media');
    const scrim = root.querySelector('.scroll-expand__scrim');

    // Props
    const c = {
        startWidth: 42,
        startHeight: 58,
        startRadius: 24,
        endRadius: 0,
        mediaZoom: 1.35,
        scrollDistance: 1.2, // multiples of stage height
        holdDistance: 0.35,
        overlayScrim: 0.45
    };

    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const smoothstep = (edge0, edge1, x) => {
        const t = clamp((x - edge0) / (edge1 - edge0 || 1e-6), 0, 1);
        return t * t * (3 - 2 * t);
    };

    let stageH = 0;
    
    function measure() {
        stageH = window.innerHeight;
        stage.style.height = `${stageH}px`;
        track.style.height = `${stageH * (1 + c.scrollDistance + c.holdDistance)}px`;
    }

    function readProgress() {
        const span = stageH * c.scrollDistance;
        const top = track.getBoundingClientRect().top;
        return clamp(-top / span, 0, 1);
    }

    function applyProgress(p) {
        const e = smoothstep(0, 1, p);
        const w = c.startWidth + (100 - c.startWidth) * e;
        const h = c.startHeight + (100 - c.startHeight) * e;
        const ix = Math.max(0, (100 - w) / 2);
        const iy = Math.max(0, (100 - h) / 2);
        const r = c.startRadius + (c.endRadius - c.startRadius) * e;
        
        frame.style.clipPath = `inset(${iy}% ${ix}% ${iy}% ${ix}% round ${r}px)`;
        media.style.transform = `scale(${c.mediaZoom + (1 - c.mediaZoom) * e})`;
        scrim.style.opacity = `${c.overlayScrim * e}`;
    }

    let target = 0;
    let current = 0;
    let raf = 0;
    let running = false;

    function tick() {
        // smooth follow
        current += (target - current) * 0.15;
        if (Math.abs(target - current) < 0.001) {
            current = target;
            running = false;
        }
        applyProgress(current);
        raf = running ? requestAnimationFrame(tick) : 0;
    }

    function onScroll() {
        target = readProgress();
        if (!running) {
            running = true;
            if (!raf) raf = requestAnimationFrame(tick);
        }
    }

    window.addEventListener('resize', () => {
        measure();
        target = readProgress();
        current = target;
        applyProgress(current);
    });
    
    window.addEventListener('scroll', onScroll, { passive: true });
    
    measure();
    target = readProgress();
    current = target;
    applyProgress(current);
}

// --- Specular Button ---
const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform float uRadius;
uniform float uAngle;
uniform float uPx;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform float uShineSize;
uniform float uShineFade;
uniform float uThickness;
uniform float uBaseWidth;
out vec4 fragColor;
float sdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float shapeSDF(vec2 p) { return sdRoundedRect(p, uHalfSize, uRadius); }
float gaussianLine(float d, float sigma) {
  float x = d / (sigma + 1e-6);
  float k = mix(1.0, 1.6, smoothstep(0.0, 1.5, x));
  return exp(-k * x * x);
}
void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = shapeSDF(p);
  vec2 L = vec2(cos(uAngle), sin(uAngle));
  float base = (1.0 - smoothstep(0.0, uBaseWidth, abs(d))) * 0.45;
  vec2 nEll = normalize(p / (uHalfSize * uHalfSize) + 1e-6);
  float phi = acos(clamp(abs(dot(nEll, L)), 0.0, 1.0));
  float rim = 1.0 - smoothstep(uShineSize - uShineFade, uShineSize + uShineFade + 1e-4, phi);
  float line = gaussianLine(d, uThickness);
  float edgeClamp = 1.0 - smoothstep(0.5 * uPx, 3.0 * uPx, abs(d));
  float hi = line * rim * edgeClamp * uIntensity;
  vec3 col = uBaseColor * base + uLineColor * hi;
  float a = clamp(base + hi, 0.0, 1.0);
  fragColor = vec4(col, a);
}
`;

function initSpecularButtons() {
    const buttons = document.querySelectorAll('.vanilla-specular-button');
    const PAD = 20;

    buttons.forEach(btn => {
        // Setup DOM structure for button
        const label = document.createElement('span');
        label.className = 'specular-button__label';
        label.innerHTML = btn.innerHTML;
        btn.innerHTML = '';
        
        const fx = document.createElement('span');
        fx.className = 'specular-button__fx';
        fx.setAttribute('aria-hidden', 'true');
        
        btn.appendChild(fx);
        btn.appendChild(label);

        // OGL WebGL Setup
        const dpr = window.devicePixelRatio || 1;
        const renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true, dpr });
        const gl = renderer.gl;
        gl.clearColor(0, 0, 0, 0);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        const geometry = new Triangle(gl);
        if (geometry.attributes.uv) delete geometry.attributes.uv;

        // Determine colors based on current theme. 
        // We will just use white line, dark base for now, can be updated on theme change.
        const p = {
            radius: 18,
            lineColor: [1, 1, 1], // white
            baseColor: [0.32, 0.32, 0.32], // grey
            intensity: 1,
            shineSize: 10,
            shineFade: 40,
            thickness: 1,
            speed: 0.35,
            proximity: 250
        };

        const program = new Program(gl, {
            vertex: VERT,
            fragment: FRAG,
            uniforms: {
                uCenter: { value: [0, 0] },
                uHalfSize: { value: [1, 1] },
                uRadius: { value: 0 },
                uAngle: { value: 2.4 },
                uPx: { value: dpr },
                uLineColor: { value: p.lineColor },
                uBaseColor: { value: p.baseColor },
                uIntensity: { value: 1 },
                uShineSize: { value: 0.17 },
                uShineFade: { value: 0.7 },
                uThickness: { value: 1 },
                uBaseWidth: { value: dpr }
            }
        });

        const mesh = new Mesh(gl, { geometry, program });
        fx.appendChild(gl.canvas);

        const sizeRef = { w: 1, h: 1 };
        const resize = () => {
            const rect = btn.getBoundingClientRect();
            const w = rect.width;
            const h = rect.height;
            if(w === 0 || h === 0) return;
            sizeRef.w = w;
            sizeRef.h = h;
            renderer.setSize(w + PAD * 2, h + PAD * 2);
            program.uniforms.uCenter.value = [(PAD + w / 2) * dpr, (PAD + h / 2) * dpr];
            program.uniforms.uHalfSize.value = [(w / 2) * dpr, (h / 2) * dpr];
        };
        const ro = new ResizeObserver(resize);
        ro.observe(btn);
        resize();

        let pointerAngle = null;
        let proximityT = 0;
        const onPointerMove = e => {
            const rect = btn.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = Math.max(rect.left - e.clientX, 0, e.clientX - rect.right);
            const dy = Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom);
            const dist = Math.hypot(dx, dy);
            if (dist === 0) {
                const nx = (e.clientX - cx) / (rect.width / 2);
                const ny = (cy - e.clientY) / (rect.height / 2);
                pointerAngle = Math.atan2(2 / rect.height, -2 / rect.width) + nx * 0.3 + ny * 0.15;
            } else {
                pointerAngle = Math.atan2(cy - e.clientY, e.clientX - cx);
            }
            const t = Math.max(0, 1 - dist / Math.max(p.proximity, 1));
            proximityT = t * t * (3 - 2 * t);
        };
        window.addEventListener('pointermove', onPointerMove);

        let angle = 2.4;
        let idleAngle = 2.4;
        let bright = 0;
        let last = performance.now();
        
        function update(now) {
            requestAnimationFrame(update);
            const dt = Math.min((now - last) / 1000, 0.05);
            last = now;

            idleAngle += p.speed * dt;
            const steer = pointerAngle != null;
            const target = steer ? pointerAngle : idleAngle;
            const diff = ((target - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            angle += diff * (1 - Math.exp(-dt * 7));

            bright += (proximityT - bright) * (1 - Math.exp(-dt * 8));

            // Optional: update colors based on theme if needed here
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            program.uniforms.uLineColor.value = isDark ? [1,1,1] : [0,0,0];
            program.uniforms.uBaseColor.value = isDark ? [0.32, 0.32, 0.32] : [0.8, 0.8, 0.8];

            program.uniforms.uAngle.value = angle;
            program.uniforms.uRadius.value = Math.min(p.radius, Math.min(sizeRef.w, sizeRef.h) / 2) * dpr;
            program.uniforms.uIntensity.value = p.intensity * bright;
            program.uniforms.uShineSize.value = (p.shineSize * Math.PI) / 180;
            program.uniforms.uShineFade.value = (p.shineFade * Math.PI) / 180;
            program.uniforms.uThickness.value = p.thickness * dpr;
            renderer.render({ scene: mesh });
        }
        requestAnimationFrame(update);
    });
}
