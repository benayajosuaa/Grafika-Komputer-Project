// Three.js Renderer for Material Preview

class ThreeJSRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);

        // Safety check
        if (!this.container) {
            console.error(`Container element with ID "${containerId}" not found`);
            return;
        }

        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;
        this.currentGeometryMode = 'sphere';
        this.activeMesh = null;
        this.autoRotate = false;
        this.isTouchDevice = 'ontouchstart' in window;
        this.controls = null;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });

        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setClearColor(0x1a1a2e);
        this.container.appendChild(this.renderer.domElement);
        this.canvas = this.renderer.domElement;
        this.canvas.style.touchAction = 'none';

        // Camera setup
        this.camera.position.z = 2.8;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        this.directionalLight.position.set(3, 4, 3);
        this.scene.add(this.directionalLight);

        this.lightArrow = new THREE.ArrowHelper(
            this.directionalLight.position.clone().normalize(),
            new THREE.Vector3(0, 0, 0),
            2.2,
            0xff4d4f,
            0.28,
            0.14
        );
        this.scene.add(this.lightArrow);

        const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
        fillLight.position.set(-2, 2, 2);
        this.scene.add(fillLight);

        this.material = this.createMaterial();
        this.setGeometryMode('sphere');

        this.updateInteractionHint();
        this.setupControls();
        this.setupResizeHandler();
        this.animate();
    }

    createMaterial() {
        return new THREE.MeshStandardMaterial({
            color: 0x808080,
            metalness: 0.0,
            roughness: 0.5,
            envMapIntensity: 1.0
        });
    }

    createProxyMesh(mode) {
        if (mode === 'cube') {
            return new THREE.Mesh(
                new THREE.BoxGeometry(1.6, 1.6, 1.6),
                this.material
            );
        }

        return new THREE.Mesh(
            new THREE.SphereGeometry(1, 64, 64),
            this.material
        );
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
    }

    updateMaterial(params) {
        if (!params || !this.material) {
            console.warn('Invalid parameters or material not initialized');
            return;
        }

        try {
            const [r, g, b] = params.albedo;
            this.material.color = new THREE.Color(r, g, b);
            this.material.roughness = params.roughness;
            this.material.metalness = params.metallic;
            this.material.needsUpdate = true;
        } catch (error) {
            console.error('Error updating material:', error);
        }
    }

    updateInteractionHint() {
        const helpText = document.querySelector('.help-text');
        if (!helpText) return;

        helpText.textContent = this.isTouchDevice
            ? 'Drag to rotate | Pinch to zoom | Two fingers to pan'
            : 'Drag to rotate | Scroll to zoom | Space to toggle auto-rotate';
    }

    setupResizeHandler() {
        window.addEventListener('resize', () => {
            if (!this.container || !this.renderer || !this.camera) return;

            const width = this.container.clientWidth;
            const height = this.container.clientHeight;
            if (!width || !height) return;

            this.width = width;
            this.height = height;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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

            window.addEventListener('keydown', (e) => {
                if (this.isTouchDevice) return;
                if (e.code === 'Space') {
                    e.preventDefault();
                    this.autoRotate = !this.autoRotate;
                    this.controls.autoRotate = this.autoRotate;
                }
            });
            return;
        }

        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        let touchMode = null;
        let previousTouchCenter = null;
        let previousTouchDistance = 0;

        this.renderer.domElement.addEventListener('mousedown', (e) => {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        this.renderer.domElement.addEventListener('mousemove', (e) => {
            if (!isDragging || !this.activeMesh) return;

            const deltaX = e.clientX - previousMousePosition.x;
            const deltaY = e.clientY - previousMousePosition.y;

            this.activeMesh.rotation.x -= deltaY * 0.01;
            this.activeMesh.rotation.y += deltaX * 0.01;
            this.activeMesh.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.activeMesh.rotation.x));

            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        this.renderer.domElement.addEventListener('mouseup', () => {
            isDragging = false;
        });

        this.renderer.domElement.addEventListener('mouseleave', () => {
            isDragging = false;
        });

        this.renderer.domElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.camera.position.z += e.deltaY * 0.001;
            this.camera.position.z = Math.max(1.4, Math.min(10, this.camera.position.z));
        }, { passive: false });

        this.renderer.domElement.addEventListener('touchstart', (e) => {
            if (!this.activeMesh) return;

            if (e.touches.length === 1) {
                touchMode = 'rotate';
                previousMousePosition = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY
                };
            } else if (e.touches.length === 2) {
                touchMode = 'dollyPan';
                previousTouchCenter = this.getTouchCenter(e.touches);
                previousTouchDistance = this.getTouchDistance(e.touches);
            }
        }, { passive: true });

        this.renderer.domElement.addEventListener('touchmove', (e) => {
            if (!this.activeMesh) return;

            if (e.touches.length === 1 && touchMode === 'rotate') {
                e.preventDefault();

                const touch = e.touches[0];
                const deltaX = touch.clientX - previousMousePosition.x;
                const deltaY = touch.clientY - previousMousePosition.y;

                this.activeMesh.rotation.x -= deltaY * 0.01;
                this.activeMesh.rotation.y += deltaX * 0.01;
                this.activeMesh.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.activeMesh.rotation.x));

                previousMousePosition = { x: touch.clientX, y: touch.clientY };
                return;
            }

            if (e.touches.length === 2) {
                e.preventDefault();

                const currentCenter = this.getTouchCenter(e.touches);
                const currentDistance = this.getTouchDistance(e.touches);

                if (previousTouchDistance) {
                    const zoomDelta = (previousTouchDistance - currentDistance) * 0.01;
                    this.camera.position.z = Math.max(1.4, Math.min(10, this.camera.position.z + zoomDelta));
                }

                if (previousTouchCenter) {
                    const panX = (currentCenter.x - previousTouchCenter.x) / this.width;
                    const panY = (currentCenter.y - previousTouchCenter.y) / this.height;
                    this.camera.position.x -= panX * 3;
                    this.camera.position.y += panY * 3;
                }

                previousTouchCenter = currentCenter;
                previousTouchDistance = currentDistance;
                touchMode = 'dollyPan';
            }
        }, { passive: false });

        this.renderer.domElement.addEventListener('touchend', (e) => {
            if (e.touches.length === 1) {
                touchMode = 'rotate';
                previousMousePosition = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY
                };
                previousTouchCenter = null;
                previousTouchDistance = 0;
                return;
            }

            if (e.touches.length === 0) {
                touchMode = null;
                previousTouchCenter = null;
                previousTouchDistance = 0;
            }
        });

        window.addEventListener('keydown', (e) => {
            if (this.isTouchDevice) return;
            if (e.code === 'Space') {
                e.preventDefault();
                this.autoRotate = !this.autoRotate;
            }
        });
    }

    getTouchCenter(touches) {
        return {
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2
        };
    }

    getTouchDistance(touches) {
        const deltaX = touches[0].clientX - touches[1].clientX;
        const deltaY = touches[0].clientY - touches[1].clientY;
        return Math.hypot(deltaX, deltaY);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.controls) {
            this.controls.autoRotate = this.autoRotate;
            this.controls.update();
        } else if (this.autoRotate && this.activeMesh) {
            this.activeMesh.rotation.y += 0.01;
        }

        this.renderer.render(this.scene, this.camera);
    }
}
