import {
  Renderer,
  Program,
  Mesh,
  Triangle,
  Color,
  Plane,
  Texture,
  RenderTarget,
} from "ogl";

document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  initRotatingText();
  initScrollExpand();
  initSpecularButtons();
  initSoftAurora();
  initFlexCarousel();
});

// --- Theme Toggle ---
function initThemeToggle() {
  const btn = document.getElementById("theme-toggle");
  const html = document.documentElement;
  const sunIcon = btn.querySelector(".icon-sun");
  const moonIcon = btn.querySelector(".icon-moon");

  btn.addEventListener("click", () => {
    const currentTheme = html.getAttribute("data-theme");
    const newTheme = currentTheme === "light" ? "dark" : "light";
    html.setAttribute("data-theme", newTheme);

    if (newTheme === "dark") {
      sunIcon.style.display = "block";
      moonIcon.style.display = "none";
    } else {
      sunIcon.style.display = "none";
      moonIcon.style.display = "block";
    }
  });
}

// --- Rotating Text ---
function initRotatingText() {
  const container = document.getElementById("rotating-text-container");
  if (!container) return;

  const texts = ["Power", "Freedom", "Legacy", "Adrenaline"];
  let currentIndex = 0;

  // Create spans for each word
  const spans = texts.map((text, i) => {
    const span = document.createElement("span");
    span.textContent = text;
    if (i === 0) span.classList.add("active");
    container.appendChild(span);
    return span;
  });

  setInterval(() => {
    const currentSpan = spans[currentIndex];
    currentSpan.classList.remove("active");
    currentSpan.classList.add("exit");

    setTimeout(() => {
      currentSpan.classList.remove("exit");
    }, 600); // match css transition

    currentIndex = (currentIndex + 1) % texts.length;

    const nextSpan = spans[currentIndex];
    nextSpan.classList.add("active");
  }, 2000);
}

// --- Scroll Expand ---
function initScrollExpand() {
  const root = document.getElementById("scroll-expand-container");
  if (!root) return;

  const track = root.querySelector(".scroll-expand__track");
  const stage = root.querySelector(".scroll-expand__stage");
  const frame = root.querySelector(".scroll-expand__frame");
  const media = root.querySelector(".scroll-expand__media");
  const scrim = root.querySelector(".scroll-expand__scrim");

  // Props
  const c = {
    startWidth: 42,
    startHeight: 58,
    startRadius: 24,
    endRadius: 0,
    mediaZoom: 1.35,
    scrollDistance: 1.2, // multiples of stage height
    holdDistance: 0.35,
    overlayScrim: 0.45,
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

    for (let i = 1; i <= 4; i++) {
      const el = document.getElementById(`cinematic-text-${i}`);
      if (el) {
        const start = (i - 1) * 0.25;
        const end = i * 0.25;
        if (p > start && p < end) {
          const localP = (p - start) / 0.25;
          let op = 1;
          if (localP < 0.3) op = localP / 0.3;
          else if (localP > 0.7) op = 1 - (localP - 0.7) / 0.3;
          el.style.opacity = op;
          el.style.transform = `translate(-50%, calc(-50% + ${(1 - localP) * 30}px)) scale(${0.95 + localP * 0.1})`;
        } else {
          el.style.opacity = 0;
        }
      }
    }
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

  window.addEventListener("resize", () => {
    measure();
    target = readProgress();
    current = target;
    applyProgress(current);
  });

  window.addEventListener("scroll", onScroll, { passive: true });

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
  const buttons = document.querySelectorAll(".vanilla-specular-button");
  const PAD = 20;

  buttons.forEach((btn) => {
    // Setup DOM structure for button
    const label = document.createElement("span");
    label.className = "specular-button__label";
    label.innerHTML = btn.innerHTML;
    btn.innerHTML = "";

    const fx = document.createElement("span");
    fx.className = "specular-button__fx";
    fx.setAttribute("aria-hidden", "true");

    btn.appendChild(fx);
    btn.appendChild(label);

    // Smooth scroll handler
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      if (targetId) {
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth" });
        }
      }
    });

    // OGL WebGL Setup
    const dpr = window.devicePixelRatio || 1;
    const renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
      dpr,
    });
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
      proximity: 250,
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
        uBaseWidth: { value: dpr },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    fx.appendChild(gl.canvas);

    const sizeRef = { w: 1, h: 1 };
    const resize = () => {
      const rect = btn.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w === 0 || h === 0) return;
      sizeRef.w = w;
      sizeRef.h = h;
      renderer.setSize(w + PAD * 2, h + PAD * 2);
      program.uniforms.uCenter.value = [
        (PAD + w / 2) * dpr,
        (PAD + h / 2) * dpr,
      ];
      program.uniforms.uHalfSize.value = [(w / 2) * dpr, (h / 2) * dpr];
    };
    const ro = new ResizeObserver(resize);
    ro.observe(btn);
    resize();

    let pointerAngle = null;
    let proximityT = 0;
    const onPointerMove = (e) => {
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = Math.max(rect.left - e.clientX, 0, e.clientX - rect.right);
      const dy = Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom);
      const dist = Math.hypot(dx, dy);
      if (dist === 0) {
        const nx = (e.clientX - cx) / (rect.width / 2);
        const ny = (cy - e.clientY) / (rect.height / 2);
        pointerAngle =
          Math.atan2(2 / rect.height, -2 / rect.width) + nx * 0.3 + ny * 0.15;
      } else {
        pointerAngle = Math.atan2(cy - e.clientY, e.clientX - cx);
      }
      const t = Math.max(0, 1 - dist / Math.max(p.proximity, 1));
      proximityT = t * t * (3 - 2 * t);
    };
    window.addEventListener("pointermove", onPointerMove);

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
      const isDark =
        document.documentElement.getAttribute("data-theme") === "dark";
      program.uniforms.uLineColor.value = isDark ? [1, 1, 1] : [0, 0, 0];
      program.uniforms.uBaseColor.value = isDark
        ? [0.32, 0.32, 0.32]
        : [0.8, 0.8, 0.8];

      program.uniforms.uAngle.value = angle;
      program.uniforms.uRadius.value =
        Math.min(p.radius, Math.min(sizeRef.w, sizeRef.h) / 2) * dpr;
      program.uniforms.uIntensity.value = p.intensity * bright;
      program.uniforms.uShineSize.value = (p.shineSize * Math.PI) / 180;
      program.uniforms.uShineFade.value = (p.shineFade * Math.PI) / 180;
      program.uniforms.uThickness.value = p.thickness * dpr;
      renderer.render({ scene: mesh });
    }
    requestAnimationFrame(update);
  });
}

// --- SoftAurora ---
function initSoftAurora() {
  const container = document.getElementById("aurora-bg");
  if (!container) return;

  // Config
  let config = {
    speed: 0.6,
    scale: 1.5,
    brightness: 1.0,
    color1: "#f7f7f7",
    color2: "#e100ff",
    noiseFrequency: 2.5,
    noiseAmplitude: 1.0,
    bandHeight: 0.5,
    bandSpread: 1.0,
    octaveDecay: 0.1,
    layerOffset: 0,
    colorSpeed: 1.0,
    enableMouseInteraction: true,
    mouseInfluence: 0.25,
    lightMode: document.documentElement.getAttribute("data-theme") === "light",
  };

  function hexToVec3(hex) {
    const h = hex.replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255,
    ];
  }

  const vertexShader = `
    attribute vec2 uv;
    attribute vec2 position;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 0, 1);
    }
    `;

  const fragmentShader = `
    precision highp float;
    uniform float uTime;
    uniform vec3 uResolution;
    uniform float uSpeed;
    uniform float uScale;
    uniform float uBrightness;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform float uNoiseFreq;
    uniform float uNoiseAmp;
    uniform float uBandHeight;
    uniform float uBandSpread;
    uniform float uOctaveDecay;
    uniform float uLayerOffset;
    uniform float uColorSpeed;
    uniform vec2 uMouse;
    uniform float uMouseInfluence;
    uniform bool uEnableMouse;
    uniform float uLightMode;
    #define TAU 6.28318

    vec3 gradientHash(vec3 p) {
      p = vec3(
        dot(p, vec3(127.1, 311.7, 234.6)),
        dot(p, vec3(269.5, 183.3, 198.3)),
        dot(p, vec3(169.5, 283.3, 156.9))
      );
      vec3 h = fract(sin(p) * 43758.5453123);
      float phi = acos(2.0 * h.x - 1.0);
      float theta = TAU * h.y;
      return vec3(cos(theta) * sin(phi), sin(theta) * cos(phi), cos(phi));
    }
    float quinticSmooth(float t) {
      float t2 = t * t;
      float t3 = t * t2;
      return 6.0 * t3 * t2 - 15.0 * t2 * t2 + 10.0 * t3;
    }
    vec3 cosineGradient(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
      return a + b * cos(TAU * (c * t + d));
    }
    float perlin3D(float amplitude, float frequency, float px, float py, float pz) {
      float x = px * frequency;
      float y = py * frequency;
      float fx = floor(x); float fy = floor(y); float fz = floor(pz);
      float cx = ceil(x);  float cy = ceil(y);  float cz = ceil(pz);
      vec3 g000 = gradientHash(vec3(fx, fy, fz));
      vec3 g100 = gradientHash(vec3(cx, fy, fz));
      vec3 g010 = gradientHash(vec3(fx, cy, fz));
      vec3 g110 = gradientHash(vec3(cx, cy, fz));
      vec3 g001 = gradientHash(vec3(fx, fy, cz));
      vec3 g101 = gradientHash(vec3(cx, fy, cz));
      vec3 g011 = gradientHash(vec3(fx, cy, cz));
      vec3 g111 = gradientHash(vec3(cx, cy, cz));
      float d000 = dot(g000, vec3(x - fx, y - fy, pz - fz));
      float d100 = dot(g100, vec3(x - cx, y - fy, pz - fz));
      float d010 = dot(g010, vec3(x - fx, y - cy, pz - fz));
      float d110 = dot(g110, vec3(x - cx, y - cy, pz - fz));
      float d001 = dot(g001, vec3(x - fx, y - fy, pz - cz));
      float d101 = dot(g101, vec3(x - cx, y - fy, pz - cz));
      float d011 = dot(g011, vec3(x - fx, y - cy, pz - cz));
      float d111 = dot(g111, vec3(x - cx, y - cy, pz - cz));
      float sx = quinticSmooth(x - fx);
      float sy = quinticSmooth(y - fy);
      float sz = quinticSmooth(pz - fz);
      float lx00 = mix(d000, d100, sx);
      float lx10 = mix(d010, d110, sx);
      float lx01 = mix(d001, d101, sx);
      float lx11 = mix(d011, d111, sx);
      float ly0 = mix(lx00, lx10, sy);
      float ly1 = mix(lx01, lx11, sy);
      return amplitude * mix(ly0, ly1, sz);
    }
    float auroraGlow(float t, vec2 shift) {
      vec2 uv = gl_FragCoord.xy / uResolution.y;
      uv += shift;
      float noiseVal = 0.0;
      float freq = uNoiseFreq;
      float amp = uNoiseAmp;
      vec2 samplePos = uv * uScale;
      for (float i = 0.0; i < 3.0; i += 1.0) {
        noiseVal += perlin3D(amp, freq, samplePos.x, samplePos.y, t);
        amp *= uOctaveDecay;
        freq *= 2.0;
      }
      float yBand = uv.y * 10.0 - uBandHeight * 10.0;
      return 0.3 * max(exp(uBandSpread * (1.0 - 1.1 * abs(noiseVal + yBand))), 0.0);
    }
    void main() {
      vec2 uv = gl_FragCoord.xy / uResolution.xy;
      float t = uSpeed * 0.4 * uTime;
      vec2 shift = vec2(0.0);
      if (uEnableMouse) {
        shift = (uMouse - 0.5) * uMouseInfluence;
      }
      float glow1 = auroraGlow(t, shift);
      float glow2 = auroraGlow(t + uLayerOffset, shift);
      vec3 gradient1 = cosineGradient(uv.x + uTime * uSpeed * 0.2 * uColorSpeed, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.3, 0.20, 0.20));
      vec3 gradient2 = cosineGradient(uv.x + uTime * uSpeed * 0.1 * uColorSpeed, vec3(0.5), vec3(0.5), vec3(2.0, 1.0, 0.0), vec3(0.5, 0.20, 0.25));
      vec3 col = 0.99 * glow1 * gradient1 * uColor1;
      col += 0.99 * glow2 * gradient2 * uColor2;
      col *= uBrightness;
      float alpha = clamp(length(col), 0.0, 1.0);
      if (uLightMode > 0.5) {
        float phase1 = dot(gradient1, vec3(0.299, 0.587, 0.114));
        float phase2 = dot(gradient2, vec3(0.299, 0.587, 0.114));
        float weight1 = pow(max(glow1 * (0.62 + 0.38 * phase1), 0.0), 1.35);
        float weight2 = pow(max(glow2 * (0.62 + 0.38 * phase2), 0.0), 1.35);
        float weightSum = max(weight1 + weight2, 0.0001);
        vec3 chroma = (weight1 * uColor1 + weight2 * uColor2) / weightSum;
        float neutral = min(chroma.r, min(chroma.g, chroma.b));
        chroma = max(chroma - vec3(neutral * 0.78), vec3(0.0));
        float peak = max(chroma.r, max(chroma.g, chroma.b));
        chroma = pow(clamp(chroma / max(peak, 0.0001), 0.0, 1.0), vec3(1.08));
        float ink = clamp((weight1 + weight2) * uBrightness * 1.55, 0.0, 0.82);
        gl_FragColor = vec4(mix(vec3(1.0), chroma, ink), 1.0);
      } else {
        gl_FragColor = vec4(col, alpha);
      }
    }
    `;

  const renderer = new Renderer({ alpha: true, premultipliedAlpha: false });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);

  let currentMouse = [0.5, 0.5];
  let targetMouse = [0.5, 0.5];

  function handleMouseMove(e) {
    const rect = gl.canvas.getBoundingClientRect();
    targetMouse = [
      (e.clientX - rect.left) / rect.width,
      1.0 - (e.clientY - rect.top) / rect.height,
    ];
  }
  function handleMouseLeave() {
    targetMouse = [0.5, 0.5];
  }

  const geometry = new Triangle(gl);
  const program = new Program(gl, {
    vertex: vertexShader,
    fragment: fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uResolution: {
        value: [
          gl.canvas.width,
          gl.canvas.height,
          gl.canvas.width / (gl.canvas.height || 1),
        ],
      },
      uSpeed: { value: config.speed },
      uScale: { value: config.scale },
      uBrightness: { value: config.brightness },
      uColor1: { value: hexToVec3(config.color1) },
      uColor2: { value: hexToVec3(config.color2) },
      uNoiseFreq: { value: config.noiseFrequency },
      uNoiseAmp: { value: config.noiseAmplitude },
      uBandHeight: { value: config.bandHeight },
      uBandSpread: { value: config.bandSpread },
      uOctaveDecay: { value: config.octaveDecay },
      uLayerOffset: { value: config.layerOffset },
      uColorSpeed: { value: config.colorSpeed },
      uMouse: { value: new Float32Array([0.5, 0.5]) },
      uMouseInfluence: { value: config.mouseInfluence },
      uEnableMouse: { value: config.enableMouseInteraction },
      uLightMode: { value: config.lightMode ? 1 : 0 },
    },
  });

  const mesh = new Mesh(gl, { geometry, program });
  container.appendChild(gl.canvas);
  gl.canvas.style.width = "100%";
  gl.canvas.style.height = "100%";

  function resize() {
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    program.uniforms.uResolution.value = [
      gl.canvas.width,
      gl.canvas.height,
      gl.canvas.width / (gl.canvas.height || 1),
    ];
  }
  window.addEventListener("resize", resize);
  resize();

  if (config.enableMouseInteraction) {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
  }

  function updateTheme() {
    const isLight =
      document.documentElement.getAttribute("data-theme") === "light";
    program.uniforms.uLightMode.value = isLight ? 1 : 0;
    if (isLight) {
      program.uniforms.uColor1.value = hexToVec3("#ffffff");
      program.uniforms.uColor2.value = hexToVec3("#eeeeee");
    } else {
      program.uniforms.uColor1.value = hexToVec3("#2a00ff");
      program.uniforms.uColor2.value = hexToVec3("#e100ff");
    }
  }
  // Hook into theme button
  document.getElementById("theme-toggle").addEventListener("click", () => {
    setTimeout(updateTheme, 50);
  });
  updateTheme();

  function update(time) {
    requestAnimationFrame(update);
    program.uniforms.uTime.value = time * 0.001;
    if (config.enableMouseInteraction) {
      currentMouse[0] += 0.05 * (targetMouse[0] - currentMouse[0]);
      currentMouse[1] += 0.05 * (targetMouse[1] - currentMouse[1]);
      program.uniforms.uMouse.value[0] = currentMouse[0];
      program.uniforms.uMouse.value[1] = currentMouse[1];
    }
    renderer.render({ scene: mesh });
  }
  requestAnimationFrame(update);
}
// --- FlexCarousel ---
function initFlexCarousel() {
  const container = document.getElementById("flex-carousel-container");
  if (!container) return;

  const items = [
    {
      src: "https://images.unsplash.com/photo-1547744152-14d985cb937f?q=80&w=1200&auto=format&fit=crop",
      title: "Mustang GT",
      subtitle: "Performance",
    },
    {
      src: "https://images.unsplash.com/photo-1583121274602-3e2820c69888?q=80&w=1200&auto=format&fit=crop",
      title: "Dark Horse",
      subtitle: "Track Ready",
    },
    {
      src: "https://images.unsplash.com/photo-1629897048514-3dd74142ffce?q=80&w=1200&auto=format&fit=crop",
      title: "Mach-E",
      subtitle: "Electric",
    },
    {
      src: "https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?q=80&w=1200&auto=format&fit=crop",
      title: "Shelby GT500",
      subtitle: "Supercharged",
    },
    {
      src: "https://images.unsplash.com/photo-1611821064430-0d40221e4f98?q=80&w=1200&auto=format&fit=crop",
      title: "Mustang 1969",
      subtitle: "Classic",
    },
    {
      src: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?q=80&w=1200&auto=format&fit=crop",
      title: "Mustang Fastback",
      subtitle: "Heritage",
    },
    {
      src: "https://images.unsplash.com/photo-1584345604476-8ec5e12e42dd?q=80&w=1200&auto=format&fit=crop",
      title: "Mustang Boss 302",
      subtitle: "Legendary",
    },
    {
      src: "https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?q=80&w=1200&auto=format&fit=crop",
      title: "Mustang Convertible",
      subtitle: "Open Air",
    },
  ];

  const s = {
    intro: "rise",
    cardHeight: 0.5,
    gap: 12,
    radius: 0,
    fit: "natural",
    lensWidth: 0.74,
    lensHeight: 1.18,
    tilt: 62,
    roundness: 1,
    bend: 0.34,
    reach: 0.38,
    curl: "twist",
    dispersion: 0.45,
    liquid: 0,
    followCursor: false,
    squeeze: 0.2,
    focusOnClick: true,
    autoplay: false,
    interval: 4,
    captureWheel: true,
  };

  const FIT_ASPECT = { portrait: 0.75, square: 1, landscape: 4 / 3 };
  const TAPS = 12;
  const PIXEL_BUDGET = 4.5e6;
  const INTRO_DURATION = {
    rise: 2.1,
    bloom: 1.6,
    spin: 2.2,
    deal: 1.5,
    fade: 0.35,
  };

  const wrap = (value, size) =>
    ((((value + size / 2) % size) + size) % size) - size / 2;
  const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
  const easeOut = (value) => 1 - Math.pow(1 - clamp01(value), 3);
  const easeOutQuint = (value) => 1 - Math.pow(1 - clamp01(value), 5);
  const easeInOut = (value) => {
    const t = clamp01(value);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  const renderer = new Renderer({
    dpr: Math.min(window.devicePixelRatio || 1, 2),
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
  });
  const gl = renderer.gl;
  if (!renderer.isWebgl2) {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return;
  }
  gl.clearColor(0, 0, 0, 0);
  const canvas = gl.canvas;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.setAttribute("aria-hidden", "true");
  container.prepend(canvas);

  const cardVertex = `#version 300 es
    in vec3 position;
    in vec2 uv;
    uniform vec4 uRect;
    uniform vec2 uResolution;
    out vec2 vUv;
    out vec2 vLocal;
    void main() {
      vUv = uv;
      vLocal = vec2(position.x, -position.y) * uRect.zw;
      vec2 px = uRect.xy + vLocal;
      gl_Position = vec4(px.x / uResolution.x * 2.0 - 1.0, 1.0 - px.y / uResolution.y * 2.0, 0.0, 1.0);
    }`;

  const cardFragment = `#version 300 es
    precision highp float;
    uniform sampler2D tMap;
    uniform vec2 uSize;
    uniform vec2 uImage;
    uniform float uRadius;
    uniform float uAlpha;
    uniform float uReady;
    uniform float uShift;
    uniform float uDpr;
    uniform vec3 uPlaceholder;
    in vec2 vUv;
    in vec2 vLocal;
    out vec4 fragColor;
    float roundedBox(vec2 p, vec2 b, float r) {
      vec2 q = abs(p) - b + r;
      return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
    }
    void main() {
      float sd = roundedBox(vLocal, uSize * 0.5, min(uRadius, min(uSize.x, uSize.y) * 0.5));
      float mask = clamp(0.5 - sd * uDpr, 0.0, 1.0);
      vec2 local = vLocal / uSize + 0.5;
      float cardAspect = uSize.x / uSize.y;
      float imageAspect = uImage.x / max(uImage.y, 1.0);
      vec2 scale = imageAspect > cardAspect ? vec2(cardAspect / imageAspect, 1.0) : vec2(1.0, imageAspect / cardAspect);
      scale /= 1.08;
      vec2 uv = vec2(local.x, 1.0 - local.y);
      uv = (uv - 0.5) * scale + 0.5;
      uv.x += uShift * (1.0 - scale.x) * 0.5;
      vec3 image = texture(tMap, uv).rgb;
      vec3 color = mix(uPlaceholder, image, uReady);
      float alpha = mask * uAlpha;
      fragColor = vec4(color * alpha, alpha);
    }`;

  const lensVertex = `#version 300 es
    in vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }`;

  const lensFragment = `#version 300 es
    precision highp float;
    uniform sampler2D tScene;
    uniform vec2 uResolution;
    uniform float uDpr;
    uniform vec2 uCenter;
    uniform vec2 uHalf;
    uniform float uAngle;
    uniform float uExponent;
    uniform float uInner;
    uniform float uOuter;
    uniform float uFlow;
    uniform float uCurl;
    uniform float uDispersion;
    uniform float uStrength;
    uniform float uSceneAlpha;
    out vec4 fragColor;
    void main() {
      vec2 frag = gl_FragCoord.xy / uDpr;
      vec2 uv = frag / uResolution;
      vec2 rel = frag - vec2(uCenter.x, uResolution.y - uCenter.y);
      float ca = cos(uAngle);
      float sa = sin(uAngle);
      vec2 local = vec2(ca * rel.x + sa * rel.y, -sa * rel.x + ca * rel.y);
      vec2 k = max(abs(local) / uHalf, vec2(1e-5));
      float nd = pow(pow(k.x, uExponent) + pow(k.y, uExponent), 1.0 / uExponent);
      vec2 grad = pow(k, vec2(uExponent - 1.0)) * sign(local) / uHalf * pow(nd, 1.0 - uExponent);
      float glen = max(length(grad), 1e-6);
      float edge = (nd - 1.0) / glen;
      vec2 outward = grad / glen;
      vec2 normal = vec2(ca * outward.x - sa * outward.y, sa * outward.x + ca * outward.y);
      vec2 along = vec2(-normal.y, normal.x);
      float t = clamp((edge + uInner) / (uInner + uOuter), 0.0, 1.0);
      float ramp = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
      float slope = 16.0 * t * t * (1.0 - t) * (1.0 - t);
      float reachX = rel.x / (uResolution.x * 0.5);
      float side = smoothstep(0.02, 0.3, abs(reachX)) * (uCurl == 0.0 ? sign(reachX) : uCurl);
      float lift = ramp * side * uFlow * uStrength;
      vec2 swirl = along * along.y * side * slope * uFlow * uStrength * 0.35;
      vec2 drift = vec2(0.0, -lift) - swirl;
      vec2 shifted = uv + drift / uResolution;
      vec2 texels = uResolution * uDpr;
      vec2 gx = dFdx(shifted);
      vec2 gy = dFdy(shifted);
      gx *= min(1.0, 3.0 / max(length(gx * texels), 1e-4));
      gy *= min(1.0, 3.0 / max(length(gy * texels), 1e-4));
      vec4 color = textureGrad(tScene, shifted, gx, gy);
      vec2 spread = vec2(0.0, side * slope * uFlow * uStrength) / uResolution * uDispersion;
      float spreadPx = length(spread * texels);
      if (color.a > 0.002 && spreadPx > 0.25) {
        vec3 base = color.rgb / color.a;
        vec3 sumColor = vec3(0.0);
        vec3 sumWeight = vec3(0.0);
        for (int i = 0; i < ${TAPS}; i++) {
          float s = (float(i) + 0.5) / float(${TAPS});
          vec4 c = textureGrad(tScene, shifted + spread * (s - 0.5), gx, gy);
          vec3 w = max(1.0 - abs(vec3(s) - vec3(0.15, 0.5, 0.85)) * 2.6, 0.0) * c.a;
          sumColor += c.rgb * (w / max(c.a, 0.002));
          sumWeight += w;
        }
        vec3 split = mix(base, sumColor / max(sumWeight, vec3(1e-4)), clamp(sumWeight * 2.0, 0.0, 1.0));
        color.rgb = mix(color.rgb, clamp(split, 0.0, 1.0) * color.a, smoothstep(0.25, 1.5, spreadPx));
      }
      fragColor = color * uSceneAlpha;
    }`;

  const cardProgram = new Program(gl, {
    vertex: cardVertex,
    fragment: cardFragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tMap: { value: new Texture(gl) },
      uRect: { value: [0, 0, 1, 1] },
      uResolution: { value: [1, 1] },
      uSize: { value: [1, 1] },
      uImage: { value: [1, 1] },
      uRadius: { value: 16 },
      uAlpha: { value: 1 },
      uReady: { value: 0 },
      uShift: { value: 0 },
      uDpr: { value: 1 },
      uPlaceholder: { value: [0.5, 0.5, 0.5] },
    },
  });
  cardProgram.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const cardMesh = new Mesh(gl, {
    geometry: new Plane(gl),
    program: cardProgram,
  });

  const target = new RenderTarget(gl, {
    width: 2,
    height: 2,
    depth: false,
    minFilter: gl.LINEAR_MIPMAP_LINEAR,
    magFilter: gl.LINEAR,
  });

  const lensUniforms = {
    tScene: { value: target.texture },
    uResolution: { value: [1, 1] },
    uDpr: { value: 1 },
    uCenter: { value: [0, 0] },
    uHalf: { value: [1, 1] },
    uAngle: { value: 0 },
    uExponent: { value: 2 },
    uInner: { value: 60 },
    uOuter: { value: 80 },
    uFlow: { value: 0 },
    uCurl: { value: 0 },
    uDispersion: { value: 0 },
    uStrength: { value: 0 },
    uSceneAlpha: { value: 0 },
  };
  const lensMesh = new Mesh(gl, {
    geometry: new Triangle(gl),
    program: new Program(gl, {
      vertex: lensVertex,
      fragment: lensFragment,
      uniforms: lensUniforms,
      depthTest: false,
      depthWrite: false,
    }),
  });

  const anisotropy = renderer.getExtension("EXT_texture_filter_anisotropic")
    ? 8
    : 0;

  // Add captions UI
  const captionEl = document.createElement("div");
  captionEl.className = "flex-carousel__caption";
  const titleEl = document.createElement("span");
  titleEl.className = "flex-carousel__title";
  captionEl.appendChild(titleEl);
  container.appendChild(captionEl);

  let slots = [];
  let width = 1,
    height = 1,
    pos = 0,
    vel = 0,
    goal = 0,
    mode = "spring";
  let raf = 0,
    last = performance.now();
  let visible = true,
    alive = true,
    dirty = true;
  let activeIndex = -1,
    autoplayAt = performance.now(),
    interactedAt = -Infinity;
  let deform = 0,
    deformVel = 0,
    layout = null,
    resnap = false;
  let hover = "",
    lift = 1,
    energy = 0,
    lastPos = 0;
  const lens = { x: 0, y: 0, vx: 0, vy: 0, ready: false };
  const pointer = {
    x: 0,
    y: 0,
    over: false,
    down: false,
    id: -1,
    startX: 0,
    startPos: 0,
    dragging: false,
    touch: false,
    samples: [],
  };
  const introState = {
    kind: "none",
    t: 0,
    running: false,
    done: false,
    readyAt: 0,
  };
  const focus = { index: -1, pending: -1, t: 0, v: 0, target: 0 };
  let instances = [];

  const loadSlot = (item, index) => {
    const texture = new Texture(gl, {
      generateMipmaps: true,
      minFilter: gl.LINEAR_MIPMAP_LINEAR,
      magFilter: gl.LINEAR,
      anisotropy,
    });
    const slot = {
      item,
      index,
      texture,
      aspect: 0.8,
      loaded: false,
      failed: false,
      ready: 0,
      color: [0.5, 0.5, 0.5],
      image: [1, 1],
    };
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      texture.image = image;
      texture.update();
      slot.image = [image.naturalWidth || 1, image.naturalHeight || 1];
      slot.aspect = slot.image[0] / slot.image[1];
      slot.loaded = true;
      dirty = true;
      start();
    };
    image.onerror = () => {
      slot.failed = true;
      dirty = true;
      start();
    };
    image.src = item.src;
    return slot;
  };
  slots = items.map(loadSlot);

  introState.readyAt = performance.now();

  const metrics = () => {
    const cardH = Math.max(24, s.cardHeight * height);
    const fixed = FIT_ASPECT[s.fit];
    const widths = slots.map((slot) => (fixed || slot.aspect) * cardH);
    const centers = [];
    let cursor = 0;
    for (let i = 0; i < widths.length; i++) {
      centers.push(cursor + widths[i] / 2);
      cursor += widths[i] + s.gap;
    }
    return { cardH, widths, centers, gap: s.gap, loop: Math.max(cursor, 1) };
  };

  const nearest = (m, at) => {
    let best = 0,
      bestDist = Infinity;
    for (let i = 0; i < m.centers.length; i++) {
      const dist = Math.abs(wrap(m.centers[i] - at, m.loop));
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  };

  const snapPoint = (m, at) => {
    const i = nearest(m, at);
    return at + wrap(m.centers[i] - at, m.loop);
  };

  const remap = (from, to, at) => {
    const i = nearest(from, at);
    const offset = wrap(at - from.centers[i], from.loop);
    const cycles = Math.round((at - offset - from.centers[i]) / from.loop);
    return (
      cycles * to.loop +
      to.centers[i] +
      offset * (to.widths[i] / from.widths[i])
    );
  };

  const step = (m, delta) => {
    let at = snapPoint(m, goal);
    let index = nearest(m, at);
    const n = m.centers.length;
    for (let k = 0; k < Math.abs(delta); k++) {
      const next = (index + (delta > 0 ? 1 : n - 1)) % n;
      const distance =
        delta > 0
          ? m.widths[index] / 2 + m.gap + m.widths[next] / 2
          : -(m.widths[next] / 2 + m.gap + m.widths[index] / 2);
      at += distance;
      index = next;
    }
    goal = at;
    mode = "spring";
    dirty = true;
    start();
  };

  const openFocus = (index) => {
    focus.index = index;
    focus.pending = -1;
    focus.target = 1;
    dirty = true;
    start();
  };
  const closeFocus = () => {
    focus.pending = -1;
    if (focus.target === 0) return false;
    focus.target = 0;
    dirty = true;
    start();
    return true;
  };
  const skipIntro = () => {
    if (introState.running) introState.t = 1;
  };

  const introEffects = () => {
    const t = introState.running ? introState.t : introState.done ? 1 : 0;
    const e = { sceneAlpha: 1, strength: 1, card: null };
    if (!introState.done && !introState.running) {
      e.sceneAlpha = 0;
      e.strength = 0;
      return e;
    }
    if (t >= 1) return e;
    const kind = introState.kind;
    if (kind === "rise") {
      e.strength = easeInOut((t - 0.3) / 0.65);
      e.card = (rel) => {
        const delay = Math.min(Math.abs(rel) / (width * 0.6), 1) * 0.34;
        const local = clamp01((t - delay) / 0.6);
        return {
          alpha: clamp01(local * 4),
          x: 0,
          y: (1 - easeOutQuint(local)) * height * 0.62,
          scale: 0.5 + 0.5 * easeInOut((local - 0.18) / 0.82),
        };
      };
    } else {
      e.sceneAlpha = easeOut(t);
      e.strength = easeOut(t);
    }
    return e;
  };

  const beginIntro = (m) => {
    introState.kind = s.intro;
    introState.running = true;
    introState.done = false;
    introState.t = 0;
  };

  const resize = () => {
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    renderer.dpr = Math.min(
      window.devicePixelRatio || 1,
      2,
      Math.sqrt(PIXEL_BUDGET / (width * height)),
    );
    renderer.setSize(width, height);
    target.setSize(
      Math.max(2, Math.round(width * renderer.dpr)),
      Math.max(2, Math.round(height * renderer.dpr)),
    );
    lensUniforms.tScene.value = target.texture;
    dirty = true;
    start();
  };

  const frame = (now) => {
    raf = 0;
    if (!alive) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    if (!slots.length) {
      if (visible) raf = requestAnimationFrame(frame);
      return;
    }

    const m = metrics();
    const n = slots.length;
    let animating = false;

    if (resnap) {
      goal = snapPoint(m, goal);
      pos = goal;
      vel = 0;
      resnap = false;
    } else if (layout && layout.loop !== m.loop) {
      pos = remap(layout, m, pos);
      goal = remap(layout, m, goal);
      pointer.startPos = pos + (pointer.x - pointer.startX);
      animating = true;
    }
    layout = m;

    if (!introState.running && !introState.done) {
      const allSettled = slots.every((slot) => slot.loaded || slot.failed);
      if (allSettled || now - introState.readyAt > 3500) {
        goal = snapPoint(m, goal);
        pos = goal;
        beginIntro(m);
      }
    }
    if (introState.running) {
      introState.t = Math.min(
        1,
        introState.t + dt / (INTRO_DURATION[introState.kind] || 1),
      );
      if (introState.t >= 1) {
        introState.running = false;
        introState.done = true;
      }
      animating = true;
    }

    if (!pointer.dragging) {
      const stiffness = mode === "wheel" ? 80 : 55;
      const damping = 2 * Math.sqrt(stiffness);
      const steps = Math.ceil(dt / (1 / 240));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        const acc = stiffness * (goal - pos) - damping * vel;
        vel += acc * h;
        pos += vel * h;
      }
      if (Math.abs(goal - pos) < 0.05 && Math.abs(vel) < 0.5) {
        pos = goal;
        vel = 0;
      } else animating = true;
    } else animating = true;

    if (Math.abs(pos) > m.loop * 8) {
      const shift = Math.round(pos / m.loop) * m.loop;
      pos -= shift;
      goal -= shift;
      pointer.startPos -= shift;
    }

    const current = nearest(m, pos);
    if (current !== activeIndex) {
      activeIndex = current;
      // Update Title UI
      const currItem = items[current];
      if (currItem && introState.done) {
        titleEl.innerHTML = `${currItem.title}<br/><span class="flex-carousel__subtitle">${currItem.subtitle || ""}</span>`;
      }
    }

    if (
      focus.pending >= 0 &&
      mode === "spring" &&
      Math.abs(goal - pos) < 1.5 &&
      Math.abs(vel) < 30
    ) {
      if (current === focus.pending) openFocus(current);
      else focus.pending = -1;
    }

    const travel = Math.abs(pos - lastPos) / dt;
    lastPos = pos;
    const energyTarget = Math.min(travel / 2600, 1);
    energy +=
      (energyTarget - energy) *
      (1 - Math.exp(-dt / (energyTarget > energy ? 0.07 : 0.35)));
    if (energy > 0.001) animating = true;
    const liquidAmount = s.liquid;
    const push = Math.max(-1, Math.min(1, vel / 2200));
    const deformStiffness = 120;
    const deformDamping = 2 * Math.sqrt(deformStiffness) * 0.32;
    deformVel +=
      (deformStiffness * (push - deform) - deformDamping * deformVel) * dt;
    deform += deformVel * dt;
    if (Math.abs(deform) > 0.0005 || Math.abs(deformVel) > 0.005)
      animating = true;

    const focusStiffness = 64;
    focus.v +=
      (focusStiffness * (focus.target - focus.t) -
        2 * Math.sqrt(focusStiffness) * focus.v) *
      dt;
    focus.t += focus.v * dt;
    if (
      Math.abs(focus.target - focus.t) < 0.0005 &&
      Math.abs(focus.v) < 0.001
    ) {
      focus.t = focus.target;
      focus.v = 0;
    } else animating = true;
    const focusAmount = clamp01(focus.t);
    const focusEase = easeInOut(focusAmount);
    const focusW =
      focus.index >= 0 && focus.index < n ? m.widths[focus.index] : m.cardH;
    const focusScale = Math.max(
      1,
      Math.min(1.3, (height * 0.84) / m.cardH, (width * 0.92) / focusW),
    );
    const nextLift = 1 + (focusScale - 1) * focusEase;
    if (Math.abs(nextLift - lift) > 0.0005) {
      lift = nextLift;
      container.style.setProperty("--flex-carousel-lift", lift.toFixed(4));
    }

    const effects = introEffects();
    const homeX = width / 2;
    const homeY = height / 2;
    if (!lens.ready) {
      lens.x = homeX;
      lens.y = homeY;
      lens.ready = true;
    }

    const lensK = 110;
    const lensC = 2 * Math.sqrt(lensK) * 0.8;
    lens.vx += (lensK * (homeX - lens.x) - lensC * lens.vx) * dt;
    lens.vy += (lensK * (homeY - lens.y) - lensC * lens.vy) * dt;
    lens.x += lens.vx * dt;
    lens.y += lens.vy * dt;
    if (
      Math.abs(homeX - lens.x) + Math.abs(homeY - lens.y) > 0.2 ||
      Math.abs(lens.vx) + Math.abs(lens.vy) > 0.5
    )
      animating = true;

    const cardH = m.cardH;
    let halfW = (s.lensWidth * width) / 2;
    let halfH = (s.lensHeight * width) / 2;
    const squash = Math.abs(deform) * liquidAmount;
    halfW *= 1 + squash * 0.16;
    halfH *= 1 - squash * 0.08;
    const lensX = lens.x - deform * 14 * liquidAmount;

    for (let i = 0; i < n; i++) {
      const slot = slots[i];
      if (slot.loaded && slot.ready < 1) {
        slot.ready = Math.min(1, slot.ready + dt / 0.45);
        animating = true;
      }
    }

    if (dirty || animating || pointer.dragging) {
      dirty = false;
      instances = [];
      const dpr = renderer.dpr;
      cardProgram.uniforms.uResolution.value = [width, height];
      cardProgram.uniforms.uDpr.value = dpr;
      cardProgram.uniforms.uRadius.value = s.radius;
      const shrink = 1 - clamp01(s.squeeze) * energy;
      const draws = [];
      for (let i = 0; i < n; i++) {
        const w = m.widths[i];
        const baseRel = wrap(m.centers[i] - pos, m.loop);
        for (let k = -3; k <= 3; k++) {
          const rel = baseRel + k * m.loop;
          if (Math.abs(rel) - w / 2 > width + 40) continue;
          const fx = effects.card ? effects.card(rel) : null;
          let x = homeX + rel + (fx ? fx.x : 0);
          let scale = shrink * (fx ? fx.scale : 1);
          let alpha = fx ? fx.alpha : 1;
          if (focusAmount > 0) {
            if (i === focus.index && Math.abs(rel) < w) {
              scale *= 1 + (focusScale - 1) * focusEase;
            } else {
              const order = Math.min(Math.abs(rel) / width, 1) * 0.25;
              const part = easeInOut(focusAmount * 1.25 - order);
              x += Math.sign(rel) * part * width * 0.7;
              alpha *= 1 - part;
            }
          }
          const cw = w * scale;
          if (alpha <= 0.001 || x + cw / 2 < -40 || x - cw / 2 > width + 40)
            continue;
          draws.push({
            i,
            rel,
            x,
            y: homeY + (fx ? fx.y : 0),
            cw,
            ch: cardH * scale,
            alpha,
          });
        }
      }
      draws.sort((a, b) => Math.abs(b.rel) - Math.abs(a.rel));
      let first = true;
      for (const draw of draws) {
        const slot = slots[draw.i];
        cardProgram.uniforms.tMap.value = slot.texture;
        cardProgram.uniforms.uRect.value = [
          draw.x,
          draw.y,
          draw.cw + 2,
          draw.ch + 2,
        ];
        cardProgram.uniforms.uSize.value = [draw.cw, draw.ch];
        cardProgram.uniforms.uImage.value = slot.image;
        cardProgram.uniforms.uAlpha.value = draw.alpha;
        cardProgram.uniforms.uReady.value = slot.ready;
        cardProgram.uniforms.uShift.value = Math.max(
          -1,
          Math.min(1, draw.rel / (width * 0.75)),
        );
        cardProgram.uniforms.uPlaceholder.value = slot.color;
        renderer.render({ scene: cardMesh, target, clear: first });
        first = false;
        instances.push({
          index: draw.i,
          x0: draw.x - draw.cw / 2,
          x1: draw.x + draw.cw / 2,
          y0: draw.y - draw.ch / 2,
          y1: draw.y + draw.ch / 2,
        });
      }
      if (first) {
        renderer.bindFramebuffer(target);
        gl.viewport(0, 0, target.width, target.height);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      renderer.bindFramebuffer();
      target.texture.bind();
      gl.generateMipmap(gl.TEXTURE_2D);

      lensUniforms.uResolution.value = [width, height];
      lensUniforms.uDpr.value = dpr;
      lensUniforms.uCenter.value = [lensX, lens.y];
      lensUniforms.uHalf.value = [Math.max(halfW, 1), Math.max(halfH, 1)];
      lensUniforms.uAngle.value = (s.tilt * Math.PI) / 180;
      lensUniforms.uExponent.value =
        2 + Math.pow(1 - clamp01(s.roundness), 1.5) * 10;
      const spanW = Math.max(halfW, 1);
      const spanH = Math.max(halfH, 1);
      const inner = Math.max(4, s.reach * (spanW + spanH) * 0.5);
      lensUniforms.uInner.value = inner;
      lensUniforms.uOuter.value = inner * 1.6;
      lensUniforms.uFlow.value = s.bend * (spanW + spanH) * 0.45;
      lensUniforms.uCurl.value =
        s.curl === "rise" ? 1 : s.curl === "fall" ? -1 : 0;
      lensUniforms.uDispersion.value =
        s.dispersion * 0.12 * (1 + Math.abs(deform) * liquidAmount * 1.2);
      lensUniforms.uStrength.value = effects.strength * (1 - focusEase);
      lensUniforms.uSceneAlpha.value = effects.sceneAlpha;
      renderer.render({ scene: lensMesh });
    }

    let nextHover = "";
    if (
      pointer.over &&
      !pointer.dragging &&
      introState.done &&
      s.focusOnClick
    ) {
      const hit = instances.find(
        (inst) =>
          pointer.x >= inst.x0 &&
          pointer.x <= inst.x1 &&
          pointer.y >= inst.y0 &&
          pointer.y <= inst.y1,
      );
      if (focus.target > 0) nextHover = "close";
      else if (hit) nextHover = "open";
    }
    if (nextHover !== hover) {
      hover = nextHover;
      if (hover) container.setAttribute("data-hover", hover);
      else container.removeAttribute("data-hover");
    }

    if (visible && (animating || !introState.done || dirty || pointer.down))
      raf = requestAnimationFrame(frame);
  };

  const start = () => {
    if (raf || !visible || !alive) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const localPoint = (e) => {
    const rect = container.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const onPointerDown = (e) => {
    skipIntro();
    const [x, y] = localPoint(e);
    pointer.down = true;
    pointer.id = e.pointerId;
    pointer.touch = e.pointerType === "touch";
    pointer.startX = x;
    pointer.x = x;
    pointer.startPos = pos;
    pointer.dragging = false;
    pointer.samples = [{ x, t: performance.now() }];
    if (Math.abs(vel) > 40) {
      goal = pos;
      vel = 0;
    }
    dirty = true;
    start();
  };

  const onPointerMove = (e) => {
    const [x, y] = localPoint(e);
    pointer.x = x;
    pointer.over = true;
    if (pointer.down && e.pointerId === pointer.id) {
      const dx = x - pointer.startX;
      if (!pointer.dragging && Math.abs(dx) > 5) {
        pointer.dragging = true;
        pointer.startX = x;
        pointer.startPos = pos;
        closeFocus();
        container.setAttribute("data-dragging", "");
      }
      if (pointer.dragging) {
        pos = pointer.startPos - (x - pointer.startX);
        goal = pos;
        vel = 0;
        pointer.samples.push({ x, t: performance.now() });
      }
    }
    dirty = true;
    start();
  };

  const onPointerUp = (e) => {
    if (!pointer.down || e.pointerId !== pointer.id) return;
    pointer.down = false;
    container.removeAttribute("data-dragging");
    const m = metrics();
    if (pointer.dragging) {
      pointer.dragging = false;
      const now = performance.now();
      const first = pointer.samples[0],
        lastSample = pointer.samples[pointer.samples.length - 1];
      let velocity = 0;
      if (
        first &&
        lastSample &&
        lastSample.t > first.t &&
        now - lastSample.t < 70
      )
        velocity =
          -((lastSample.x - first.x) / (lastSample.t - first.t)) * 1000;
      vel = velocity;
      const landing = snapPoint(m, pos + velocity * 0.32);
      goal = landing;
      if (Math.abs(velocity) > 400 && Math.abs(landing - pos) < 1)
        step(m, velocity > 0 ? 1 : -1);
      mode = "spring";
      start();
      return;
    }
    if (closeFocus()) return;
    const [x, y] = localPoint(e);
    const hit = instances.find(
      (inst) => x >= inst.x0 && x <= inst.x1 && y >= inst.y0 && y <= inst.y1,
    );
    if (!hit) return;
    if (hit.index === activeIndex && Math.abs(goal - pos) < 2) {
      if (s.focusOnClick) openFocus(hit.index);
    } else {
      const rel = (hit.x0 + hit.x1) / 2 - width / 2;
      goal = snapPoint(m, pos + rel);
      mode = "spring";
      if (s.focusOnClick) focus.pending = hit.index;
      start();
    }
  };

  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerup", onPointerUp);
  container.addEventListener("pointerleave", () => {
    pointer.over = false;
    dirty = true;
    start();
  });
  window.addEventListener("resize", resize);
  resize();
}
