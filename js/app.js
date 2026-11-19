/**
 * Main Application Controller for Disk Scheduling Simulator
 * Manages UI interactions, inputs, validation, animation playback loop,
 * metrics calculation, comparison table rendering, and visualizer syncing.
 */

(function () {
  'use strict';

  // Presets catalogue
  const PRESETS = {
    silberschatz: {
      name: 'Silberschatz Classic (OS Benchmark)',
      head: 53,
      size: 200,
      direction: 'right',
      requests: [98, 183, 37, 122, 14, 124, 65, 67],
      description: 'The definitive textbook example from Operating System Concepts.'
    },
    outer_heavy: {
      name: 'Outer Track Heavy (High Cylinders)',
      head: 40,
      size: 200,
      direction: 'right',
      requests: [160, 185, 172, 195, 140, 190, 168, 180],
      description: 'Requests heavily clustered near the maximum cylinder boundary.'
    },
    inner_heavy: {
      name: 'Inner Track Heavy (Near 0)',
      head: 150,
      size: 200,
      direction: 'left',
      requests: [10, 25, 5, 38, 14, 2, 45, 18],
      description: 'Requests clustered near spindle cylinder 0.'
    },
    bimodal_extremes: {
      name: 'Bimodal Extremes (Boundary Stress)',
      head: 100,
      size: 200,
      direction: 'right',
      requests: [2, 198, 5, 195, 12, 190, 8, 199],
      description: 'Alternating extremes testing elevator bounce and circular return jump performance.'
    },
    sorted_asc: {
      name: 'Pre-Sorted Ascending',
      head: 20,
      size: 200,
      direction: 'right',
      requests: [35, 60, 85, 110, 135, 160, 185],
      description: 'Monotonically increasing request sequence.'
    },
    sorted_desc: {
      name: 'Pre-Sorted Descending',
      head: 180,
      size: 200,
      direction: 'left',
      requests: [165, 140, 115, 90, 65, 40, 15],
      description: 'Monotonically decreasing request sequence.'
    }
  };

  // State object
  const state = {
    selectedAlgorithm: 'SSTF', // 'FCFS', 'SSTF', 'SCAN', 'C-SCAN', 'LOOK', 'C-LOOK', 'COMPARE_ALL'
    requests: [98, 183, 37, 122, 14, 124, 65, 67],
    initialHead: 53,
    diskSize: 200,
    direction: 'right', // 'right' or 'left'
    playbackSpeed: 1.0,
    isPlaying: false,
    currentStep: 0,
    stepFraction: 0,
    lastFrameTime: 0,
    viewMode: 'chart', // 'chart', 'platter', 'split'
    audioEnabled: false,
    results: null, // single algo result
    allResults: null // comparison results array
  };

  let seekVis = null;
  let platterVis = null;
  let animFrameId = null;

  // DOM Elements cache
  const dom = {};

  function initDOM() {
    dom.algoButtons = document.querySelectorAll('[data-algo]');
    dom.requestInput = document.getElementById('requestInput');
    dom.headInput = document.getElementById('headInput');
    dom.headSlider = document.getElementById('headSlider');
    dom.diskSizeInput = document.getElementById('diskSizeInput');
    dom.dirLeftBtn = document.getElementById('dirLeftBtn');
    dom.dirRightBtn = document.getElementById('dirRightBtn');
    dom.validationAlert = document.getElementById('validationAlert');
    dom.queueBadges = document.getElementById('queueBadges');

    // Controls
    dom.playPauseBtn = document.getElementById('playPauseBtn');
    dom.playPauseIcon = document.getElementById('playPauseIcon');
    dom.playPauseText = document.getElementById('playPauseText');
    dom.stepBackBtn = document.getElementById('stepBackBtn');
    dom.stepFwdBtn = document.getElementById('stepFwdBtn');
    dom.resetBtn = document.getElementById('resetBtn');
    dom.stepScrubber = document.getElementById('stepScrubber');
    dom.stepCounterText = document.getElementById('stepCounterText');
    dom.speedSlider = document.getElementById('speedSlider');
    dom.speedLabel = document.getElementById('speedLabel');
    dom.audioToggle = document.getElementById('audioToggle');

    // Quick Actions
    dom.randomBtn = document.getElementById('randomBtn');
    dom.presetSelect = document.getElementById('presetSelect');
    dom.clearQueueBtn = document.getElementById('clearQueueBtn');
    dom.sortQueueBtn = document.getElementById('sortQueueBtn');

    // View Modes
    dom.viewChartBtn = document.getElementById('viewChartBtn');
    dom.viewPlatterBtn = document.getElementById('viewPlatterBtn');
    dom.viewSplitBtn = document.getElementById('viewSplitBtn');
    dom.chartContainer = document.getElementById('chartContainer');
    dom.platterContainer = document.getElementById('platterContainer');

    // Metrics
    dom.metricTotalMove = document.getElementById('metricTotalMove');
    dom.metricAvgSeek = document.getElementById('metricAvgSeek');
    dom.metricTotalSteps = document.getElementById('metricTotalSteps');
    dom.metricCurrentCyl = document.getElementById('metricCurrentCyl');
    dom.algoBadge = document.getElementById('algoBadge');
    dom.algoRankBadge = document.getElementById('algoRankBadge');

    // Step Sequence & Explanations
    dom.stepSequenceContainer = document.getElementById('stepSequenceContainer');
    dom.stepExplanation = document.getElementById('stepExplanation');

    // Comparison Table
    dom.comparisonTableBody = document.getElementById('comparisonTableBody');

    // Canvas elements
    dom.seekCanvas = document.getElementById('seekCanvas');
    dom.platterCanvas = document.getElementById('platterCanvas');

    // Export & Toast
    dom.exportPngBtn = document.getElementById('exportPngBtn');
    dom.copyMarkdownBtn = document.getElementById('copyMarkdownBtn');
    dom.toast = document.getElementById('toast');
    dom.toastMsg = document.getElementById('toastMsg');
  }

  function showToast(msg, duration = 3000) {
    if (!dom.toast) return;
    dom.toastMsg.textContent = msg;
    dom.toast.classList.remove('opacity-0', 'pointer-events-none');
    dom.toast.classList.add('opacity-100');
    setTimeout(() => {
      dom.toast.classList.remove('opacity-100');
      dom.toast.classList.add('opacity-0', 'pointer-events-none');
    }, duration);
  }

  function initVisualizers() {
    if (dom.seekCanvas) {
      seekVis = new SeekVisualizer.Visualizer(dom.seekCanvas, {
        onStepClick: (stepIdx) => {
          jumpToStep(stepIdx);
        },
        onHover: (stepInfo) => {
          if (stepInfo && stepInfo.reason) {
            dom.stepExplanation.innerHTML = `<span class="text-sky-400 font-semibold">${stepInfo.algoName || ''} Step #${stepInfo.stepIndex}:</span> ${stepInfo.reason}`;
          } else {
            updateStepExplanation();
          }
        }
      });
    }

    if (dom.platterCanvas) {
      platterVis = new PlatterVisualizer.Platter(dom.platterCanvas);
    }
  }

  function bindEvents() {
    // Algorithm Selection Buttons
    dom.algoButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const algo = btn.getAttribute('data-algo');
        setAlgorithm(algo);
      });
    });

    // Request input typing
    dom.requestInput.addEventListener('input', () => {
      parseRequestInput();
    });

    // Head input & slider sync
    dom.headInput.addEventListener('input', () => {
      let val = parseInt(dom.headInput.value, 10);
      if (isNaN(val)) val = 0;
      val = Math.max(0, Math.min(state.diskSize - 1, val));
      state.initialHead = val;
      dom.headSlider.value = val;
      recompute();
    });

    dom.headSlider.addEventListener('input', () => {
      const val = parseInt(dom.headSlider.value, 10);
      state.initialHead = val;
      dom.headInput.value = val;
      recompute();
    });

    // Disk Size Input
    dom.diskSizeInput.addEventListener('input', () => {
      let val = parseInt(dom.diskSizeInput.value, 10);
      if (isNaN(val) || val < 10) val = 10;
      state.diskSize = val;
      dom.headSlider.max = val - 1;
      if (state.initialHead >= val) {
        state.initialHead = val - 1;
        dom.headInput.value = state.initialHead;
        dom.headSlider.value = state.initialHead;
      }
      parseRequestInput();
    });

    // Direction Toggles
    dom.dirLeftBtn.addEventListener('click', () => {
      setDirection('left');
    });

    dom.dirRightBtn.addEventListener('click', () => {
      setDirection('right');
    });

    // Playback buttons
    dom.playPauseBtn.addEventListener('click', togglePlayPause);
    dom.stepFwdBtn.addEventListener('click', stepForward);
    dom.stepBackBtn.addEventListener('click', stepBackward);
    dom.resetBtn.addEventListener('click', resetPlayback);

    // Scrubber
    dom.stepScrubber.addEventListener('input', (e) => {
      pause();
      const step = parseInt(e.target.value, 10);
      jumpToStep(step);
    });

    // Speed Slider
    dom.speedSlider.addEventListener('input', (e) => {
      const spd = parseFloat(e.target.value);
      state.playbackSpeed = spd;
      dom.speedLabel.textContent = `${spd.toFixed(1)}x`;
    });

    // Audio Toggle
    if (dom.audioToggle) {
      dom.audioToggle.addEventListener('change', (e) => {
        state.audioEnabled = e.target.checked;
        DiskSound.setEnabled(state.audioEnabled);
        showToast(state.audioEnabled ? 'Actuator seek audio enabled' : 'Seek audio muted');
      });
    }

    // Quick Actions
    dom.randomBtn.addEventListener('click', randomizeQueue);
    dom.clearQueueBtn.addEventListener('click', clearQueue);
    dom.sortQueueBtn.addEventListener('click', sortQueue);
    dom.presetSelect.addEventListener('change', (e) => {
      loadPreset(e.target.value);
    });

    // View Mode Toggles
    dom.viewChartBtn.addEventListener('click', () => setViewMode('chart'));
    dom.viewPlatterBtn.addEventListener('click', () => setViewMode('platter'));
    dom.viewSplitBtn.addEventListener('click', () => setViewMode('split'));

    // Export & Copy
    if (dom.exportPngBtn) dom.exportPngBtn.addEventListener('click', exportChartPNG);
    if (dom.copyMarkdownBtn) dom.copyMarkdownBtn.addEventListener('click', copyMarkdownReport);

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        stepForward();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        stepBackward();
      } else if (e.code === 'KeyR' || e.code === 'Home') {
        e.preventDefault();
        resetPlayback();
      }
    });
  }

  function setViewMode(mode) {
    state.viewMode = mode;
    const btns = [dom.viewChartBtn, dom.viewPlatterBtn, dom.viewSplitBtn];
    btns.forEach(b => b.classList.remove('bg-sky-600', 'text-white'));

    if (mode === 'chart') {
      dom.viewChartBtn.classList.add('bg-sky-600', 'text-white');
      dom.chartContainer.classList.remove('hidden');
      dom.chartContainer.className = 'w-full';
      dom.platterContainer.classList.add('hidden');
    } else if (mode === 'platter') {
      dom.viewPlatterBtn.classList.add('bg-sky-600', 'text-white');
      dom.chartContainer.classList.add('hidden');
      dom.platterContainer.classList.remove('hidden');
      dom.platterContainer.className = 'w-full';
    } else if (mode === 'split') {
      dom.viewSplitBtn.classList.add('bg-sky-600', 'text-white');
      dom.chartContainer.classList.remove('hidden');
      dom.chartContainer.className = 'w-full lg:w-3/5';
      dom.platterContainer.classList.remove('hidden');
      dom.platterContainer.className = 'w-full lg:w-2/5';
    }

    // Trigger resize on visualizers
    setTimeout(() => {
      if (seekVis) {
        seekVis.resize();
        seekVis.render();
      }
      if (platterVis) {
        platterVis.resize();
      }
    }, 50);
  }

  function setAlgorithm(algo) {
    state.selectedAlgorithm = algo;
    dom.algoButtons.forEach(btn => {
      const match = btn.getAttribute('data-algo') === algo;
      if (match) {
        btn.classList.add('ring-2', 'ring-sky-400', 'bg-slate-700/80', 'text-white');
        btn.classList.remove('text-slate-300', 'bg-slate-800/40');
      } else {
        btn.classList.remove('ring-2', 'ring-sky-400', 'bg-slate-700/80', 'text-white');
        btn.classList.add('text-slate-300', 'bg-slate-800/40');
      }
    });

    recompute();
  }

  function setDirection(dir) {
    state.direction = dir;
    if (dir === 'left') {
      dom.dirLeftBtn.classList.add('bg-sky-600', 'text-white', 'shadow-md');
      dom.dirLeftBtn.classList.remove('text-slate-400');
      dom.dirRightBtn.classList.remove('bg-sky-600', 'text-white', 'shadow-md');
      dom.dirRightBtn.classList.add('text-slate-400');
    } else {
      dom.dirRightBtn.classList.add('bg-sky-600', 'text-white', 'shadow-md');
      dom.dirRightBtn.classList.remove('text-slate-400');
      dom.dirLeftBtn.classList.remove('bg-sky-600', 'text-white', 'shadow-md');
      dom.dirLeftBtn.classList.add('text-slate-400');
    }
    recompute();
  }

  function parseRequestInput() {
    const raw = dom.requestInput.value;
    const tokens = raw.split(/[\s,]+/).filter(t => t.trim().length > 0);
    const valid = [];
    const errors = [];

    tokens.forEach((token, idx) => {
      const num = Number(token);
      if (isNaN(num) || !Number.isInteger(num)) {
        errors.push(`Token "${token}" is not a valid integer`);
      } else if (num < 0 || num >= state.diskSize) {
        errors.push(`Cylinder ${num} is outside bounds [0, ${state.diskSize - 1}]`);
      } else {
        valid.push(num);
      }
    });

    if (errors.length > 0) {
      dom.validationAlert.textContent = errors.join(' • ');
      dom.validationAlert.classList.remove('hidden');
    } else {
      dom.validationAlert.classList.add('hidden');
    }

    state.requests = valid;
    renderQueueBadges();
    recompute();
  }

  function renderQueueBadges() {
    dom.queueBadges.innerHTML = '';
    state.requests.forEach((req, idx) => {
      const badge = document.createElement('span');
      badge.className = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-800 border border-slate-700 text-sky-300 hover:border-rose-500 hover:text-rose-400 transition-colors cursor-pointer';
      badge.title = 'Click to remove this request';
      badge.innerHTML = `${req} <span class="ml-1 text-slate-500 hover:text-rose-400 font-bold">&times;</span>`;
      badge.addEventListener('click', () => {
        state.requests.splice(idx, 1);
        dom.requestInput.value = state.requests.join(', ');
        renderQueueBadges();
        recompute();
      });
      dom.queueBadges.appendChild(badge);
    });
  }

  function randomizeQueue() {
    const count = 8 + Math.floor(Math.random() * 5); // 8 to 12
    const set = new Set();
    const max = state.diskSize - 1;

    while (set.size < count) {
      set.add(Math.floor(Math.random() * (max + 1)));
    }

    state.requests = Array.from(set);
    dom.requestInput.value = state.requests.join(', ');
    renderQueueBadges();
    recompute();
    showToast(`Generated ${count} randomized cylinder requests`);
  }

  function clearQueue() {
    state.requests = [];
    dom.requestInput.value = '';
    renderQueueBadges();
    recompute();
  }

  function sortQueue() {
    state.requests.sort((a, b) => a - b);
    dom.requestInput.value = state.requests.join(', ');
    renderQueueBadges();
    recompute();
    showToast('Request queue sorted ascending');
  }

  function loadPreset(key) {
    if (!PRESETS[key]) return;
    const p = PRESETS[key];
    state.initialHead = p.head;
    state.diskSize = p.size;
    state.direction = p.direction;
    state.requests = [...p.requests];

    dom.headInput.value = p.head;
    dom.headSlider.value = p.head;
    dom.headSlider.max = p.size - 1;
    dom.diskSizeInput.value = p.size;
    dom.requestInput.value = p.requests.join(', ');
    setDirection(p.direction);
    renderQueueBadges();
    recompute();
    showToast(`Loaded preset: ${p.name}`);
  }

  function recompute() {
    pause();
    const reqs = state.requests;
    const head = state.initialHead;
    const size = state.diskSize;
    const dir = state.direction;

    // Compute comparison for all 6
    state.allResults = DiskAlgorithms.compareAll(reqs, head, size, dir);

    // Compute active algorithm result
    if (state.selectedAlgorithm === 'COMPARE_ALL') {
      state.results = state.allResults[0]; // fallback top rank for step timeline
    } else {
      switch (state.selectedAlgorithm) {
        case 'FCFS': state.results = DiskAlgorithms.fcfs(reqs, head, size); break;
        case 'SSTF': state.results = DiskAlgorithms.sstf(reqs, head, size, dir); break;
        case 'SCAN': state.results = DiskAlgorithms.scan(reqs, head, size, dir); break;
        case 'C-SCAN': state.results = DiskAlgorithms.cscan(reqs, head, size, dir); break;
        case 'LOOK': state.results = DiskAlgorithms.look(reqs, head, size, dir); break;
        case 'C-LOOK': state.results = DiskAlgorithms.clook(reqs, head, size, dir); break;
        default: state.results = DiskAlgorithms.sstf(reqs, head, size, dir); break;
      }
    }

    // Attach rank information from comparison to single result
    const rankInfo = state.allResults.find(r => r.name === state.results.name);
    if (rankInfo) {
      state.results.rank = rankInfo.rank;
      state.results.diffPercent = rankInfo.diffPercent;
    }

    // Update scrubber bounds
    const totalSteps = state.results.steps.length;
    dom.stepScrubber.max = Math.max(0, totalSteps - 1);
    state.currentStep = 0;
    state.stepFraction = 0;
    dom.stepScrubber.value = 0;

    updateMetrics();
    renderStepSequence();
    renderComparisonTable();
    syncVisualizers();
    updateStepExplanation();
  }

  function updateMetrics() {
    const res = state.results;
    if (!res) return;

    dom.metricTotalMove.textContent = `${res.totalHeadMovement}`;
    dom.metricAvgSeek.textContent = `${res.averageSeekTime}`;
    dom.metricTotalSteps.textContent = `${res.steps.length - 1}`;
    dom.metricCurrentCyl.textContent = `${res.steps[state.currentStep] ? res.steps[state.currentStep].cylinder : state.initialHead}`;

    dom.algoBadge.textContent = state.selectedAlgorithm === 'COMPARE_ALL' ? 'Compare All (Overlay)' : res.name;

    if (res.rank === 1) {
      dom.algoRankBadge.className = 'px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
      dom.algoRankBadge.textContent = '🥇 Optimal (Rank #1)';
    } else if (res.rank === 2) {
      dom.algoRankBadge.className = 'px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-500/20 text-slate-300 border border-slate-400/40';
      dom.algoRankBadge.textContent = `🥈 Rank #${res.rank} (+${res.diffPercent}%)`;
    } else if (res.rank === 3) {
      dom.algoRankBadge.className = 'px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/40';
      dom.algoRankBadge.textContent = `🥉 Rank #${res.rank} (+${res.diffPercent}%)`;
    } else {
      dom.algoRankBadge.className = 'px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/40';
      dom.algoRankBadge.textContent = `Rank #${res.rank} (+${res.diffPercent}%)`;
    }
  }

  function renderStepSequence() {
    dom.stepSequenceContainer.innerHTML = '';
    const steps = state.results.steps;

    steps.forEach((step, idx) => {
      const isCurrent = idx === state.currentStep;
      const isPast = idx < state.currentStep;

      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `flex-shrink-0 flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all ${
        isCurrent
          ? 'bg-sky-500/20 border-sky-400 text-white shadow-lg ring-1 ring-sky-400'
          : isPast
          ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
          : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'
      }`;

      let icon = '';
      if (step.type === 'initial') {
        icon = '<span class="text-amber-400 font-bold">H:</span>';
      } else if (step.type === 'boundary') {
        icon = '<span class="text-purple-400">↺</span>';
      } else if (step.type === 'return_jump') {
        icon = '<span class="text-rose-400">↷</span>';
      } else {
        icon = '<span class="text-emerald-400">✓</span>';
      }

      const distBadge = step.fromCylinder !== null ? `<span class="text-[10px] text-sky-400 ml-1">Δ${step.distance}</span>` : '';

      pill.innerHTML = `<span>t${idx}</span> ${icon} <span class="font-bold text-white">${step.cylinder}</span> ${distBadge}`;
      pill.addEventListener('click', () => {
        jumpToStep(idx);
      });

      dom.stepSequenceContainer.appendChild(pill);
    });

    // Auto-scroll active pill into view
    const activePill = dom.stepSequenceContainer.children[state.currentStep];
    if (activePill) {
      activePill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  function updateStepExplanation() {
    const steps = state.results.steps;
    const step = steps[state.currentStep];
    if (!step) return;

    dom.stepCounterText.textContent = `Step ${state.currentStep} of ${steps.length - 1}`;
    dom.stepExplanation.innerHTML = `<span class="text-sky-400 font-semibold">Step #${step.stepIndex}:</span> ${step.reason}`;
  }

  function renderComparisonTable() {
    dom.comparisonTableBody.innerHTML = '';
    const minMove = state.allResults[0].totalHeadMovement;

    state.allResults.forEach(algo => {
      const isSelected = state.selectedAlgorithm === algo.name;
      const row = document.createElement('tr');
      row.className = `border-b border-slate-800 hover:bg-slate-800/40 transition-colors ${isSelected ? 'bg-sky-500/10' : ''}`;

      let rankBadge = '';
      if (algo.rank === 1) rankBadge = '<span class="text-amber-400 font-bold text-sm">🥇 1st</span>';
      else if (algo.rank === 2) rankBadge = '<span class="text-slate-300 font-bold text-sm">🥈 2nd</span>';
      else if (algo.rank === 3) rankBadge = '<span class="text-amber-600 font-bold text-sm">🥉 3rd</span>';
      else rankBadge = `<span class="text-slate-400 font-mono text-sm">${algo.rank}th</span>`;

      // Relative bar width
      const barPercent = minMove > 0 ? Math.min(100, Math.round((algo.totalHeadMovement / minMove) * 45)) : 10;

      row.innerHTML = `
        <td class="py-3 px-3">${rankBadge}</td>
        <td class="py-3 px-3">
          <div class="font-semibold text-white flex items-center space-x-2">
            <span>${algo.name}</span>
            ${isSelected ? '<span class="px-1.5 py-0.5 rounded text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/40">Active</span>' : ''}
          </div>
          <div class="text-xs text-slate-400">${algo.fullName}</div>
        </td>
        <td class="py-3 px-3">
          <div class="font-mono font-bold text-sky-400 text-sm">${algo.totalHeadMovement} <span class="text-xs font-normal text-slate-400">cyl</span></div>
          <div class="w-24 bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
            <div class="bg-sky-500 h-full rounded-full" style="width: ${barPercent}%"></div>
          </div>
        </td>
        <td class="py-3 px-3 font-mono text-slate-300 text-sm">
          ${algo.servicingMovement} cyl
        </td>
        <td class="py-3 px-3 font-mono text-slate-300 text-sm">
          ${algo.averageSeekTime}
        </td>
        <td class="py-3 px-3">
          ${algo.diffPercent == 0 ? '<span class="text-emerald-400 font-bold text-xs">Best (0%)</span>' : `<span class="text-rose-400 font-mono text-xs">+${algo.diffPercent}%</span>`}
        </td>
        <td class="py-3 px-3 text-right">
          <button class="select-algo-btn px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white border border-slate-700 transition-colors font-medium">
            Simulate
          </button>
        </td>
      `;

      row.querySelector('.select-algo-btn').addEventListener('click', () => {
        setAlgorithm(algo.name);
      });

      dom.comparisonTableBody.appendChild(row);
    });
  }

  function syncVisualizers() {
    const isCompare = state.selectedAlgorithm === 'COMPARE_ALL';
    if (seekVis) {
      seekVis.setData({
        result: state.results,
        allResults: state.allResults,
        isCompareAll: isCompare,
        diskSize: state.diskSize,
        requests: state.requests,
        initialHead: state.initialHead,
        currentStep: state.currentStep
      });
    }

    if (platterVis && state.results && state.results.steps.length > 0) {
      const step = state.results.steps[state.currentStep] || state.results.steps[0];
      platterVis.setData({
        diskSize: state.diskSize,
        requests: state.requests,
        currentCylinder: step.cylinder,
        activeStep: step
      });
    }
  }

  // Playback Loop
  function togglePlayPause() {
    if (state.isPlaying) {
      pause();
    } else {
      play();
    }
  }

  function play() {
    const totalSteps = state.results.steps.length;
    if (state.currentStep >= totalSteps - 1) {
      state.currentStep = 0;
      state.stepFraction = 0;
    }
    state.isPlaying = true;
    dom.playPauseText.textContent = 'Pause';
    dom.playPauseIcon.innerHTML = '&#10074;&#10074;';
    dom.playPauseBtn.classList.add('bg-amber-600', 'hover:bg-amber-500');
    dom.playPauseBtn.classList.remove('bg-emerald-600', 'hover:bg-emerald-500');

    state.lastFrameTime = performance.now();
    startAnimationLoop();
  }

  function pause() {
    state.isPlaying = false;
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    dom.playPauseText.textContent = 'Play';
    dom.playPauseIcon.innerHTML = '&#9654;';
    dom.playPauseBtn.classList.remove('bg-amber-600', 'hover:bg-amber-500');
    dom.playPauseBtn.classList.add('bg-emerald-600', 'hover:bg-emerald-500');
  }

  function resetPlayback() {
    pause();
    state.currentStep = 0;
    state.stepFraction = 0;
    dom.stepScrubber.value = 0;
    syncVisualizers();
    updateMetrics();
    renderStepSequence();
    updateStepExplanation();
  }

  function stepForward() {
    pause();
    const totalSteps = state.results.steps.length;
    if (state.currentStep < totalSteps - 1) {
      jumpToStep(state.currentStep + 1);
    }
  }

  function stepBackward() {
    pause();
    if (state.currentStep > 0) {
      jumpToStep(state.currentStep - 1);
    }
  }

  function jumpToStep(stepIdx) {
    const totalSteps = state.results.steps.length;
    state.currentStep = Math.max(0, Math.min(totalSteps - 1, stepIdx));
    state.stepFraction = 0;
    dom.stepScrubber.value = state.currentStep;

    const step = state.results.steps[state.currentStep];
    if (step && state.audioEnabled) {
      DiskSound.playSeek(step.distance, step.type === 'return_jump');
      if (step.isServiced) {
        setTimeout(() => DiskSound.playService(), 50);
      }
    }

    if (seekVis) seekVis.setPlaybackStep(state.currentStep, 0);
    if (platterVis && step) platterVis.setCylinder(step.cylinder, step.isServiced);

    updateMetrics();
    renderStepSequence();
    updateStepExplanation();
  }

  function startAnimationLoop() {
    const stepDurationMs = 800 / state.playbackSpeed;

    const loop = (now) => {
      if (!state.isPlaying) return;

      const delta = now - state.lastFrameTime;
      state.lastFrameTime = now;

      state.stepFraction += delta / stepDurationMs;

      if (state.stepFraction >= 1.0) {
        state.stepFraction = 0;
        const totalSteps = state.results.steps.length;

        if (state.currentStep < totalSteps - 1) {
          state.currentStep++;
          dom.stepScrubber.value = state.currentStep;

          const step = state.results.steps[state.currentStep];
          if (step && state.audioEnabled) {
            DiskSound.playSeek(step.distance, step.type === 'return_jump');
            if (step.isServiced) {
              setTimeout(() => DiskSound.playService(), 50);
            }
          }

          if (platterVis && step) platterVis.setCylinder(step.cylinder, step.isServiced);
          updateMetrics();
          renderStepSequence();
          updateStepExplanation();
        } else {
          pause();
          return;
        }
      }

      if (seekVis) {
        seekVis.setPlaybackStep(state.currentStep, state.stepFraction);
      }

      animFrameId = requestAnimationFrame(loop);
    };

    animFrameId = requestAnimationFrame(loop);
  }

  // Export functions
  function exportChartPNG() {
    if (!dom.seekCanvas) return;
    try {
      const link = document.createElement('a');
      link.download = `disk_seek_${state.results.name.toLowerCase()}_${Date.now()}.png`;
      link.href = dom.seekCanvas.toDataURL('image/png');
      link.click();
      showToast('Chart exported as PNG image');
    } catch (e) {
      showToast('Export failed: Canvas context error');
    }
  }

  function copyMarkdownReport() {
    if (!state.results || !state.allResults) return;

    let md = `### Disk Scheduling Algorithm Simulation Report\n`;
    md += `**Parameters:**\n`;
    md += `- Initial Head Position: ${state.initialHead}\n`;
    md += `- Disk Size: ${state.diskSize} (Cylinders 0 to ${state.diskSize - 1})\n`;
    md += `- Initial Direction: ${state.direction.toUpperCase()}\n`;
    md += `- Request Queue: [${state.requests.join(', ')}]\n\n`;

    md += `#### Algorithm Comparison Ranking\n`;
    md += `| Rank | Algorithm | Total Movement | Servicing Seek | Avg Seek / Req | Diff vs Best |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    state.allResults.forEach(r => {
      md += `| #${r.rank} | ${r.name} | ${r.totalHeadMovement} cyl | ${r.servicingMovement} cyl | ${r.averageSeekTime} | ${r.diffPercent == 0 ? 'Optimal' : '+' + r.diffPercent + '%'} |\n`;
    });

    md += `\n#### Active Seek Sequence (${state.results.name})\n`;
    md += state.results.steps.map(s => `${s.cylinder}${s.distance ? ' (Δ' + s.distance + ')' : ''}`).join(' → ') + '\n';

    navigator.clipboard.writeText(md).then(() => {
      showToast('Results copied to clipboard as Markdown');
    }).catch(() => {
      showToast('Clipboard access denied');
    });
  }

  // Bootstrap initialization
  window.addEventListener('DOMContentLoaded', () => {
    initDOM();
    initVisualizers();
    bindEvents();
    renderQueueBadges();
    recompute();
  });

})();
