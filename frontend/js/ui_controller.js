// UI Controller - Handle user interactions and state management

class UIController {
    constructor(app) {
        this.app = app;
        this.setupEventListeners();
        this.initializeLossChart();
    }
    
    setupEventListeners() {
        // Parameter updates
        this.setupParameterSliders();
        
        // Control buttons
        this.setupControlButtons();
    }
    
    setupParameterSliders() {
        // Update preview on any parameter change
        const sliders = document.querySelectorAll('input[type="range"]');
        sliders.forEach(slider => {
            slider.addEventListener('input', () => {
                this.app.updatePreview();
            });
        });
    }
    
    setupControlButtons() {
        document.getElementById('start-optimize').addEventListener('click', () => {
            this.app.startOptimization();
        });
        
        document.getElementById('stop-optimize').addEventListener('click', () => {
            this.app.stopOptimization();
        });
        
        document.getElementById('reset-params').addEventListener('click', () => {
            this.app.resetParameters();
        });
    }
    
    initializeLossChart() {
        const ctx = document.getElementById('loss-chart').getContext('2d');
        this.lossChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Loss',
                    data: [],
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        type: 'logarithmic',
                        min: 0.001,
                        max: 1,
                        title: {
                            display: true,
                            text: 'Loss (log scale)'
                        }
                    }
                }
            }
        });
    }
    
    updateLossChart(losses) {
        this.lossChart.data.labels = losses.map((_, i) => i);
        this.lossChart.data.datasets[0].data = losses;
        this.lossChart.update('none');
    }
    
    showMessage(message, type = 'info') {
        // Toast notification
        console.log(`[${type.toUpperCase()}] ${message}`);
        // Could add UI toast here
    }
    
    showError(message) {
        this.showMessage(message, 'error');
        alert(`Error: ${message}`);
    }
    
    showLoading(show = true) {
        const spinner = document.getElementById('loading-spinner');
        if (show) {
            spinner.style.display = 'flex';
        } else {
            spinner.style.display = 'none';
        }
    }
}

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIController;
}
