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
        
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        
        this.renderer.setSize(this.width, this.height);
        this.renderer.setClearColor(0x1a1a2e);
        this.container.appendChild(this.renderer.domElement);
        this.canvas = this.renderer.domElement;
        
        // Camera setup
        this.camera.position.z = 2.0;
        
        // Lighting - optimized for planar surface
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        // Main directional light
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        this.directionalLight.position.set(3, 4, 3);
        this.scene.add(this.directionalLight);
        
        // Secondary fill light for better material visualization
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
        fillLight.position.set(-2, 2, 2);
        this.scene.add(fillLight);
        
        // Create plane geometry (instead of sphere)
        // PlaneGeometry(width, height, widthSegments, heightSegments)
        const geometry = new THREE.PlaneGeometry(2, 2, 32, 32);
        this.material = this.createMaterial();
        this.plane = new THREE.Mesh(geometry, this.material);
        this.scene.add(this.plane);
        
        // Controls
        this.setupControls();
        
        // Animation loop
        this.animate();
    }
    
    createMaterial() {
        // Standard material (will be updated based on parameters)
        const material = new THREE.MeshStandardMaterial({
            color: 0x808080,
            metalness: 0.0,
            roughness: 0.5,
            envMapIntensity: 1.0
        });
        return material;
    }
    
    updateMaterial(params) {
        // Update Three.js material based on BRDF parameters
        if (!params || !this.material) {
            console.warn('Invalid parameters or material not initialized');
            return;
        }
        
        try {
            const [r, g, b] = params.albedo;
            this.material.color.setRGB(r, g, b);
            this.material.metalness = params.metallic;
            this.material.roughness = params.roughness;
        } catch (error) {
            console.error('Error updating material:', error);
        }
    }
    
    setupControls() {
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        
        this.renderer.domElement.addEventListener('mousedown', (e) => {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });
        
        this.renderer.domElement.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - previousMousePosition.x;
                const deltaY = e.clientY - previousMousePosition.y;
                
                // For plane: rotate around axes for perspective view
                this.plane.rotation.x -= deltaY * 0.01;
                this.plane.rotation.y += deltaX * 0.01;
                
                // Clamp rotation to avoid flipping
                this.plane.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.plane.rotation.x));
                
                previousMousePosition = { x: e.clientX, y: e.clientY };
            }
        });
        
        this.renderer.domElement.addEventListener('mouseup', () => {
            isDragging = false;
        });
        
        this.renderer.domElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.camera.position.z += e.deltaY * 0.001;
            this.camera.position.z = Math.max(1, Math.min(10, this.camera.position.z));
        });
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }
}
