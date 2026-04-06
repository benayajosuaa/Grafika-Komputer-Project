function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

const RENDER_MODE = {
    lightingOnly: 0,
    textureOnly: 1,
    lightingAndTexture: 2
};

const VERTEX_SHADER = `
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUV;

    void main() {
        vUV = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
`;

const FRAGMENT_SHADER = `
    uniform vec3 lightPosition;
    uniform vec3 lightColor;
    uniform float ka;
    uniform float kd;
    uniform float ks;
    uniform float shininess;
    uniform vec3 baseColor;
    uniform sampler2D uTexture;
    uniform float useLightingWeight;
    uniform float useTextureWeight;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUV;

    void main() {
        vec3 n = normalize(vNormal);
        vec3 l = normalize(lightPosition - vWorldPosition);
        vec3 v = normalize(cameraPosition - vWorldPosition);
        vec3 r = reflect(-l, n);

        float diffuseTerm = max(dot(n, l), 0.0);
        float specularTerm = 0.0;
        if (diffuseTerm > 0.0) {
            specularTerm = pow(max(dot(v, r), 0.0), shininess);
        }

        vec3 ambient = ka * lightColor;
        vec3 diffuse = kd * lightColor * diffuseTerm;
        vec3 specular = ks * lightColor * specularTerm;
        vec3 lighting = ambient + diffuse + specular;

        vec3 texColor = texture2D(uTexture, vUV).rgb;
        vec3 shadedBase = mix(vec3(1.0), lighting, useLightingWeight);
        vec3 texturedBase = mix(vec3(1.0), texColor, useTextureWeight);
        vec3 finalColor = shadedBase * texturedBase * baseColor;

        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

export class ThreeJSRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);

        if (!this.container) {
            throw new Error(`Container element with ID "${containerId}" not found`);
        }

        this.width = this.container.clientWidth || 640;
        this.height = this.container.clientHeight || 640;
        this.currentGeometryMode = 'sphere';
        this.currentRenderMode = 'lightingAndTexture';
        this.activeMesh = null;
        this.autoRotate = false;
        this.isTouchDevice = 'ontouchstart' in window;
        this.controls = null;
        this.frameTimes = [];
        this.lastFrameTimestamp = performance.now();
        this.lastRenderTimeMs = 0;
        this.textureLoader = new THREE.TextureLoader();

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true
        });

        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setClearColor(0x1a1a2e);
        this.container.appendChild(this.renderer.domElement);
        this.canvas = this.renderer.domElement;
        this.canvas.style.touchAction = 'none';

        this.camera.position.set(0, 0, 2.8);

        this.lightState = {
            position: new THREE.Vector3(3, 4, 3),
            color: new THREE.Color(0xffffff)
        };

        this.lightArrow = new THREE.ArrowHelper(
            this.lightState.position.clone().normalize(),
            new THREE.Vector3(0, 0, 0),
            2.2,
            0xff4d4f,
            0.28,
            0.14
        );
        this.scene.add(this.lightArrow);

        this.material = this.createMaterial();
        this.setGeometryMode('sphere');

        this.updateInteractionHint();
        this.setupControls();
        this.setupResizeHandler();
        this.renderFrame();
        this.animate();
    }

    createCheckerTexture() {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const cells = 8;
        const cellSize = size / cells;

        for (let y = 0; y < cells; y += 1) {
            for (let x = 0; x < cells; x += 1) {
                context.fillStyle = (x + y) % 2 === 0 ? '#e2e8f0' : '#475569';
                context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        texture.needsUpdate = true;
        return texture;
    }

    createMaterial() {
        const defaultTexture = this.createCheckerTexture();

        this.uniforms = {
            lightPosition: { value: this.lightState.position.clone() },
            lightColor: { value: this.lightState.color.clone() },
            ka: { value: 0.25 },
            kd: { value: 0.75 },
            ks: { value: 0.35 },
            shininess: { value: 24.0 },
            baseColor: { value: new THREE.Color(0.8, 0.8, 0.8) },
            uTexture: { value: defaultTexture },
            useLightingWeight: { value: 1.0 },
            useTextureWeight: { value: 1.0 }
        };

        return new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER
        });
    }

    createProxyMesh(mode) {
        if (mode === 'cube') {
            const geometry = new THREE.BoxGeometry(1.6, 1.6, 1.6, 1, 1, 1);
            return new THREE.Mesh(geometry, this.material);
        }

        const geometry = new THREE.SphereGeometry(1, 96, 96);
        return new THREE.Mesh(geometry, this.material);
    }

    setGeometryMode(mode = 'sphere') {
        const nextMode = mode === 'cube' ? 'cube' : 'sphere';

        if (this.activeMesh) {
            this.scene.remove(this.activeMesh);
            if (this.activeMesh.geometry) {
                this.activeMesh.geometry.dispose();
            }
        }

        this.currentGeometryMode = nextMode;
        this.activeMesh = this.createProxyMesh(nextMode);
        this.activeMesh.rotation.x = -0.2;
        this.activeMesh.rotation.y = 0.5;
        this.scene.add(this.activeMesh);
        this.renderFrame();
    }

    setRenderMode(mode = 'lightingAndTexture') {
        const nextMode = RENDER_MODE[mode] != null ? mode : 'lightingAndTexture';
        this.currentRenderMode = nextMode;

        const lightingWeight = nextMode === 'textureOnly' ? 0.0 : 1.0;
        const textureWeight = nextMode === 'lightingOnly' ? 0.0 : 1.0;
        this.uniforms.useLightingWeight.value = lightingWeight;
        this.uniforms.useTextureWeight.value = textureWeight;
        this.renderFrame();
    }

    loadTexture(textureSource) {
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                textureSource,
                (texture) => {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.minFilter = THREE.LinearMipmapLinearFilter;
                    texture.magFilter = THREE.LinearFilter;
                    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
                    texture.needsUpdate = true;
                    this.uniforms.uTexture.value = texture;
                    this.renderFrame();
                    resolve(texture);
                },
                undefined,
                (error) => reject(error)
            );
        });
    }

    updateMaterial(params) {
        if (!params || !this.material) {
            return;
        }

        const [r, g, b] = params.albedo;
        const roughness = clamp01(params.roughness);
        const metallic = clamp01(params.metallic);
        this.uniforms.baseColor.value.setRGB(clamp01(r), clamp01(g), clamp01(b));

        // Keep the visualization Phong-style while letting BRDF parameters steer it.
        this.uniforms.ka.value = 0.18 + 0.22 * (1.0 - metallic);
        this.uniforms.kd.value = 0.55 + 0.35 * (1.0 - metallic);
        this.uniforms.ks.value = 0.15 + 0.7 * metallic;
        this.uniforms.shininess.value = 8.0 + (1.0 - roughness) * 120.0;
    }

    getShaderSources() {
        return {
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER
        };
    }

    updateInteractionHint() {
        const helpText = document.querySelector('.help-text');
        if (!helpText) {
            return;
        }

        helpText.textContent = this.isTouchDevice
            ? 'Drag to rotate | Pinch to zoom | Two fingers to pan'
            : 'Drag to rotate | Scroll to zoom | Space to toggle auto-rotate';
    }

    setupResizeHandler() {
        window.addEventListener('resize', () => {
            const width = this.container.clientWidth;
            const height = this.container.clientHeight;
            if (!width || !height) {
                return;
            }

            this.width = width;
            this.height = height;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            this.renderFrame();
        });
    }

    setupControls() {
        if (typeof THREE.OrbitControls === 'function') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableRotate = true;
            this.controls.enableZoom = true;
            this.controls.enablePan = true;
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.target.set(0, 0, 0);
            this.controls.touches = {
                ONE: THREE.TOUCH.ROTATE,
                TWO: THREE.TOUCH.DOLLY_PAN
            };
            this.controls.update();

            window.addEventListener('keydown', (event) => {
                if (this.isTouchDevice) {
                    return;
                }

                if (event.code === 'Space') {
                    event.preventDefault();
                    this.autoRotate = !this.autoRotate;
                    this.controls.autoRotate = this.autoRotate;
                }
            });
            return;
        }

        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };

        this.renderer.domElement.addEventListener('mousedown', (event) => {
            isDragging = true;
            previousMousePosition = { x: event.clientX, y: event.clientY };
        });

        this.renderer.domElement.addEventListener('mousemove', (event) => {
            if (!isDragging || !this.activeMesh) {
                return;
            }

            const deltaX = event.clientX - previousMousePosition.x;
            const deltaY = event.clientY - previousMousePosition.y;
            this.activeMesh.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.activeMesh.rotation.x - deltaY * 0.01));
            this.activeMesh.rotation.y += deltaX * 0.01;
            previousMousePosition = { x: event.clientX, y: event.clientY };
        });

        ['mouseup', 'mouseleave'].forEach((eventName) => {
            this.renderer.domElement.addEventListener(eventName, () => {
                isDragging = false;
            });
        });

        this.renderer.domElement.addEventListener('wheel', (event) => {
            event.preventDefault();
            this.camera.position.z = Math.max(1.4, Math.min(10, this.camera.position.z + event.deltaY * 0.001));
            this.renderFrame();
        }, { passive: false });
    }

    setLightingVariation(type = 'default') {
        const profiles = {
            default: {
                lightColor: 0xffffff,
                lightPosition: [3, 4, 3]
            },
            warm: {
                lightColor: 0xffe2b8,
                lightPosition: [3, 4, 2]
            },
            cool: {
                lightColor: 0xcfe8ff,
                lightPosition: [2, 4, 3]
            },
            dim: {
                lightColor: 0xd7dbe0,
                lightPosition: [3, 3, 3]
            },
            bright: {
                lightColor: 0xffffff,
                lightPosition: [3.5, 4.5, 2.5]
            }
        };

        const profile = profiles[type] || profiles.default;
        this.lightState.position.set(...profile.lightPosition);
        this.lightState.color.set(profile.lightColor);
        this.uniforms.lightPosition.value.copy(this.lightState.position);
        this.uniforms.lightColor.value.copy(this.lightState.color);
        this.lightArrow.setDirection(this.lightState.position.clone().normalize());
    }

    renderFrame() {
        const start = performance.now();
        this.renderer.render(this.scene, this.camera);
        this.lastRenderTimeMs = performance.now() - start;
        return this.lastRenderTimeMs;
    }

    captureNormalizedPixels(width = 64, height = 64) {
        const targetCanvas = document.createElement('canvas');
        targetCanvas.width = width;
        targetCanvas.height = height;
        const context = targetCanvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(this.canvas, 0, 0, width, height);
        const imageData = context.getImageData(0, 0, width, height);
        const pixels = [];

        for (let index = 0; index < imageData.data.length; index += 4) {
            pixels.push(
                imageData.data[index] / 255,
                imageData.data[index + 1] / 255,
                imageData.data[index + 2] / 255
            );
        }

        return pixels;
    }

    async renderSnapshot(parameters, options = {}) {
        const width = options.width || 64;
        const height = options.height || width;
        const previousAutoRotate = this.autoRotate;
        const previousRenderMode = this.currentRenderMode;

        this.autoRotate = false;
        if (this.controls) {
            this.controls.autoRotate = false;
            this.controls.update();
        }

        if (options.lightingType) {
            this.setLightingVariation(options.lightingType);
        }
        if (options.renderMode) {
            this.setRenderMode(options.renderMode);
        }

        this.updateMaterial(parameters);
        const renderTimeMs = this.renderFrame();
        const pixels = this.captureNormalizedPixels(width, height);

        this.autoRotate = previousAutoRotate;
        if (this.controls) {
            this.controls.autoRotate = previousAutoRotate;
        }
        this.setRenderMode(previousRenderMode);

        return {
            pixels,
            renderTimeMs
        };
    }

    profilePerformance() {
        const averageFrameTime = this.frameTimes.length > 0
            ? this.frameTimes.reduce((acc, value) => acc + value, 0) / this.frameTimes.length
            : this.lastRenderTimeMs;

        return {
            avg_frame_time_ms: averageFrameTime,
            fps: averageFrameTime > 0 ? 1000 / averageFrameTime : null,
            last_render_time_ms: this.lastRenderTimeMs
        };
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const now = performance.now();
        const delta = now - this.lastFrameTimestamp;
        this.lastFrameTimestamp = now;

        if (this.controls) {
            this.controls.update();
        } else if (this.autoRotate && this.activeMesh) {
            this.activeMesh.rotation.y += 0.01;
        }

        this.renderFrame();

        if (delta > 0 && Number.isFinite(delta)) {
            this.frameTimes.push(delta);
            if (this.frameTimes.length > 120) {
                this.frameTimes.shift();
            }
        }
    }
}
