# 💽 Disk Scheduling Algorithm Simulator

An interactive, single-page **Disk Scheduling Algorithm Simulator** built with modern web technologies (HTML5, Tailwind CSS, Canvas 2D/SVG, and Web Audio API). Designed for students, educators, and systems engineers to explore, visualize, and benchmark hard disk read/write head trajectories.

![Simulator Screenshot Preview](assets/preview.png)

---

## 🌟 Key Features

### 1. Six Core OS Disk Scheduling Algorithms
- **FCFS** (*First-Come, First-Served*): Services cylinders in the strict arrival sequence. Zero starvation risk, but high variance and seek times.
- **SSTF** (*Shortest Seek Time First*): Greedy optimization selecting the pending request with minimal seek distance from current head. Reduces total seek but introduces starvation risks for edge requests.
- **SCAN** (*Elevator Algorithm*): Sweeps toward the disk boundary (cylinder `0` or `Disk Size - 1`), servicing requests along the way before reversing. Provides bounded wait times.
- **C-SCAN** (*Circular SCAN*): Sweeps toward one boundary, then performs an immediate circular return jump to the opposite boundary *without* servicing requests on return, ensuring uniform wait times across tracks.
- **LOOK** (*Look-Ahead Elevator*): Optimizes SCAN by reversing immediately at the furthest pending request in the current direction, avoiding unnecessary trips to cylinder boundaries.
- **C-LOOK** (*Circular LOOK*): Optimizes C-SCAN by jumping directly from the furthest request in one direction to the furthest request at the opposite extreme.

---

## 📊 Textbook Benchmark Verification

Tested and verified against the definitive benchmark from **Silberschatz, Galvin, and Gagne's *Operating System Concepts***:
- **Request Queue:** `[98, 183, 37, 122, 14, 124, 65, 67]`
- **Initial Head:** `53`
- **Disk Size:** `200` cylinders (`0` to `199`)
- **Direction:** `Right / Towards 199` (unless noted)

| Algorithm | Direction | Trajectory / Path | Total Movement | Servicing Movement | Avg Seek / Req |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **FCFS** | Sequential | `53 → 98 → 183 → 37 → 122 → 14 → 124 → 65 → 67` | **640 cyl** | 640 cyl | 80.00 |
| **SSTF** | Right | `53 → 65 → 67 → 37 → 14 → 98 → 122 → 124 → 183` | **236 cyl** | 236 cyl | 29.50 |
| **SCAN** | Right | `53 → 65 → 67 → 98 → 122 → 124 → 183 → 199 → 37 → 14` | **331 cyl** | 331 cyl | 41.38 |
| **SCAN** | Left | `53 → 37 → 14 → 0 → 65 → 67 → 98 → 122 → 124 → 183` | **236 cyl** | 236 cyl | 29.50 |
| **C-SCAN** | Right | `53 → 65 → 67 → 98 → 122 → 124 → 183 → 199 → [0] → 14 → 37` | **382 cyl** | 183 cyl | 47.75 |
| **LOOK** | Right | `53 → 65 → 67 → 98 → 122 → 124 → 183 → 37 → 14` | **299 cyl** | 299 cyl | 37.38 |
| **LOOK** | Left | `53 → 37 → 14 → 65 → 67 → 98 → 122 → 124 → 183` | **208 cyl** | 208 cyl | 26.00 |
| **C-LOOK** | Right | `53 → 65 → 67 → 98 → 122 → 124 → 183 → [14] → 37` | **322 cyl** | 153 cyl | 40.25 |

---

## 🖥️ User Interface & Visualizations

1. **Dual Visualizer Engine:**
   - **📈 Time-Step Seek Graph:** High-DPI canvas charting Cylinder Numbers (X-axis, `0` to `Max-1`) against Sequential Time Steps (Y-axis, downward). Features directional seek arrowheads, distance badges (`Δ = seek distance`), solid dots for serviced requests, hollow diamonds for boundary turnaround, and dashed neon trails for return jumps.
   - **💿 Mechanical Disk Platter & Actuator Arm:** Realistic 2D rotating magnetic disk platter with metallic sheen, concentric cylinder tracks, and an animated pivoting actuator arm that swings its read/write head slider over the active cylinder.
   - **◫ Split View:** View both the trajectory chart and rotating mechanical platter side-by-side!

2. **Playback Controls & Keyboard Shortcuts:**
   - `Play / Pause` with smooth interpolated head cursor motion (`Spacebar`).
   - `Step Forward` (`Right Arrow`) and `Step Backward` (`Left Arrow`).
   - `Reset` (`Home` or `R`).
   - `Step Scrubber` for instant scrubbing to any point in the seek sequence.
   - Speed Slider from `0.5x` to `3.0x`.
   - Procedural Web Audio API sound effects for realistic mechanical HDD actuator seek clicks.

3. **Metrics Dashboard & Real-Time Inspector:**
   - Live **Total Head Movement**, **Average Seek Distance**, **Step Count**, and **Live Head Position**.
   - Interactive step sequence ribbon with clickable step pills that jump directly to that step.
   - Natural language explanation describing why the algorithm selected that cylinder next.

4. **Side-by-Side Comparison Table:**
   - Automatically computes and ranks all 6 algorithms on the current input parameters by Total Head Movement.
   - Shows medals (🥇, 🥈, 🥉), percentage differences vs. best, relative bar charts, and one-click "Simulate" buttons.

5. **Input Validation & Presets:**
   - Live validation flags out-of-bounds cylinders, non-integers, and duplicates.
   - Presets include: *Silberschatz Classic*, *Outer Track Heavy*, *Inner Track Heavy*, *Bimodal Extremes*, *Pre-Sorted Ascending*, and *Pre-Sorted Descending*.
   - "Randomize Queue" button (8–12 valid cylinders).
   - "Sort" and "Clear" queue utilities.

---

## 🚀 How to Run

Zero build steps or external dependencies required! You can run it directly:

### Option 1: Direct File Open
Double click `index.html` or open it directly in any modern browser:
```bash
# Windows
start index.html
```

### Option 2: Local HTTP Server
Run with Python's built-in HTTP server:
```bash
python -m http.server 8000
```
Then visit `http://localhost:8000` in your web browser.

---

## 📁 Project Architecture

```
disk_scheduling_simulator/
├── index.html           # Semantic HTML5 layout & responsive UI
├── css/
│   └── styles.css       # Dark developer theme, glassmorphism, scrollbars, sliders
├── js/
│   ├── algorithms.js    # Pure mathematical logic & step telemetry for all 6 algorithms
│   ├── visualizer.js    # High-DPI Canvas Seek Graph (Time vs Cylinder) & Compare All
│   ├── platter.js       # Rotating 2D Hard Disk Platter & Actuator Arm visualizer
│   ├── sound.js         # Procedural Web Audio API actuator click synthesizer
│   └── app.js           # State controller, playback engine, validation & event handlers
└── README.md            # Documentation, benchmark verification, and user guide
```

---

## 📜 License
MIT License. Free to use for educational and research purposes.
