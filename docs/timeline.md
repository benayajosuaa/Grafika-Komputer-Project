# Timeline & Gantt Chart - BRDF Estimation Research Project

<br/>

## Executive Summary
Proyek ini adalah penelitian tentang **BRDF (Bidirectional Reflectance Distribution Function) Estimation** dengan komponen full-stack meliputi backend Python, frontend web, dan publikasi paper. Dengan asumsi pemahaman awal dari nol, timeline ini mengalokasikan waktu untuk riset mendalam, implementasi, debugging, dan penyelesaian dokumentasi.

**Total Duration:** 6 minggu (Week 9 - Week 14)  
**Project Start:** March 2, 2025  
**Project End:** April 10, 2025



## Timeline Detail Per Minggu

### **WEEK 9: March 2 - 6, 2025**
#### 🎯 Fokus: Deep Research & Foundation Understanding

**Deliverables:**
- [ ] Memahami konsep dasar BRDF dan lighting models
- [ ] Review literatur tentang BRDF estimation techniques
- [ ] Setup development environment (Python, Node.js, dependencies)
- [ ] Dokumentasi learning notes dan key concepts

**Tasks Breakdown:**
```
Day 1-2: BRDF Fundamentals & Theory
  - Pelajari: Phong model, Microfacet theory, Lambert reflectance
  - Resources: Paper reviews, tutorial videos
  - Output: notes in docs/literature_review.md

Day 3-4: Existing Solutions & Gap Analysis
  - Research: Current BRDF estimation methods
  - Analyze: Project scope vs existing solutions
  - Output: gap_analysis.md completion

Day 5-6: Environment Setup
  - Install: Python (NumPy, SciPy, Matplotlib), Node.js
  - Setup: Repository structure, virtual environment
  - Verify: All dependencies working
```

**Progress on Paper:**
- Literature review section (50% complete)

**Risk/Challenges:**
- Steep learning curve on mathematical concepts
- Setting up proper development environment



### **WEEK 10: March 9 - 13, 2025**
#### 🎯 Fokus: Deep Dive Research & Algorithm Design

**Deliverables:**
- [ ] Detailed algorithm design document
- [ ] Mathematical framework documentation
- [ ] Proof of concept notebook started
- [ ] Data pipeline design

**Tasks Breakdown:**
```
Day 1-2: Algorithm Selection & Design
  - Deep analysis: Multiple BRDF estimation approaches
  - Decide: Optimization method (Levenberg-Marquardt, gradient descent)
  - Document: Algorithm flowchart and equations
  - Output: METHODOLOGY.md v1

Day 3-4: Data & Pipeline Design
  - Design: Input data format and structure
  - Plan: Data preprocessing steps
  - Define: Model validation metrics (RMSE, spectral error)

Day 5-6: Proof of Concept (Code Start)
  - Begin: 01_proof_of_concept.ipynb
  - Implement: Basic algorithm skeleton
  - Test: With synthetic/simple data
```

**Progress on Paper:**
- Methodology section (30% complete)
- Algorithm description with equations

**Risk/Challenges:**
- Math heavy - may need external resources
- Deciding on correct algorithm approach



### **WEEK 11: March 16 - 20, 2025**
#### 🎯 Fokus: Core Algorithm Implementation & Refinement

**Deliverables:**
- [ ] Working BRDF estimator backend function
- [ ] Proof of concept notebook completed
- [ ] Performance benchmarks established
- [ ] Basic unit tests

**Tasks Breakdown:**
```
Day 1-2: Core Algorithm Implementation
  - Code: Main BRDF estimation function (backend/brdf_estimator.py)
  - Implement: Optimization loop and parameter fitting
  - Test: With controlled datasets

Day 3-4: Debugging & Refinement
  - Debug: Algorithm numerical stability issues
  - Optimize: Computation speed
  - Validate: Results against known references

Day 5-6: Documentation & Testing
  - Write: Function documentation and docstrings
  - Create: Unit tests (test_brdf_estimator.py)
  - Output: Performance metrics
```

**Code Structure Progress:**
```python
backend/
├── brdf_estimator.py          # Main algorithm
├── data_loader.py             # Data handling
└── tests/
    └── test_brdf_estimator.py # Unit tests
```

**Progress on Paper:**
- Results section (20% complete) - placeholder metrics
- Introduction refined

**Risk/Challenges:**
- Algorithm may not converge properly
- Numerical instability in optimization
- Need for iterative refinement



### **WEEK 12: March 23 - 27, 2025**
#### 🎯 Fokus: Backend Completion & Frontend Setup

**Deliverables:**
- [ ] Complete backend API (Flask/FastAPI wrapper)
- [ ] Frontend basic structure and UI mockup
- [ ] API endpoint documentation
- [ ] Frontend-backend integration plan

**Tasks Breakdown:**
```
Day 1-3: Backend API Development
  - Wrap: Core algorithm in REST API
  - Implement: Input validation and error handling
  - Add: Logging and monitoring
  - Test: API endpoints with curl/Postman

Day 4: Frontend Initialize
  - Review: Existing index.html and structure
  - Setup: Build system (if needed)
  - Design: UI/UX mockup for visualizations
  - Plan: React/Vue components (if needed)

Day 5-6: Integration & Documentation
  - Connect: Frontend to backend API
  - Create: API documentation (endpoints, request/response)
  - Setup: CORS and security headers
```

**Backend Structure:**
```python
backend/
├── brdf_estimator.py
├── api.py                    # Flask/FastAPI app
├── data_loader.py
├── utils/
│   ├── validators.py
│   └── visualization.py
└── requirements.txt
```

**Progress on Paper:**
- Implementation section (40% complete)
- Added API design documentation

**Risk/Challenges:**
- API design decisions
- Frontend-backend communication complexity
- CORS issues



### **WEEK 13: March 30 - April 3, 2025**
#### 🎯 Fokus: Frontend Development & Integrated Testing

**Deliverables:**
- [ ] Functional frontend UI with visualization
- [ ] Full integration testing (frontend + backend)
- [ ] Bug fixes and refinements
- [ ] User feedback incorporation

**Tasks Breakdown:**
```
Day 1-2: Frontend Enhancement
  - Improve: UI/UX with CSS styling (css/style.css)
  - Implement: Data input forms and controls
  - Add: Real-time visualization (charts, 3D plots)
  - Integrate: Math.js or Three.js for rendering

Day 3-4: End-to-End Testing & Debugging
  - Test: Complete workflow (upload → process → visualize)
  - Debug: Frontend-backend interaction issues
  - Fix: Any algorithm/API issues discovered
  - Test: Different browsers and devices

Day 5-6: Refinement & Optimization
  - Optimize: Backend response times
  - Improve: Frontend responsiveness
  - Add: Error handling and user guidance
  - Prepare: Deployment checklist
```

**Frontend Progress:**
```
frontend/
├── index.html                # Enhanced with forms
├── js/
│   ├── main.js              # Refactored
│   ├── renderer.js          # Visualization
│   ├── ui_controller.js     # Form handling
│   └── api_client.js        # Backend calls (NEW)
└── css/
    └── style.css            # Enhanced styling
```

**Progress on Paper:**
- Results section (70% complete)
- Discussion started (20% complete)
- Experiments documented

**Risk/Challenges:**
- Browser compatibility issues
- API timeout handling
- Visualization performance



### **WEEK 14: April 6 - 10, 2025**
#### 🎯 Fokus: Deployment & Paper Finalization

**Deliverables:**
- [ ] Project deployed (local/cloud)
- [ ] Complete research paper
- [ ] README and documentation finalized
- [ ] Final presentation ready

**Tasks Breakdown:**
```
Day 1-2: Deployment Preparation
  - Setup: Docker containers (optional but recommended)
  - Configure: Production environment
  - Deploy: To hosting service (Heroku, AWS, etc.)
  - Test: Production deployment

Day 2-3: Paper Writing - Final Push
  - Complete: Discussion section (80%)
  - Write: Conclusions and future work
  - Add: All figures, tables, and references
  - Proofread: Grammar and clarity

Day 4-5: Documentation & Polish
  - Write: Comprehensive README.md
  - Create: Installation guide
  - Document: API documentation
  - Prepare: Presentation slides

Day 6: Final Review & Submission
  - Final: Paper review and submission
  - Code: Clean-up and commenting
  - Repository: Final push to GitHub
  - Archive: All project files
```

**Final Project Structure:**
```
BRDF-Estimation-Research/
├── README.md                 # Complete guide
├── SETUP.md                  # Installation instructions
├── docs/
│   ├── timeline.md          # This file
│   ├── METHODOLOGY.md       # Complete
│   ├── literature_review.md # Complete
│   ├── gap_analysis.md      # Complete
│   └── paper.md             # Final paper
├── backend/                 # Production ready
├── frontend/                # Deployed version
├── notebooks/               # Final PoC
├── docker-compose.yml       # Deployment
└── requirements.txt
```

**Progress on Paper:**
- **COMPLETE** (100%)
- All sections finished
- Submitted for publication

<br/>

---

## Gantt Chart

```
Week 9        Week 10       Week 11       Week 12       Week 13       Week 14
|-------------|-------------|-------------|-------------|-------------|
Research & Foundations
[████████████]
                Algorithm Design & PoC
                [████████████]
                              Backend Implementation
                              [████████████]
                                            Frontend & Integration
                                            [████████████]
                                                          Testing & Refinement
                                                          [████████████]
                                                                        Deployment & Paper
                                                                        [████████████]

Paper Writing Progress
[██]  Week 9
[████]  Week 10
[████████]  Week 11
[██████████]  Week 12
[█████████████]  Week 13
[████████████████]  Week 14 (Complete)

Development Phases
Phase 1: Knowledge Acquisition (Week 9-10)
Phase 2: Core Development (Week 11-13)
Phase 3: Integration & Polish (Week 13-14)
```

<br/>

## Milestone Roadmap

| Week | Milestone | Status |
|------|-----------|--------|
| 9 | Deep research completed, environment ready |  Planning |
| 10 | Algorithm designed, PoC started |  Planning |
| 11 | Core backend working |  Planning |
| 12 | API ready, frontend initialized |  Planning |
| 13 | Full integration, all bugs fixed |  Planning |
| 14 | **DEPLOYMENT** & **PAPER SUBMITTED** |  Planning |



## Resource Allocation per Week

### Week 9: Research Focus
- **Time Split:** 60% Learning, 30% Setup, 10% Writing
- **Key Output:** Strong theoretical foundation

### Week 10: Design Focus
- **Time Split:** 40% Research, 40% Design/Planning, 20% Code
- **Key Output:** Clear algorithm blueprint

### Week 11: Development Focus
- **Time Split:** 70% Coding, 20% Testing, 10% Documentation
- **Key Output:** Working backend

### Week 12: Backend-to-Frontend
- **Time Split:** 40% Backend API, 40% Frontend, 20% Integration
- **Key Output:** Connected system

### Week 13: Integration Focus
- **Time Split:** 20% Feature completion, 60% Testing, 20% Documentation
- **Key Output:** Polished product

### Week 14: Deployment Focus
- **Time Split:** 30% Deployment, 50% Paper writing, 20% Final polish
- **Key Output:** Submission ready

<br/>

## Key Assumptions & Risk Mitigation

### Assumptions:
1. **Starting from Zero Knowledge** - Extra time allocated for learning
2. **Single Developer** - Serial task execution, minimal parallelization
3. **No External Dependencies** - All work is self-contained
4. **Standard Tools** - Python, JavaScript, basic web technologies

### Risk Mitigation Strategy:

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Algorithm won't converge | High | High | - Buffer time Week 11, fallback to simpler approach |
| Numerical instability | High | High | - Early testing with simple data, gradual complexity |
| Integration issues | Medium | High | - Test API early (Week 12), mock data ready |
| Time underestimation | High | Medium | - Weekly reviews, adjust next week if needed |
| Environment setup issues | Medium | Low | - Document all steps, use virtual environments |



## Weekly Checkpoint Checklist

### ✅ Week 9 Checkpoint
- [ ] All key BRDF concepts understood
- [ ] gap_analysis.md updated with learnings
- [ ] Development environment verified working
- [ ] literature_review.md at 50% completion

### ✅ Week 10 Checkpoint
- [ ] METHODOLOGY.md drafted
- [ ] Algorithm flowchart created
- [ ] Proof of concept notebook started
- [ ] Metrics and validation approach defined

### ✅ Week 11 Checkpoint
- [ ] brdf_estimator.py functional
- [ ] Unit tests written and passing
- [ ] Algorithm converges on test data
- [ ] Performance benchmarks documented

### ✅ Week 12 Checkpoint
- [ ] Flask/FastAPI API endpoints working
- [ ] Frontend displays basic input form
- [ ] API documentation complete
- [ ] Frontend-backend integration tested

### ✅ Week 13 Checkpoint
- [ ] Full UI with visualizations implemented
- [ ] End-to-end workflow tested
- [ ] Major bugs fixed
- [ ] Paper at 70% completion

### ✅ Week 14 Checkpoint
- [ ] Project deployed successfully
- [ ] Paper submitted (100% complete)
- [ ] README and documentation finalized
- [ ] All code committed and cleaned



## Success Metrics

### Technical Success:
- ✅ Backend algorithm achieves <10% estimation error on validation data
- ✅ API responds in <2 seconds per request
- ✅ Frontend renders results in <1 second
- ✅ Zero critical bugs at deployment

### Academic Success:
- ✅ Paper includes literature review, methodology, results, discussion
- ✅ Figures illustrate key findings
- ✅ References properly formatted
- ✅ Research question clearly answered

### Project Management Success:
- ✅ All weekly milestones met
- ✅ Code consistently committed
- ✅ Documentation up-to-date
- ✅ No blockers lasting >2 days



## Notes & Observations

### Critical Path Activities:
The sequence cannot be parallelized much:
1. **Research → Design** (must complete before coding)
2. **Backend → API Wrap** (must work before frontend integration)
3. **Integration → Testing** (must be complete before deployment)

### Flexible Timeline Slack:
- **Week 11-12 boundary:** Can absorb 2-3 day slips
- **Week 13:** Buffer for unexpected issues
- **Week 14:** Paper deadline is fixed, but code can be extended

### Quality vs Speed Trade-off:
- **Weeks 9-10:** Invest time in understanding (pays dividends later)
- **Weeks 11-13:** Code quality > speed (bugs multiply if rushed)
- **Week 14:** Final polish more important than new features

---

## File References
- `docs/literature_review.md` - Detailed paper collection & notes
- `docs/gap_analysis.md` - Problem definition & scope
- `docs/METHODOLOGY.md` - Algorithm design & equations
- `docs/impact.md` - Significance & applications
- `frontend/index.html` - UI entry point
- `backend/brdf_estimator.py` - Core algorithm
- `notebooks/01_proof_of_concept.ipynb` - Experimentation


