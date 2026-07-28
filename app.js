/**
 * Multi-Elevator System Simulation (JS + p5.js + HTMX Events)
 */

// Generate spreadsheet-style Alpha IDs (A, B... Z, AA, AB)
function generateAlphaId(index) {
    let id = "";
    while (index >= 0) {
        id = String.fromCharCode(65 + (index % 26)) + id;
        index = Math.floor(index / 26) - 1;
    }
    return id;
}

// Elevator Cabin Model
class ElevatorCabin {
    constructor(alphaId, startingFloor, totalFloors) {
        this.alphaId = alphaId;
        this.currentFloor = startingFloor;
        this.targetFloor = startingFloor;
        this.renderY = startingFloor; // Smooth Y coordinate for 60fps interpolation
        this.doorStatus = "";         // "", "Opening...", "Opened", "Closing..."
        this.doorRatio = 0;           // 0 (closed) -> 1 (open)
        this.direction = "IDLE";      // "UP", "DOWN", "IDLE"
        this.totalFloors = totalFloors;

        // Up & Down request queues
        this.upRequests = new Set();
        this.downRequests = new Set();
        this.isProcessing = false;
    }

    addRequest(floor) {
        if (floor < 0 || floor >= this.totalFloors) return;
        if (floor === this.currentFloor && this.doorStatus !== "") return;

        if (floor > this.currentFloor) {
            this.upRequests.add(floor);
        } else if (floor < this.currentFloor) {
            this.downRequests.add(floor);
        } else {
            this.upRequests.add(floor);
        }

        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    getNextTarget() {
        const upArr = Array.from(this.upRequests).sort((a, b) => a - b);
        const downArr = Array.from(this.downRequests).sort((a, b) => b - a);

        if (this.direction === "UP" || this.direction === "IDLE") {
            if (upArr.length > 0) return upArr[0];
            if (downArr.length > 0) return downArr[0];
        } else if (this.direction === "DOWN") {
            if (downArr.length > 0) return downArr[0];
            if (upArr.length > 0) return upArr[0];
        }
        return -1;
    }

    async processQueue() {
        this.isProcessing = true;

        while (true) {
            const nextTarget = this.getNextTarget();
            if (nextTarget === -1) {
                this.direction = "IDLE";
                this.isProcessing = false;
                break;
            }

            this.targetFloor = nextTarget;

            if (nextTarget > this.currentFloor) {
                this.direction = "UP";
                this.currentFloor++;
            } else if (nextTarget < this.currentFloor) {
                this.direction = "DOWN";
                this.currentFloor--;
            }

            // Simulating floor transition time
            await this.sleep(1400);

            if (this.currentFloor === nextTarget) {
                this.upRequests.delete(this.currentFloor);
                this.downRequests.delete(this.currentFloor);

                // Door sequence animation matching Java timeline
                this.doorStatus = "Opening...";
                await this.animateDoors(1, 800);

                this.doorStatus = "Opened";
                await this.sleep(2500);

                this.doorStatus = "Closing...";
                await this.animateDoors(0, 800);

                this.doorStatus = "";
            }
        }
    }

    animateDoors(targetRatio, durationMs) {
        return new Promise(resolve => {
            const startRatio = this.doorRatio;
            const startTime = performance.now();
            const step = (now) => {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / durationMs, 1);
                this.doorRatio = startRatio + (targetRatio - startRatio) * progress;
                if (progress < 1) {
                    requestAnimationFrame(step);
                } else {
                    resolve();
                }
            };
            requestAnimationFrame(step);
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Controller App State
class ElevatorController {
    constructor(floors = 10, elevators = 4) {
        this.numberOfFloors = floors;
        this.numberOfElevators = elevators;
        this.elevators = [];
        this.externalRequests = new Set();
        this.initElevators();
    }

    initElevators() {
        this.elevators = [];
        this.externalRequests.clear();
        for (let i = 0; i < this.numberOfElevators; i++) {
            const alphaId = generateAlphaId(i);
            const startingFloor = Math.floor((i * (this.numberOfFloors - 1)) / Math.max(1, this.numberOfElevators - 1));
            this.elevators.push(new ElevatorCabin(alphaId, startingFloor, this.numberOfFloors));
        }
    }

    // Nearest Cabin Dispatch Algorithm (translating Java logic)
    handleExternalCall(requestedFloor) {
        if (requestedFloor < 0 || requestedFloor >= this.numberOfFloors) return;
        this.externalRequests.add(requestedFloor);

        let closestCabin = null;
        let minDistance = Infinity;

        for (const cabin of this.elevators) {
            const distance = Math.abs(cabin.currentFloor - requestedFloor);
            if (distance < minDistance) {
                minDistance = distance;
                closestCabin = cabin;
            }
        }

        if (closestCabin) {
            closestCabin.addRequest(requestedFloor);
        }
    }

    // In-cab direct panel press
    handleCabRequest(alphaId, requestedFloor) {
        const cabin = this.elevators.find(e => e.alphaId === alphaId);
        if (cabin) {
            cabin.addRequest(requestedFloor);
        }
    }
}

// Global System Instance
let controller = new ElevatorController(10, 4);
let p5Instance = null;

// UI Renderer Sync Functions
function updateUI() {
    updateExternalCallGrid();
    updateCabKeypads();
    updateTelemetryBar();
}

function updateExternalCallGrid() {
    const container = document.getElementById('external-call-grid');
    if (!container) return;

    let html = '';
    for (let f = controller.numberOfFloors - 1; f >= 0; f--) {
        const isRequested = controller.elevators.some(e => e.upRequests.has(f) || e.downRequests.has(f));
        const activeClass = isRequested ? 'active' : '';
        html += `<button class="call-btn ${activeClass}" onclick="handleCallBtnClick(${f})">Flr ${f}</button>`;
    }
    container.innerHTML = html;
}

function updateCabKeypads() {
    const container = document.getElementById('cab-keypads-container');
    if (!container) return;

    let html = '';
    controller.elevators.forEach(cabin => {
        let statusClass = 'status-idle';
        let dirArrow = '•';
        if (cabin.direction === 'UP') { statusClass = 'status-up'; dirArrow = '▲'; }
        if (cabin.direction === 'DOWN') { statusClass = 'status-down'; dirArrow = '▼'; }

        const doorBadge = cabin.doorStatus ? `<span class="door-badge">${cabin.doorStatus}</span>` : '';

        html += `
            <div class="cab-keypad-card">
                <div class="cab-keypad-header">
                    <div class="cab-title">
                        <span class="cab-name">[${cabin.alphaId}]</span>
                        <span class="status-tag ${statusClass}">${dirArrow} ${cabin.direction}</span>
                    </div>
                    <div class="cab-telemetry-meta">
                        ${doorBadge}
                        <span class="floor-badge">Flr <strong>${cabin.currentFloor}</strong> ${cabin.targetFloor !== cabin.currentFloor ? '→ ' + cabin.targetFloor : ''}</span>
                    </div>
                </div>
                <div class="keypad-grid">
        `;

        for (let f = 0; f < controller.numberOfFloors; f++) {
            const isActive = cabin.upRequests.has(f) || cabin.downRequests.has(f) || cabin.targetFloor === f;
            const activeClass = isActive ? 'active' : '';
            html += `<button class="key-btn ${activeClass}" onclick="handleKeypadClick('${cabin.alphaId}', ${f})">${f}</button>`;
        }

        html += `
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function updateTelemetryBar() {
    const container = document.getElementById('telemetry-bar');
    if (!container) return;

    let html = '';
    controller.elevators.forEach(cabin => {
        let statusClass = 'status-idle';
        let dirArrow = '•';
        if (cabin.direction === 'UP') { statusClass = 'status-up'; dirArrow = '▲'; }
        if (cabin.direction === 'DOWN') { statusClass = 'status-down'; dirArrow = '▼'; }

        html += `
            <div class="telemetry-pill ${statusClass}">
                <span class="pill-cab">${cabin.alphaId}</span>
                <span class="pill-dir">${dirArrow}</span>
                <span class="pill-flr">F${cabin.currentFloor}</span>
                ${cabin.doorStatus ? `<span class="pill-door">${cabin.doorStatus.substring(0, 4)}</span>` : ''}
            </div>
        `;
    });
    container.innerHTML = html;
}

// User Actions
window.handleCallBtnClick = (floor) => {
    controller.handleExternalCall(floor);
    updateUI();
};

window.handleKeypadClick = (alphaId, floor) => {
    controller.handleCabRequest(alphaId, floor);
    updateUI();
};

// Form submit handler to reconfigure system
document.getElementById('config-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const floors = parseInt(document.getElementById('floors-input').value, 10);
    const elevators = parseInt(document.getElementById('elevators-input').value, 10);

    if (floors >= 2 && elevators >= 1) {
        controller = new ElevatorController(floors, elevators);
        updateUI();
        if (p5Instance) p5Instance.updateLayout();
    }
});

// p5.js Visual Blueprint (Instance Mode)
const p5Sketch = (p) => {
    let containerWidth, containerHeight;
    let floorHeight, shaftWidth, shaftSpacing, startX, startY;

    p.setup = () => {
        const container = document.getElementById('canvas-container');
        containerWidth = container.clientWidth || 600;
        containerHeight = container.clientHeight || 500;
        
        let canvas = p.createCanvas(containerWidth, containerHeight);
        canvas.parent('canvas-container');
        p.textFont('Inter');
        p.recalculateLayout();
    };

    p.windowResized = () => {
        const container = document.getElementById('canvas-container');
        containerWidth = container.clientWidth || 600;
        containerHeight = container.clientHeight || 500;
        p.resizeCanvas(containerWidth, containerHeight);
        p.recalculateLayout();
    };

    p.updateLayout = () => {
        p.recalculateLayout();
    };

    p.recalculateLayout = () => {
        const padding = 40;
        const availableHeight = containerHeight - padding * 2;
        floorHeight = availableHeight / controller.numberOfFloors;

        const availableWidth = containerWidth - 100; // room for floor labels
        shaftSpacing = availableWidth / controller.numberOfElevators;
        shaftWidth = Math.min(shaftSpacing * 0.7, 70);
        startX = 80;
        startY = containerHeight - padding;
    };

    p.draw = () => {
        p.background(11, 16, 27);
        
        if (!controller) return;

        // 1. Draw Building Floors & Grid Lines
        p.stroke(255, 255, 255, 15);
        p.strokeWeight(1);
        p.fill(156, 163, 175);
        p.textSize(12);
        p.textAlign(p.RIGHT, p.CENTER);

        for (let f = 0; f < controller.numberOfFloors; f++) {
            const y = startY - f * floorHeight;
            p.line(startX - 20, y, containerWidth - 30, y);
            p.noStroke();
            p.text(`Flr ${f}`, startX - 25, y - floorHeight / 2);
            p.stroke(255, 255, 255, 15);
        }

        // 2. Draw Shafts & Cabins
        controller.elevators.forEach((cabin, index) => {
            const shaftX = startX + index * shaftSpacing + shaftSpacing / 2;

            // Draw Elevator Shaft Background
            p.fill(17, 24, 39, 180);
            p.stroke(255, 255, 255, 30);
            p.rect(shaftX - shaftWidth / 2, startY - controller.numberOfFloors * floorHeight, shaftWidth, controller.numberOfFloors * floorHeight, 6);

            // Draw Cabin Header Label
            p.noStroke();
            p.fill(59, 130, 246);
            p.textAlign(p.CENTER, p.BOTTOM);
            p.textSize(13);
            p.textStyle(p.BOLD);
            p.text(`[${cabin.alphaId}]`, shaftX, startY - controller.numberOfFloors * floorHeight - 8);

            // Lerp Y Position for smooth 60fps movement
            cabin.renderY = p.lerp(cabin.renderY, cabin.currentFloor, 0.08);
            const cabinY = startY - cabin.renderY * floorHeight - floorHeight + 4;
            const cabinHeight = floorHeight - 8;

            // Draw Cabin Body
            p.fill(30, 41, 59);
            p.stroke(59, 130, 246);
            p.strokeWeight(1.5);
            p.rect(shaftX - shaftWidth / 2 + 2, cabinY, shaftWidth - 4, cabinHeight, 4);

            // Draw Interior & Sliding Doors
            const doorWidth = (shaftWidth - 8) / 2;
            const openOffset = doorWidth * cabin.doorRatio;

            // Cabin interior glowing background
            p.noStroke();
            p.fill(15, 23, 42);
            p.rect(shaftX - shaftWidth / 2 + 4, cabinY + 2, shaftWidth - 8, cabinHeight - 4);

            // Left Door
            p.fill(51, 65, 85);
            p.stroke(100, 116, 139);
            p.rect(shaftX - shaftWidth / 2 + 4 - openOffset, cabinY + 2, doorWidth, cabinHeight - 4, 2);

            // Right Door
            p.rect(shaftX + openOffset, cabinY + 2, doorWidth, cabinHeight - 4, 2);

            // Floor Display Indicator inside cabin
            p.fill(245, 158, 11);
            p.noStroke();
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(10);
            p.textStyle(p.BOLD);
            p.text(`${Math.round(cabin.renderY)}`, shaftX, cabinY + cabinHeight / 2);
        });

        // Continuously refresh top header telemetry bar
        updateTelemetryBar();
    };
};

// Initialize App & Canvas on Load
window.addEventListener('DOMContentLoaded', () => {
    updateUI();
    p5Instance = new p5(p5Sketch);
});
