function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

const RENDER_MODE = {
    lightingOnly: 0,
    textureOnly: 1,
    lightingAndTexture: 2
};

const VERTEX_SHADER = `
    uniform float surfaceProfile;
    uniform float detailScale;
    uniform float displacementScale;
    uniform vec2 grainDirection;

    varying vec3 vWorldPosition;
    varying vec3 vLocalPosition;
    varying vec3 vNormal;
    varying vec2 vUV;
    varying float vDetailMask;

    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);

        return mix(
            mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
        );
    }

    float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;

        for (int octave = 0; octave < 4; octave += 1) {
            value += amplitude * noise(p);
            p *= 2.03;
            amplitude *= 0.5;
        }

        return value;
    }

    void main() {
        vUV = uv;
        vec2 scaledUv = uv * detailScale;
        vec2 grainUv = vec2(
            dot(scaledUv, normalize(grainDirection + vec2(0.001, 0.001))),
            dot(scaledUv, normalize(vec2(-grainDirection.y, grainDirection.x) + vec2(0.001, 0.001)))
        );
        float fiber = sin(grainUv.x * 10.0) * 0.5 + 0.5;
        float detailNoise = fbm(scaledUv + position.xy * 0.35);
        float materialMask = detailNoise;

        if (surfaceProfile < 1.5) {
            materialMask = mix(detailNoise, fiber, 0.55);
        } else if (surfaceProfile < 2.5) {
            materialMask = mix(detailNoise, sin(grainUv.x * 18.0) * 0.5 + 0.5, 0.28);
        } else if (surfaceProfile < 3.5) {
            materialMask = mix(detailNoise, sin(grainUv.x * 7.0 + detailNoise * 3.0) * 0.5 + 0.5, 0.45);
        } else if (surfaceProfile < 4.5) {
            materialMask = mix(detailNoise, sin(grainUv.x * 14.0) * 0.5 + 0.5, 0.18);
        }

        float centeredMask = materialMask * 2.0 - 1.0;
        vec3 displacedPosition = position + normal * centeredMask * displacementScale;
        vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
        vWorldPosition = worldPosition.xyz;
        vLocalPosition = displacedPosition;
        vNormal = normalize(normalMatrix * normal);
        vDetailMask = materialMask;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
`;

const FRAGMENT_SHADER = `
    uniform vec3 lightPosition;
    uniform vec3 lightColor;
    uniform float lightIntensity;
    uniform float opacity;
    uniform float ior;
    uniform float glassMode;
    uniform float ka;
    uniform float kd;
    uniform float ks;
    uniform float shininess;
    uniform vec3 baseColor;
    uniform sampler2D uTexture;
    uniform float useLightingWeight;
    uniform float useTextureWeight;
    uniform float surfaceProfile;
    uniform float detailScale;
    uniform float detailContrast;
    uniform float textureRepeat;
    uniform float sheenStrength;
    uniform float specularBoost;
    uniform float bumpIntensity;
    uniform float albedoInfluence;
    uniform vec3 sheenTint;
    uniform vec3 textureMean;
    uniform vec2 grainDirection;
    uniform vec3 hemiSkyColor;
    uniform vec3 hemiGroundColor;
    uniform float hemiIntensity;

    varying vec3 vWorldPosition;
    varying vec3 vLocalPosition;
    varying vec3 vNormal;
    varying vec2 vUV;
    varying float vDetailMask;

    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);

        return mix(
            mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
        );
    }

    float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;

        for (int octave = 0; octave < 5; octave += 1) {
            value += amplitude * noise(p);
            p *= 2.02;
            amplitude *= 0.5;
        }

        return value;
    }

    vec3 sampleTriplanar(sampler2D textureSampler, vec3 position, vec3 normal, float scale) {
        vec3 blending = abs(normal);
        blending = pow(blending, vec3(5.0));
        blending /= max(blending.x + blending.y + blending.z, 1e-5);

        vec2 xAxisUv = position.yz * scale;
        vec2 yAxisUv = position.xz * scale;
        vec2 zAxisUv = position.xy * scale;

        vec3 xSample = texture2D(textureSampler, xAxisUv).rgb;
        vec3 ySample = texture2D(textureSampler, yAxisUv).rgb;
        vec3 zSample = texture2D(textureSampler, zAxisUv).rgb;

        return xSample * blending.x + ySample * blending.y + zSample * blending.z;
    }

    vec3 acesTonemap(vec3 color) {
        const float a = 2.51;
        const float b = 0.03;
        const float c = 2.43;
        const float d = 0.59;
        const float e = 0.14;
        return clamp((color * (a * color + b)) / (color * (c * color + d) + e), 0.0, 1.0);
    }

    vec3 applyGamma(vec3 color) {
        return pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));
    }

    void main() {
        vec3 localPosition = vLocalPosition * 0.85;
        vec2 baseUv = vUV * detailScale;
        vec2 triPlanarUv = localPosition.xy * detailScale;
        vec2 scaledUv = mix(baseUv, triPlanarUv, 0.65);
        vec2 grainUv = vec2(
            dot(scaledUv, normalize(grainDirection + vec2(0.001, 0.001))),
            dot(scaledUv, normalize(vec2(-grainDirection.y, grainDirection.x) + vec2(0.001, 0.001)))
        );
        float detailNoise = fbm(scaledUv + localPosition.xy * 0.8);
        float fiber = sin(grainUv.x * 12.0 + detailNoise * 2.4) * 0.5 + 0.5;
        float brushed = sin(grainUv.x * 22.0 + detailNoise * 1.8) * 0.5 + 0.5;
        float pores = smoothstep(0.35, 0.95, fbm(scaledUv * 1.5 + vec2(4.2, 1.7)));
        float woodGrain = sin(grainUv.x * 6.0 + fbm(grainUv * 0.7) * 5.5) * 0.5 + 0.5;
        float crossFiber = sin(grainUv.y * 24.0 + detailNoise * 4.0) * 0.5 + 0.5;

        float detailMask = mix(vDetailMask, detailNoise, 0.5);
        vec3 normalPerturbation = vec3((detailNoise - 0.5) * bumpIntensity, (fiber - 0.5) * bumpIntensity, 0.0);

        if (surfaceProfile < 1.5) {
            normalPerturbation = vec3((crossFiber - 0.5) * bumpIntensity * 1.4, (fiber - 0.5) * bumpIntensity * 1.8, 0.0);
        } else if (surfaceProfile < 2.5) {
            normalPerturbation = vec3((brushed - 0.5) * bumpIntensity * 0.55, (detailNoise - 0.5) * bumpIntensity * 0.35, 0.0);
        } else if (surfaceProfile < 3.5) {
            normalPerturbation = vec3((woodGrain - 0.5) * bumpIntensity * 1.4, (detailNoise - 0.5) * bumpIntensity * 0.65, 0.0);
        }

        vec3 n = normalize(vNormal + normalPerturbation);
        vec3 l = normalize(lightPosition - vWorldPosition);
        vec3 v = normalize(cameraPosition - vWorldPosition);
        vec3 r = reflect(-l, n);
        vec3 effectiveLightColor = lightColor * lightIntensity;
        vec3 h = normalize(l + v);
        float eta = max(1.0, ior);
        float fresnelBase = pow((eta - 1.0) / (eta + 1.0), 2.0);
        float fresnel = fresnelBase + (1.0 - fresnelBase) * pow(1.0 - max(dot(n, v), 0.0), 5.0);

        float diffuseTerm = max(dot(n, l), 0.0);
        float specularTerm = 0.0;
        if (diffuseTerm > 0.0) {
            specularTerm = pow(max(dot(v, r), 0.0), shininess);
        }

        vec3 texColor = sampleTriplanar(uTexture, localPosition, n, textureRepeat);
        vec3 normalizedTexture = clamp(texColor / max(textureMean, vec3(0.08)), 0.0, 2.0);
        float textureLuma = dot(normalizedTexture, vec3(0.299, 0.587, 0.114));
        vec3 neutralDetail = vec3(mix(0.72, 1.28, clamp(textureLuma, 0.0, 1.0)));
        vec3 detailTexture = mix(vec3(1.0), neutralDetail, albedoInfluence);
        vec3 profileTexture = detailTexture;
        float profileSpecularBoost = specularBoost;
        float sheen = 0.0;

        if (surfaceProfile < 1.5) {
            float weave = mix(detailMask, fiber, 0.65);
            profileTexture = detailTexture * mix(0.82, 1.12, pow(weave, detailContrast));
            profileSpecularBoost *= 0.55;
            float rimFresnel = pow(1.0 - max(dot(n, v), 0.0), 3.2);
            sheen = sheenStrength * rimFresnel * mix(0.6, 1.35, weave);
        } else if (surfaceProfile < 2.5) {
            float metalBand = mix(detailMask, brushed, 0.5);
            profileTexture = mix(detailTexture, vec3(dot(detailTexture, vec3(0.299, 0.587, 0.114))), 0.28);
            profileTexture *= mix(0.9, 1.18, pow(metalBand, max(1.0, detailContrast)));
            profileSpecularBoost *= 1.9;
            sheen = sheenStrength * 0.25 * pow(max(dot(v, r), 0.0), 6.0);
        } else if (surfaceProfile < 3.5) {
            float grain = mix(detailMask, woodGrain, 0.72);
            profileTexture = detailTexture * mix(0.84, 1.14, grain);
            profileSpecularBoost *= 0.82;
            sheen = sheenStrength * 0.2 * grain;
        } else if (surfaceProfile < 4.5) {
            float glossy = mix(detailMask, brushed, 0.35);
            profileTexture = detailTexture * mix(0.94, 1.08, glossy);
            profileSpecularBoost *= 1.08;
            sheen = sheenStrength * 0.3 * pow(max(dot(v, r), 0.0), 4.0);
        } else {
            float granular = mix(detailMask, pores, 0.6);
            profileTexture = detailTexture * mix(0.8, 1.05, granular);
            profileSpecularBoost *= 0.46;
            specularTerm = pow(max(dot(v, r), 0.0), max(2.0, shininess * 0.52));
            sheen = sheenStrength * 0.15 * granular;
        }

        float hemiFactor = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 hemiAmbient = mix(hemiGroundColor, hemiSkyColor, hemiFactor) * hemiIntensity;
        vec3 ambient = ka * effectiveLightColor + hemiAmbient;
        vec3 diffuse = kd * effectiveLightColor * diffuseTerm;
        if (surfaceProfile > 1.5 && surfaceProfile < 2.5) {
            diffuse *= 0.52;
        }
        vec3 specularTint = mix(vec3(1.0), baseColor, surfaceProfile > 1.5 && surfaceProfile < 2.5 ? 0.35 : 0.18);
        vec3 specularColor = mix(effectiveLightColor, specularTint, clamp(surfaceProfile > 1.5 && surfaceProfile < 2.5 ? 0.55 : 0.08, 0.0, 1.0));
        vec3 specular = ks * profileSpecularBoost * specularColor * specularTerm;
        vec3 lighting = ambient + diffuse + specular;
        lighting += sheen * sheenTint;
        vec3 shadedBase = mix(vec3(1.0), lighting, useLightingWeight);
        vec3 texturedBase = mix(vec3(1.0), profileTexture, useTextureWeight);
        vec3 finalColor = shadedBase * texturedBase * baseColor;
        float transmission = mix(1.0, 0.3, glassMode);
        vec3 glassColor = mix(finalColor * transmission, vec3(1.0) * effectiveLightColor * fresnel * 1.25, clamp(glassMode, 0.0, 1.0));
        float alpha = mix(1.0, opacity, glassMode);
        vec3 mapped = acesTonemap(mix(finalColor, glassColor, glassMode));
        vec3 outputColor = applyGamma(mapped);
        gl_FragColor = vec4(outputColor, alpha);
    }
`;

const SURFACE_PROFILE_ID = {
    fabric: 1,
    metal: 2,
    wood: 3,
    plastic: 4,
    matte: 5
};

function createDefaultMaterialProfile() {
    return {
        key: 'matte',
        label: 'Matte Surface',
        description: 'Neutral diffuse preview.',
        detailScale: 5.5,
        textureRepeat: 1.6,
        displacementScale: 0.008,
        detailContrast: 1.15,
        sheenStrength: 0.08,
        specularBoost: 0.9,
        bumpIntensity: 0.06,
        sheenTint: [1.0, 1.0, 1.0],
        grainDirection: [1.0, 0.45]
    };
}

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
        this.meshes = {};
        this.multiviewMeshes = {};
        this.autoRotate = false;
        this.isTouchDevice = 'ontouchstart' in window;
        this.controls = null;
        this.frameTimes = [];
        this.lastFrameTimestamp = performance.now();
        this.lastRenderTimeMs = 0;
        this.lastSpecularMetricsTimestamp = 0;
        this.specularMetricsListener = null;
        this.textureLoader = new THREE.TextureLoader();
        this.materialProfile = createDefaultMaterialProfile();
        this.isMultiviewEnabled = false;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
        this.multiviewScene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true
        });
        this.multiviewContainer = document.getElementById('multiview-container');
        this.multiviewWidth = this.multiviewContainer?.clientWidth || 640;
        this.multiviewHeight = this.multiviewContainer?.clientHeight || 320;
        this.multiviewRenderer = null;
        this.multiviewCameras = {};

        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setClearColor(0x1a1a2e);
        this.container.appendChild(this.renderer.domElement);
        this.canvas = this.renderer.domElement;
        this.canvas.style.touchAction = 'none';
        this.offscreenTarget = new THREE.WebGLRenderTarget(256, 256, {
            depthBuffer: true,
            stencilBuffer: false
        });

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
        this.multiviewLightArrow = new THREE.ArrowHelper(
            this.lightState.position.clone().normalize(),
            new THREE.Vector3(0, 0, 0),
            2.2,
            0xff4d4f,
            0.28,
            0.14
        );
        this.multiviewLightArrow.visible = false;
        this.multiviewScene.add(this.multiviewLightArrow);

        this.material = this.createMaterial();
        this.initializeProxyMeshes();
        this.initializeMultiview();
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
            lightIntensity: { value: 1.0 },
            opacity: { value: 1.0 },
            ior: { value: 1.5 },
            glassMode: { value: 0.0 },
            ka: { value: 0.25 },
            kd: { value: 0.75 },
            ks: { value: 0.35 },
            shininess: { value: 24.0 },
            baseColor: { value: new THREE.Color(0.8, 0.8, 0.8) },
            uTexture: { value: defaultTexture },
            useLightingWeight: { value: 1.0 },
            useTextureWeight: { value: 1.0 },
            surfaceProfile: { value: SURFACE_PROFILE_ID.matte },
            detailScale: { value: this.materialProfile.detailScale },
            displacementScale: { value: this.materialProfile.displacementScale },
            detailContrast: { value: this.materialProfile.detailContrast },
            textureRepeat: { value: this.materialProfile.textureRepeat },
            sheenStrength: { value: this.materialProfile.sheenStrength },
            specularBoost: { value: this.materialProfile.specularBoost },
            bumpIntensity: { value: this.materialProfile.bumpIntensity },
            albedoInfluence: { value: 0.58 },
            sheenTint: { value: new THREE.Color(...this.materialProfile.sheenTint) },
            textureMean: { value: new THREE.Color(0.65, 0.65, 0.65) },
            grainDirection: { value: new THREE.Vector2(...this.materialProfile.grainDirection) },
            hemiSkyColor: { value: new THREE.Color(0.76, 0.82, 0.9) },
            hemiGroundColor: { value: new THREE.Color(0.26, 0.24, 0.22) },
            hemiIntensity: { value: 0.24 }
        };

        return new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            transparent: false,
            depthWrite: true
        });
    }

    createProxyMesh(mode) {
        if (mode === 'cube') {
            const geometry = new THREE.BoxGeometry(1.6, 1.6, 1.6, 30, 30, 30);
            return new THREE.Mesh(geometry, this.material);
        }

        const geometry = new THREE.SphereGeometry(1, 96, 96);
        return new THREE.Mesh(geometry, this.material);
    }

    initializeProxyMeshes() {
        this.meshes.sphere = this.createProxyMesh('sphere');
        this.meshes.cube = this.createProxyMesh('cube');

        Object.values(this.meshes).forEach((mesh) => {
            mesh.rotation.x = -0.2;
            mesh.rotation.y = 0.5;
            mesh.visible = false;
            this.scene.add(mesh);
        });
    }

    initializeMultiview() {
        if (!this.multiviewContainer) {
            return;
        }

        this.multiviewRenderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true
        });
        this.multiviewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.multiviewRenderer.setClearColor(0x101827);
        this.multiviewRenderer.setSize(this.multiviewWidth, this.multiviewHeight);
        this.multiviewContainer.appendChild(this.multiviewRenderer.domElement);

        this.multiviewMeshes.sphere = new THREE.Mesh(this.meshes.sphere.geometry, this.material);
        this.multiviewMeshes.cube = new THREE.Mesh(this.meshes.cube.geometry, this.material);

        Object.values(this.multiviewMeshes).forEach((mesh) => {
            mesh.rotation.x = -0.2;
            mesh.rotation.y = 0.5;
            mesh.visible = false;
            this.multiviewScene.add(mesh);
        });

        this.multiviewCameras.front = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
        this.multiviewCameras.side = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
        this.multiviewCameras.top = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
        this.multiviewCameras.perspective = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);

        this.multiviewCameras.front.position.set(0, 0, 3.4);
        this.multiviewCameras.side.position.set(3.4, 0, 0);
        this.multiviewCameras.top.position.set(0, 3.4, 0);
        this.multiviewCameras.perspective.position.set(2.35, 2.2, 2.35);

        this.multiviewCameras.front.lookAt(0, 0, 0);
        this.multiviewCameras.side.lookAt(0, 0, 0);
        this.multiviewCameras.top.lookAt(0, 0, 0);
        this.multiviewCameras.top.up.set(0, 0, -1);
        this.multiviewCameras.perspective.lookAt(0, 0, 0);
    }

    setMultiviewEnabled(enabled) {
        this.isMultiviewEnabled = enabled === true;
        if (this.multiviewRenderer && this.isMultiviewEnabled) {
            this.renderMultiview();
        }
    }

    getActiveMesh() {
        if (this.currentGeometryMode === 'cube') {
            return this.meshes.cube;
        }

        return this.meshes.sphere;
    }

    updateGeometryVisibility() {
        if (this.meshes.sphere) {
            this.meshes.sphere.visible = this.currentGeometryMode !== 'cube';
        }
        if (this.meshes.cube) {
            this.meshes.cube.visible = this.currentGeometryMode !== 'sphere';
        }
        if (this.multiviewMeshes.sphere) {
            this.multiviewMeshes.sphere.visible = this.currentGeometryMode !== 'cube';
        }
        if (this.multiviewMeshes.cube) {
            this.multiviewMeshes.cube.visible = this.currentGeometryMode !== 'sphere';
        }
    }

    syncMeshTransformsToMultiview() {
        Object.keys(this.meshes).forEach((key) => {
            if (!this.meshes[key] || !this.multiviewMeshes[key]) {
                return;
            }

            this.multiviewMeshes[key].position.copy(this.meshes[key].position);
            this.multiviewMeshes[key].rotation.copy(this.meshes[key].rotation);
            this.multiviewMeshes[key].scale.copy(this.meshes[key].scale);
        });
        this.multiviewLightArrow.setDirection(this.lightState.position.clone().normalize());
    }

    setGeometryMode(mode = 'sphere') {
        const nextMode = ['sphere', 'cube', 'compare'].includes(mode) ? mode : 'sphere';
        this.currentGeometryMode = nextMode;
        this.updateGeometryVisibility();
        this.syncMeshTransformsToMultiview();

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
        if (textureSource instanceof HTMLCanvasElement) {
            const texture = new THREE.CanvasTexture(textureSource);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
            texture.needsUpdate = true;
            this.uniforms.uTexture.value = texture;
            this.renderFrame();
            return Promise.resolve(texture);
        }

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

    setMaterialMode(mode = 'standard') {
        const glassEnabled = mode === 'glass';
        this.material.transparent = glassEnabled;
        this.material.depthWrite = !glassEnabled;
        this.material.needsUpdate = true;
        this.uniforms.glassMode.value = glassEnabled ? 1.0 : 0.0;
        this.renderFrame();
    }

    updateMaterial(params) {
        if (!params || !this.material) {
            return;
        }

        const [r, g, b] = params.albedo;
        const roughness = clamp01(params.roughness);
        const metallic = clamp01(params.metallic);
        const lightIntensity = Math.max(0.1, Math.min(5.0, params.lightIntensity ?? 1.0));
        const opacity = Math.max(0.0, Math.min(1.0, params.opacity ?? 1.0));
        const ior = Math.max(1.0, Math.min(2.5, params.ior ?? 1.5));
        const glassEnabled = params.materialMode === 'glass';
        this.uniforms.baseColor.value.setRGB(clamp01(r), clamp01(g), clamp01(b));
        this.uniforms.lightIntensity.value = lightIntensity;
        this.uniforms.opacity.value = opacity;
        this.uniforms.ior.value = ior;
        this.uniforms.glassMode.value = glassEnabled ? 1.0 : 0.0;
        this.uniforms.albedoInfluence.value = 0.45 + roughness * 0.2 + (1.0 - metallic) * 0.1;

        // Keep the visualization Phong-style while letting BRDF parameters steer it.
        this.uniforms.ka.value = 0.18 + 0.22 * (1.0 - metallic);
        this.uniforms.kd.value = 0.55 + 0.35 * (1.0 - metallic);
        this.uniforms.ks.value = 0.15 + 0.7 * metallic;
        this.uniforms.shininess.value = 8.0 + (1.0 - roughness) * 120.0;
        this.material.transparent = glassEnabled;
        this.material.depthWrite = !glassEnabled;

        const profileKey = this.materialProfile.key || 'matte';
        if (profileKey === 'fabric') {
            this.uniforms.ks.value *= 0.45 + (1.0 - roughness) * 0.25;
            this.uniforms.shininess.value = 10.0 + (1.0 - roughness) * 36.0;
        } else if (profileKey === 'metal') {
            this.uniforms.ks.value = Math.max(this.uniforms.ks.value, 0.78 + metallic * 0.62);
            this.uniforms.kd.value *= 0.56;
            this.uniforms.shininess.value = 28.0 + (1.0 - roughness) * 160.0;
        } else if (profileKey === 'plastic') {
            this.uniforms.ks.value *= 1.1;
            this.uniforms.shininess.value = 20.0 + (1.0 - roughness) * 110.0;
        } else if (profileKey === 'wood') {
            this.uniforms.ks.value *= 0.72;
            this.uniforms.shininess.value = 12.0 + (1.0 - roughness) * 54.0;
        } else {
            this.uniforms.ks.value *= 0.62;
            this.uniforms.shininess.value = 6.0 + (1.0 - roughness) * 44.0;
        }

        if (glassEnabled) {
            const fresnelGain = 0.35 + (ior - 1.0) * 0.55;
            this.uniforms.ks.value = Math.max(this.uniforms.ks.value, 0.55 + fresnelGain);
            this.uniforms.kd.value *= 0.18;
            this.uniforms.ka.value *= 0.45;
            this.uniforms.shininess.value = 110.0 + (1.0 - roughness) * 180.0 + (ior - 1.0) * 55.0;
        }
    }

    setMaterialProfile(profile = {}) {
        const nextProfile = {
            ...createDefaultMaterialProfile(),
            ...profile
        };

        this.materialProfile = nextProfile;
        this.uniforms.surfaceProfile.value = SURFACE_PROFILE_ID[nextProfile.key] || SURFACE_PROFILE_ID.matte;
        this.uniforms.detailScale.value = nextProfile.detailScale;
        this.uniforms.displacementScale.value = nextProfile.displacementScale;
        this.uniforms.detailContrast.value = nextProfile.detailContrast;
        this.uniforms.textureRepeat.value = nextProfile.textureRepeat;
        this.uniforms.sheenStrength.value = nextProfile.sheenStrength;
        this.uniforms.specularBoost.value = nextProfile.specularBoost;
        this.uniforms.bumpIntensity.value = nextProfile.bumpIntensity;
        this.uniforms.sheenTint.value.setRGB(...nextProfile.sheenTint);
        this.uniforms.grainDirection.value.set(...nextProfile.grainDirection);
        if (nextProfile.stats) {
            this.uniforms.textureMean.value.setRGB(
                clamp01(nextProfile.stats.avgR),
                clamp01(nextProfile.stats.avgG),
                clamp01(nextProfile.stats.avgB)
            );
        }
        this.renderFrame();
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

            if (this.multiviewRenderer && this.multiviewContainer) {
                const multiviewWidth = this.multiviewContainer.clientWidth;
                const multiviewHeight = this.multiviewContainer.clientHeight;
                if (multiviewWidth && multiviewHeight) {
                    this.multiviewWidth = multiviewWidth;
                    this.multiviewHeight = multiviewHeight;
                    this.multiviewRenderer.setSize(multiviewWidth, multiviewHeight);
                    this.multiviewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
                }
            }

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
            const activeMesh = this.getActiveMesh();
            if (!isDragging || !activeMesh) {
                return;
            }

            const deltaX = event.clientX - previousMousePosition.x;
            const deltaY = event.clientY - previousMousePosition.y;
            const nextRotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, activeMesh.rotation.x - deltaY * 0.01));
            const nextRotationY = activeMesh.rotation.y + deltaX * 0.01;
            Object.values(this.meshes).forEach((mesh) => {
                mesh.rotation.x = nextRotationX;
                mesh.rotation.y = nextRotationY;
            });
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
        this.multiviewLightArrow.setDirection(this.lightState.position.clone().normalize());
    }

    renderFrame() {
        const start = performance.now();
        this.renderer.setRenderTarget(null);
        this.syncMeshTransformsToMultiview();
        this.renderSceneToTarget(null, this.width, this.height);
        this.renderMultiview();
        this.lastRenderTimeMs = performance.now() - start;
        this.updateSpecularMetricsIfNeeded();
        return this.lastRenderTimeMs;
    }

    renderOffscreenFrame(width, height) {
        const targetWidth = Math.max(32, Math.floor(width));
        const targetHeight = Math.max(32, Math.floor(height));
        if (this.offscreenTarget.width !== targetWidth || this.offscreenTarget.height !== targetHeight) {
            this.offscreenTarget.setSize(targetWidth, targetHeight);
        }

        const start = performance.now();
        this.renderer.setRenderTarget(this.offscreenTarget);
        this.renderer.clear(true, true, true);
        this.renderSceneToTarget(this.offscreenTarget, targetWidth, targetHeight);
        this.renderer.setRenderTarget(null);
        this.lastRenderTimeMs = performance.now() - start;
        return this.lastRenderTimeMs;
    }

    renderSceneToTarget(target, width, height) {
        const renderWidth = Math.max(1, Math.floor(width));
        const renderHeight = Math.max(1, Math.floor(height));
        const originalAspect = this.camera.aspect;
        this.renderer.clear(true, true, true);

        if (this.currentGeometryMode === 'compare') {
            const halfWidth = Math.max(1, Math.floor(renderWidth / 2));
            const originalVisibility = {
                sphere: this.meshes.sphere.visible,
                cube: this.meshes.cube.visible
            };

            this.renderer.setScissorTest(true);

            this.meshes.sphere.visible = true;
            this.meshes.cube.visible = false;
            this.camera.aspect = halfWidth / renderHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setViewport(0, 0, halfWidth, renderHeight);
            this.renderer.setScissor(0, 0, halfWidth, renderHeight);
            this.renderer.render(this.scene, this.camera);

            this.meshes.sphere.visible = false;
            this.meshes.cube.visible = true;
            this.renderer.setViewport(halfWidth, 0, renderWidth - halfWidth, renderHeight);
            this.renderer.setScissor(halfWidth, 0, renderWidth - halfWidth, renderHeight);
            this.renderer.render(this.scene, this.camera);

            this.renderer.setScissorTest(false);
            this.meshes.sphere.visible = originalVisibility.sphere;
            this.meshes.cube.visible = originalVisibility.cube;
        } else {
            this.camera.aspect = renderWidth / renderHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setViewport(0, 0, renderWidth, renderHeight);
            this.renderer.render(this.scene, this.camera);
        }

        this.camera.aspect = originalAspect;
        this.camera.updateProjectionMatrix();
    }

    renderMultiview() {
        if (!this.isMultiviewEnabled || !this.multiviewRenderer || !this.multiviewContainer) {
            return;
        }

        const width = this.multiviewContainer.clientWidth || this.multiviewWidth;
        const height = this.multiviewContainer.clientHeight || this.multiviewHeight;
        if (!width || !height) {
            return;
        }

        if (width !== this.multiviewWidth || height !== this.multiviewHeight) {
            this.multiviewWidth = width;
            this.multiviewHeight = height;
            this.multiviewRenderer.setSize(width, height);
        }

        const halfWidth = Math.max(1, Math.floor(width / 2));
        const halfHeight = Math.max(1, Math.floor(height / 2));
        const perspectiveCamera = this.multiviewCameras.perspective;

        this.multiviewLightArrow.visible = false;
        this.multiviewRenderer.setScissorTest(true);
        this.multiviewRenderer.clear(true, true, true);

        const viewConfigs = [
            { camera: this.multiviewCameras.front, x: 0, y: halfHeight, width: halfWidth, height: height - halfHeight, showArrow: false },
            { camera: this.multiviewCameras.side, x: halfWidth, y: halfHeight, width: width - halfWidth, height: height - halfHeight, showArrow: false },
            { camera: this.multiviewCameras.top, x: 0, y: 0, width: halfWidth, height: halfHeight, showArrow: false },
            { camera: perspectiveCamera, x: halfWidth, y: 0, width: width - halfWidth, height: halfHeight, showArrow: true }
        ];

        viewConfigs.forEach((view) => {
            view.camera.aspect = Math.max(view.width / Math.max(view.height, 1), 0.1);
            view.camera.updateProjectionMatrix();
            this.multiviewLightArrow.visible = view.showArrow;
            this.multiviewRenderer.setViewport(view.x, view.y, view.width, view.height);
            this.multiviewRenderer.setScissor(view.x, view.y, view.width, view.height);
            this.multiviewRenderer.render(this.multiviewScene, view.camera);
        });

        this.multiviewLightArrow.visible = false;
        this.multiviewRenderer.setScissorTest(false);
    }

    setSpecularMetricsListener(listener) {
        this.specularMetricsListener = typeof listener === 'function' ? listener : null;
        if (this.specularMetricsListener) {
            this.specularMetricsListener(this.computeSpecularMetrics());
        }
    }

    computeSpecularMetrics() {
        const shininess = this.uniforms.shininess.value;
        const metrics = {};
        const position = new THREE.Vector3();
        const normal = new THREE.Vector3();
        const worldPosition = new THREE.Vector3();
        const worldNormal = new THREE.Vector3();
        const lightDir = new THREE.Vector3();
        const viewDir = new THREE.Vector3();
        const halfVector = new THREE.Vector3();
        const normalMatrix = new THREE.Matrix3();

        Object.entries(this.meshes).forEach(([key, mesh]) => {
            if (!mesh?.geometry?.attributes?.position || !mesh.geometry.attributes.normal) {
                return;
            }

            mesh.updateMatrixWorld(true);
            normalMatrix.getNormalMatrix(mesh.matrixWorld);

            const positionAttribute = mesh.geometry.attributes.position;
            const normalAttribute = mesh.geometry.attributes.normal;
            let maxSpecular = 0;
            let maxNdh = 0;

            for (let index = 0; index < positionAttribute.count; index += 1) {
                position.fromBufferAttribute(positionAttribute, index);
                normal.fromBufferAttribute(normalAttribute, index);
                worldPosition.copy(position).applyMatrix4(mesh.matrixWorld);
                worldNormal.copy(normal).applyMatrix3(normalMatrix).normalize();
                lightDir.copy(this.lightState.position).sub(worldPosition).normalize();
                viewDir.copy(this.camera.position).sub(worldPosition).normalize();
                halfVector.copy(lightDir).add(viewDir);

                if (halfVector.lengthSq() === 0) {
                    continue;
                }

                halfVector.normalize();
                const ndl = Math.max(worldNormal.dot(lightDir), 0.0);
                const ndh = Math.max(worldNormal.dot(halfVector), 0.0);
                const specular = ndl > 0.0 ? Math.pow(ndh, shininess) : 0.0;

                if (specular > maxSpecular) {
                    maxSpecular = specular;
                    maxNdh = ndh;
                }
            }

            metrics[key] = {
                specularIntensity: maxSpecular,
                ndhPeak: maxNdh,
                shininess
            };
        });

        return metrics;
    }

    updateSpecularMetricsIfNeeded(force = false) {
        if (!this.specularMetricsListener) {
            return;
        }

        const now = performance.now();
        if (!force && now - this.lastSpecularMetricsTimestamp < 90) {
            return;
        }

        this.lastSpecularMetricsTimestamp = now;
        this.specularMetricsListener(this.computeSpecularMetrics());
    }

    captureNormalizedPixels(width = 64, height = 64, cropScale = 1.0) {
        const targetCanvas = document.createElement('canvas');
        targetCanvas.width = width;
        targetCanvas.height = height;
        const context = targetCanvas.getContext('2d', { willReadFrequently: true });
        const sourceWidth = this.canvas.width * cropScale;
        const sourceHeight = this.canvas.height * cropScale;
        const sourceX = (this.canvas.width - sourceWidth) * 0.5;
        const sourceY = (this.canvas.height - sourceHeight) * 0.5;
        context.drawImage(this.canvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
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
        const previousArrowVisible = this.lightArrow.visible;
        const previousMode = this.currentGeometryMode;
        const previousScales = Object.fromEntries(
            Object.entries(this.meshes).map(([key, mesh]) => [key, mesh.scale.clone()])
        );
        const previousLightPosition = this.lightState.position.clone();
        const previousLightColor = this.lightState.color.clone();
        const previousClearColor = this.renderer.getClearColor(new THREE.Color()).clone();
        const previousClearAlpha = this.renderer.getClearAlpha();
        const previousCameraZ = this.camera.position.z;
        const previousCameraAspect = this.camera.aspect;
        const snapshotGeometry = options.snapshotGeometry || (previousMode === 'compare' ? 'sphere' : previousMode);

        this.autoRotate = false;
        if (this.controls) {
            this.controls.autoRotate = false;
            this.controls.update();
        }

        this.lightArrow.visible = options.showLightHelper === true;
        this.renderer.setClearColor(0x000000, 0);
        this.setGeometryMode(snapshotGeometry);
        if (options.snapshotScale) {
            Object.values(this.meshes).forEach((mesh) => {
                mesh.scale.setScalar(options.snapshotScale);
            });
        }
        if (options.snapshotCameraZ) {
            this.camera.position.z = options.snapshotCameraZ;
            this.camera.updateProjectionMatrix();
        }

        if (options.lightingType) {
            this.setLightingVariation(options.lightingType);
        }
        if (options.renderMode) {
            this.setRenderMode(options.renderMode);
        }

        this.updateMaterial(parameters);
        const renderTimeMs = this.renderOffscreenFrame(width, height);
        const pixelBuffer = new Uint8Array(width * height * 4);
        this.renderer.readRenderTargetPixels(this.offscreenTarget, 0, 0, width, height, pixelBuffer);
        const pixels = [];

        for (let index = 0; index < pixelBuffer.length; index += 4) {
            const alpha = pixelBuffer[index + 3] / 255;
            const r = pixelBuffer[index] / 255;
            const g = pixelBuffer[index + 1] / 255;
            const b = pixelBuffer[index + 2] / 255;
            const [baseR, baseG, baseB] = parameters.albedo;
            pixels.push(
                alpha > 0.01 ? r : baseR,
                alpha > 0.01 ? g : baseG,
                alpha > 0.01 ? b : baseB
            );
        }

        this.autoRotate = previousAutoRotate;
        if (this.controls) {
            this.controls.autoRotate = previousAutoRotate;
        }
        Object.entries(previousScales).forEach(([key, scale]) => {
            if (this.meshes[key]) {
                this.meshes[key].scale.copy(scale);
            }
        });
        this.lightArrow.visible = previousArrowVisible;
        this.lightState.position.copy(previousLightPosition);
        this.lightState.color.copy(previousLightColor);
        this.uniforms.lightPosition.value.copy(previousLightPosition);
        this.uniforms.lightColor.value.copy(previousLightColor);
        this.lightArrow.setDirection(previousLightPosition.clone().normalize());
        this.multiviewLightArrow.setDirection(previousLightPosition.clone().normalize());
        this.renderer.setClearColor(previousClearColor, previousClearAlpha);
        this.camera.position.z = previousCameraZ;
        this.camera.aspect = previousCameraAspect;
        this.camera.updateProjectionMatrix();
        this.setGeometryMode(previousMode);
        this.setRenderMode(previousRenderMode);
        this.renderFrame();

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
        } else if (this.autoRotate && this.getActiveMesh()) {
            Object.values(this.meshes).forEach((mesh) => {
                mesh.rotation.y += 0.01;
            });
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
