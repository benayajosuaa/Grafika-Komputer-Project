# Methodology & Technical Design
## Differentiable BRDF Estimation Research

---

## 1. System Architecture

### 1.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER INTERFACE (WEB)                        │
│  (Three.js + WebGL) - Interactive real-time visualization       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTP/REST API
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                  OPTIMIZATION ENGINE (PYTHON)                   │
│  - PyTorch + PyTorch3D                                          │
│  - BRDF Parameter Optimization                                 │
│  - Loss Computation & Gradients                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┬─────────────────┐
        │                │                │                 │
        ▼                ▼                ▼                 ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ BRDF Model   │ │ Renderer     │ │ Loss Module  │ │ Optimizer    │
│ (Cook-Torr.) │ │ (Diff. Rend.)│ │ (Perceptual) │ │ (Adam)       │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

### 1.2 Component Details

| Component | Role | Technology |
|-----------|------|-----------|
| **Frontend** | User interaction, visualization | Three.js, WebGL, HTML/CSS/JS |
| **Backend API** | Request handling, orchestration | Flask/FastAPI + Python |
| **BRDF Engine** | Parameter optimization | PyTorch, custom BRDF shader |
| **Renderer** | Differentiable image synthesis | PyTorch3D + custom GLSL |
| **Loss Computation** | Similarity metrics | LPIPS, L2, custom losses |
| **GPU Acceleration** | Computation speedup | CUDA (NVIDIA) or Metal (Apple) |

---

## 2. Data Flow & Processing Pipeline

### 2.1 Input Processing

```
INPUT IMAGE
    │
    ├─ Resize: 512×512 pixels
    │
    ├─ Color Normalization: [0, 1]
    │
    ├─ Background Masking:
    │   ├─ Option A: User manual selection
    │   ├─ Option B: Automatic segmentation (OpenCV)
    │   └─ Option C: Assume full image is material
    │
    └─ Output: Tensor(1, 3, 512, 512)
```

### 2.2 Lighting Estimation

```
TARGET IMAGE (Material Photo)
    │
    ├─ Assumption A: Known Light Setup
    │   └─ Use provided light direction (θ, φ, intensity)
    │
    ├─ Assumption B: Automated Estimation
    │   ├─ Detect dominant light direction from image
    │   ├─ Use Structure-from-Motion (OpenMVG)
    │   └─ Or: Assume hemisphere lighting (soft)
    │
    └─ Output: Light Direction + Intensity
```

**For MVP:** We'll use simplified lighting:
- Single directional light source
- OR hemispherical ambient light
- Estimated from image statistics

### 2.3 Optimization Loop

```
ITERATION i = 0 to MAX_ITERATIONS:
│
├─ 1. Forward Pass
│    ├─ Input: Current [albedo, roughness, metallic]
│    ├─ Render sphere/model with BRDF
│    └─ Output: rendered_image (differentiable tensor)
│
├─ 2. Loss Computation
│    ├─ L_photo = ||rendered - target||²
│    ├─ L_perceptual = LPIPS(rendered, target)
│    ├─ L_reg = regularization_terms
│    └─ L_total = w1*L_photo + w2*L_perc + w3*L_reg
│
├─ 3. Backward Pass
│    ├─ Compute gradients: ∇L w.r.t. parameters
│    ├─ PyTorch autograd (automatic differentiation)
│    └─ Output: [dL/d_albedo, dL/d_rough, dL/d_metal]
│
├─ 4. Parameter Update
│    ├─ Using Adam optimizer
│    ├─ new_param = param - lr * gradient
│    └─ Clamp to valid ranges [0, 1]
│
├─ 5. Convergence Check
│    ├─ If loss < threshold → STOP
│    ├─ Else: Continue iteration
│    └─ Else if i >= MAX_ITER → STOP
│
└─ Output: Final estimated parameters
```

**Pseudocode:**
```python
# Initialization
albedo = torch.tensor([0.5, 0.5, 0.5], requires_grad=True)
roughness = torch.tensor(0.5, requires_grad=True)
metallic = torch.tensor(0.0, requires_grad=True)

optimizer = torch.optim.Adam([albedo, roughness, metallic], lr=0.01)
scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=100)

# Main loop
for iteration in range(max_iterations):
    # 1. Forward
    rendered = renderer.render(
        mesh=sphere,
        albedo=albedo.clamp(0, 1),
        roughness=roughness.clamp(0, 1),
        metallic=metallic.clamp(0, 1),
        lighting=light_setup
    )
    
    # 2. Compute loss
    loss_photo = F.mse_loss(rendered, target_image)
    loss_perc = lpips_model(rendered, target_image).mean()
    loss_total = 0.7 * loss_photo + 0.3 * loss_perc
    
    # 3. Backward
    optimizer.zero_grad()
    loss_total.backward()
    
    # 4. Update
    optimizer.step()
    scheduler.step()
    
    # 5. Monitor
    if iteration % 50 == 0:
        print(f"Iter {iteration}: Loss = {loss_total.item():.4f}")
        
    if loss_total.item() < threshold:
        break

# Result
final_params = {
    'albedo': albedo.detach().cpu(),
    'roughness': roughness.detach().cpu(),
    'metallic': metallic.detach().cpu()
}
```

---

## 3. BRDF Model Specification

### 3.1 Cook-Torrance BRDF

**Standard Formula:**
```
f_r(l, v) = k_d * (c/π) + k_s * (DFG) / (4(n·l)(n·v))

Where:
- k_d = diffuse contribution (1 - metallic)
- k_s = specular contribution (metallic)
- c = albedo (base color)
- D = Normal Distribution Function (GGX)
- F = Fresnel Effect
- G = Geometric Attenuation
```

### 3.2 Parameter Space

**What we estimate:**
```
┌─────────────────────────────────────┐
│ BRDF Parameter Vector: p ∈ ℝ^5     │
├─────────────────────────────────────┤
│ albedo_r ∈ [0, 1]                   │
│ albedo_g ∈ [0, 1]                   │
│ albedo_b ∈ [0, 1]                   │
│ roughness ∈ [0, 1]                  │
│ metallic ∈ [0, 1]                   │
└─────────────────────────────────────┘

Special case: If metallic ≈ 1
    → Use metallic BRDF instead of Cook-Torrance
    → Different Fresnel term (F0 ≈ 0.95 for metals)
```

### 3.3 Shader Implementation (GLSL)

```glsl
// Fragment shader for differentiable rendering
#version 300 es
precision highp float;

uniform vec3 u_albedo;      // Input: albedo color
uniform float u_roughness;  // Input: roughness
uniform float u_metallic;   // Input: metallic

in vec3 v_normal;
in vec3 v_position;
in vec2 v_uv;

out vec4 out_color;

// GGX Normal Distribution Function
float ggx(float NH, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float denom = (NH * NH) * (a2 - 1.0) + 1.0;
    return a2 / (3.14159 * denom * denom);
}

// Schlick Fresnel Approximation
vec3 schlick_fresnel(float HV, vec3 F0) {
    return F0 + (1.0 - F0) * pow(1.0 - HV, 5.0);
}

// Cook-Torrance BRDF
vec3 brdf(vec3 normal, vec3 view_dir, vec3 light_dir) {
    vec3 half_dir = normalize(view_dir + light_dir);
    
    float NH = max(dot(normal, half_dir), 0.0);
    float NL = max(dot(normal, light_dir), 0.0);
    float NV = max(dot(normal, view_dir), 0.0);
    float HV = max(dot(half_dir, view_dir), 0.0);
    
    // Metallic
    vec3 F0 = mix(vec3(0.04), u_albedo, u_metallic);
    vec3 F = schlick_fresnel(HV, F0);
    
    // Distribution
    float D = ggx(NH, u_roughness);
    
    // Geometry (Schlick-GGX)
    float k = (u_roughness + 1.0) * (u_roughness + 1.0) / 8.0;
    float G = (NL / (NL * (1.0 - k) + k)) * (NV / (NV * (1.0 - k) + k));
    
    // Specular
    vec3 specular = (D * F * G) / (4.0 * NL * NV + 0.001);
    
    // Diffuse (Lambert)
    vec3 diffuse = u_albedo / 3.14159;
    vec3 kD = vec3(1.0) - F;
    kD *= (1.0 - u_metallic);
    
    return (kD * diffuse + specular) * NL;
}

void main() {
    vec3 normal = normalize(v_normal);
    vec3 view_dir = normalize(-v_position); // Camera at origin
    vec3 light_dir = normalize(vec3(1.0, 1.0, 1.0)); // Light direction
    
    vec3 color = brdf(normal, view_dir, light_dir);
    out_color = vec4(color, 1.0);
}
```

### 3.4 Differentiability Notes

- ✅ All operations in shader are differentiable in PyTorch3D
- ✅ Softmax rasterization preserves gradients through rendering
- ✅ Parameters (albedo, roughness, metallic) have requires_grad=True
- ✅ Backprop flows through: shader → rasterizer → parameters

---

## 4. Loss Function Design

### 4.1 Multi-Term Loss

```
L_total = w₁ * L_photo + w₂ * L_perc + w₃ * L_reg + w₄ * L_smooth

Where weights: w₁=0.5, w₂=0.3, w₃=0.1, w₄=0.1
```

### 4.2 Loss Components

#### **4.2.1 Photometric Loss (MSE)**
```python
L_photo = ||rendered_image - target_image||²_2

Why:
- Direct pixel-level similarity
- Fast to compute
- Foundation of optimization
```

#### **4.2.2 Perceptual Loss (LPIPS)**
```python
L_perc = LPIPS(rendered_image, target_image)

Why:
- Perceptually aligned with human vision
- Avoids pixel-perfect but visually incorrect matches
- Uses pre-trained VGG features
```

#### **4.2.3 Regularization Loss**
```python
L_reg = λ₁ * ||roughness - 0.5||²  # Smooth prior
      + λ₂ * ||metallic||²          # Prefer non-metallic
      + λ₃ * ||∇albedo||²           # Encourage smooth color
```

#### **4.2.4 Smoothness Loss**
```python
# Discourage high-frequency noise in parameters
L_smooth = ||∇albedo||² + ||∇roughness||²
```

### 4.3 Loss Curve Example

```
Iteration 0:    Loss = 0.8500 ████████
Iteration 50:   Loss = 0.4200 ████
Iteration 100:  Loss = 0.2100 ██
Iteration 200:  Loss = 0.1300 █
Iteration 300:  Loss = 0.0950 
Iteration 400:  Loss = 0.0850 → Convergence!
```

---

## 5. Performance Specifications

### 5.1 Computational Requirements

```
Input Image:     512 × 512 pixels
3D Model:        Sphere (32K triangles)
Parameters:      5 (albedo×3 + roughness + metallic)
Iterations:      500 typical (100-1000 range)
Device:          GPU (NVIDIA or Apple Silicon)

Per-iteration time: ~50-100ms (forward + backward)
Total optimization: 30-100 seconds
```

### 5.2 Real-Time Frontend Performance

```
Target FPS: 60 fps (16.67ms per frame)
Frame time budget:
  - Input upload: 1ms
  - WebGL rendering: 10ms
  - UI updates: 3ms
  - Network latency: 2ms
  ───────────────────
  Total: 16ms ✓
```

### 5.3 Scalability

```
Single GPU: 1 material/minute
Multi-GPU: Scale linearly with GPU count
Batch processing: Support for 10+ materials

Memory:
- Model + optimizer state: ~500MB
- Input batch (10 images): ~100MB
- GPU: 4GB sufficient for single-image mode
```

---

## 6. Validation & Testing Strategy

### 6.1 Unit Tests

```
test_brdf_shader.py
  ✓ Cook-Torrance computation correctness
  ✓ Parameter bounds enforcement
  ✓ Gradient computation accuracy

test_renderer.py
  ✓ Image generation non-black
  ✓ Lighting integration
  ✓ Batching support

test_optimizer.py
  ✓ Loss decreases over iterations
  ✓ Parameters converge to valid range
```

### 6.2 Quantitative Metrics

```
For each test material:

1. PSNR (Peak Signal-to-Noise Ratio)
   PSNR = 20 * log₁₀(MAX / RMSE)
   Target: > 25 dB (good)

2. SSIM (Structural Similarity Index)
   SSIM = Correlation between rendered and target
   Target: > 0.85 (high similarity)

3. Perceptual Loss (LPIPS)
   Using pre-trained VGG features
   Target: < 0.15 (low perceptual distance)

4. Parameter Error (if ground-truth available)
   Error = ||estimated - ground_truth||
   Target: < 0.1 per parameter
```

### 6.3 Qualitative Evaluation

```
Visual comparison:
- Side-by-side: Input vs Rendered
- Rotating preview: Check material appearance
- Different lighting: Verify BRDF consistency
- Multiple models: Sphere, bunny, teapot
```

### 6.4 Failure Cases

```
Scenarios to test:
- Shiny materials (high roughness variation)
- Metallic surfaces (reflection complexity)
- Transparent/translucent materials
- Complex lighting (shadows, bounces)
- Low-quality input (blurry, noisy photos)
```

---

## 7. Experimental Design

### 7.1 Dataset

**Test Set:** 20 material images
```
Categories:
- Diffuse: 5 materials (wood, fabric, paper)
- Rough: 5 materials (concrete, rubber, plastic)
- Shiny: 5 materials (ceramic, polished metal)
- Complex: 5 materials (fabric weave, brushed metal)

Each material:
- Single photograph (512×512)
- Ground-truth BRDF parameters (if available)
- Multiple lighting conditions (optional)
```

### 7.2 Baseline Comparisons

```
1. Naive Method
   - Simple albedo extraction + average roughness
   - Benchmark: Baseline PSNR/SSIM

2. CNN Method
   - Pretrained ResNet for parameter prediction
   - Benchmark: Speed vs accuracy

3. Existing Tool
   - If available: Compare against known methods
   - e.g., Allegorithmic Substance Designer
```

### 7.3 Ablation Study

```
Experiment 1: Loss function components
  Config A: L_photo only
  Config B: L_photo + L_perceptual
  Config C: L_photo + L_perceptual + L_reg
  → Measure convergence speed and final quality

Experiment 2: BRDF model complexity
  Config A: Lambertian + specular (simple)
  Config B: Cook-Torrance (proposed)
  Config C: Disney BRDF (complex)
  → Measure parameter estimation accuracy

Experiment 3: Optimization hyperparameters
  Config A: Learning rate = 0.01
  Config B: Learning rate = 0.001
  Config C: Learning rate = 0.1
  → Find optimal convergence speed
```

---

## 8. Development Timeline (Gantt-style)

```
Week 1  ███░░░░░░  Research & Design
Week 2  ░███░░░░░  Environment Setup
Week 3  ░░███░░░░  Proof-of-Concept
Week 4  ░░░███░░░  Core Implementation
Week 5  ░░░░███░░  Frontend Development
Week 6  ░░░░░███░  Integration & Testing
Week 7  ░░░░░░███  Experiments
Week 8  ░░░░░░░██  Manuscript Writing
Week 9  ░░░░░░░░█  Final Refinement
```

**Milestones:**
- ✓ Day 7: Proposal complete (UTS submission)
- ✓ Day 14: PoC notebook working
- ✓ Day 28: Backend functional
- ✓ Day 42: Frontend + backend integrated
- ✓ Day 56: Experiments complete
- ✓ Day 70: Manuscript ready (UAS submission)

---

## 9. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Optimization not converging | HIGH | Tune learning rate, loss weights |
| GPU memory issues | MEDIUM | Reduce batch size, use gradient checkpointing |
| Differentiability issues | HIGH | Use PyTorch3D (well-tested), test gradients |
| Real material complexity | MEDIUM | Start with simple materials, add complexity |
| Single-view ambiguity | HIGH | Add priors/regularization, document limitations |

---

## 10. Success Criteria (Final Evaluation)

```
✓ Produce interpretable BRDF parameters from single image
✓ Rendered result visually similar to input (PSNR > 25, SSIM > 0.85)
✓ Optimization converges in < 2 minutes on GPU
✓ Frontend responsive (60 FPS) and interactive
✓ Code documented and reproducible
✓ Manuscript ready for publication
✓ Paper aligns with research proposal
```

---

**Document Status:** COMPLETE  
**Last Updated:** 19 February 2026  
**Prepared for:** UTS Submission (Computer Graphics 2025/2026)
