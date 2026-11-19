/**
 * Seek Graph Visualizer
 * High-DPI HTML5 Canvas rendering engine for Disk Scheduling Simulator.
 * Renders Time vs Cylinder trajectory with directional arrows, distance badges,
 * boundary/jump indicators, animated read/write head marker, and Compare All overlay.
 */

const SeekVisualizer = (function () {
  'use strict';

  // High-contrast neon developer color palette for algorithms
  const ALGO_COLORS = {
    'FCFS': { stroke: '#38bdf8', glow: 'rgba(56, 189, 248, 0.4)', fill: '#0284c7' },     // Sky Blue
    'SSTF': { stroke: '#34d399', glow: 'rgba(52, 211, 153, 0.4)', fill: '#059669' },     // Emerald
    'SCAN': { stroke: '#a78bfa', glow: 'rgba(167, 139, 250, 0.4)', fill: '#7c3aed' },    // Purple
    'C-SCAN': { stroke: '#f43f5e', glow: 'rgba(244, 63, 94, 0.4)', fill: '#e11d48' },    // Rose
    'LOOK': { stroke: '#fbbf24', glow: 'rgba(251, 191, 36, 0.4)', fill: '#d97706' },     // Amber
    'C-LOOK': { stroke: '#2dd4bf', glow: 'rgba(45, 212, 191, 0.4)', fill: '#0d9488' }    // Teal
  };

  class Visualizer {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.options = Object.assign({
        onStepClick: null,
        onHover: null
      }, options);

      this.data = null; // single algorithm result or array for compare all
      this.isCompareAll = false;
      this.activeAlgoName = 'SSTF';
      this.currentStepIndex = 0;
      this.playbackProgress = 0; // fractional progress for smooth interpolation (0.0 to steps.length-1)
      this.hoveredStep = null;
      this.hoveredAlgo = null;
      this.diskSize = 200;
      this.requests = [];
      this.initialHead = 53;

      // Layout metrics
      this.padding = { top: 60, bottom: 40, left: 75, right: 40 };
      this.width = 800;
      this.height = 500;
      this.dpr = window.devicePixelRatio || 1;

      // Tooltip state
      this.mousePos = { x: -100, y: -100 };
      this.interactiveElements = []; // { x, y, radius, step, algoName }

      this.initEvents();
      this.resize();
    }

    initEvents() {
      const handleMove = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mousePos = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        this.checkHover();
      };

      const handleLeave = () => {
        this.mousePos = { x: -100, y: -100 };
        this.hoveredStep = null;
        if (this.options.onHover) {
          this.options.onHover(null);
        }
        this.render();
      };

      const handleClick = () => {
        if (this.hoveredStep && this.options.onStepClick) {
          this.options.onStepClick(this.hoveredStep.step.stepIndex);
        }
      };

      this.canvas.addEventListener('mousemove', handleMove);
      this.canvas.addEventListener('mouseleave', handleLeave);
      this.canvas.addEventListener('click', handleClick);

      window.addEventListener('resize', () => {
        this.resize();
        this.render();
      });
    }

    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.width = Math.max(300, rect.width);
      this.height = Math.max(450, Math.min(650, window.innerHeight * 0.6));

      this.dpr = window.devicePixelRatio || 1;
      this.canvas.width = this.width * this.dpr;
      this.canvas.height = this.height * this.dpr;
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;

      this.ctx.scale(this.dpr, this.dpr);
    }

    setData({ result, allResults = null, isCompareAll = false, diskSize = 200, requests = [], initialHead = 53, currentStep = 0 }) {
      this.result = result;
      this.allResults = allResults;
      this.isCompareAll = isCompareAll;
      this.diskSize = Math.max(1, diskSize);
      this.requests = requests;
      this.initialHead = initialHead;
      this.currentStepIndex = currentStep;
      this.playbackProgress = currentStep;
      this.render();
    }

    setPlaybackStep(stepIndex, fraction = 0) {
      this.currentStepIndex = stepIndex;
      this.playbackProgress = stepIndex + fraction;
      this.render();
    }

    getCylinderX(cylinder) {
      const plotWidth = this.width - this.padding.left - this.padding.right;
      const maxCyl = Math.max(1, this.diskSize - 1);
      const ratio = Math.max(0, Math.min(1, cylinder / maxCyl));
      return this.padding.left + ratio * plotWidth;
    }

    getStepY(stepIndex, totalSteps) {
      const plotHeight = this.height - this.padding.top - this.padding.bottom;
      const safeSteps = Math.max(1, totalSteps - 1);
      return this.padding.top + (stepIndex / safeSteps) * plotHeight;
    }

    checkHover() {
      let found = null;
      for (const el of this.interactiveElements) {
        const dx = this.mousePos.x - el.x;
        const dy = this.mousePos.y - el.y;
        if (Math.sqrt(dx * dx + dy * dy) <= Math.max(8, el.radius)) {
          found = el;
          break;
        }
      }

      if (found !== this.hoveredStep) {
        this.hoveredStep = found;
        this.canvas.style.cursor = found ? 'pointer' : 'default';
        if (this.options.onHover) {
          this.options.onHover(found ? { ...found.step, algoName: found.algoName, x: found.x, y: found.y } : null);
        }
        this.render();
      }
    }

    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);
      this.interactiveElements = [];

      // Background subtle gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, this.height);
      bgGrad.addColorStop(0, '#0b0f19');
      bgGrad.addColorStop(1, '#070a12');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, this.width, this.height);

      if (!this.result && (!this.allResults || this.allResults.length === 0)) {
        this.renderEmptyState();
        return;
      }

      // Draw Grid, Axes & Request Markers
      this.renderGridAndAxes();

      if (this.isCompareAll && this.allResults) {
        this.renderCompareAll();
      } else if (this.result) {
        this.renderSingleAlgorithm(this.result);
      }

      // Render tooltip if hovering
      if (this.hoveredStep) {
        this.renderTooltip(this.hoveredStep);
      }
    }

    renderEmptyState() {
      const ctx = this.ctx;
      ctx.fillStyle = '#64748b';
      ctx.font = '14px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Enter request queue and configure parameters to visualize seek path', this.width / 2, this.height / 2);
    }

    renderGridAndAxes() {
      const ctx = this.ctx;
      const maxCyl = this.diskSize - 1;
      const plotWidth = this.width - this.padding.left - this.padding.right;
      const plotHeight = this.height - this.padding.top - this.padding.bottom;

      // Horizontal boundary guides
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.padding.left, this.padding.top);
      ctx.lineTo(this.width - this.padding.right, this.padding.top);
      ctx.moveTo(this.padding.left, this.height - this.padding.bottom);
      ctx.lineTo(this.width - this.padding.right, this.height - this.padding.bottom);
      ctx.stroke();

      // Top X-Axis line (Cylinders)
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(this.padding.left, this.padding.top);
      ctx.lineTo(this.width - this.padding.right, this.padding.top);
      ctx.stroke();

      // X-Axis Title
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`CYLINDER NUMBERS (0 → ${maxCyl})`, this.padding.left, this.padding.top - 28);

      // Y-Axis Title (Time Steps Downward)
      ctx.save();
      ctx.translate(22, this.padding.top + plotHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#64748b';
      ctx.font = '500 11px Inter, system-ui, sans-serif';
      ctx.fillText('TIME STEP SEQUENCE (t0 → tn) ↓', 0, 0);
      ctx.restore();

      // Major cylinder interval ticks
      const interval = maxCyl <= 50 ? 5 : maxCyl <= 100 ? 10 : maxCyl <= 250 ? 25 : maxCyl <= 500 ? 50 : 100;
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';

      for (let c = 0; c <= maxCyl; c += interval) {
        const x = this.getCylinderX(c);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(x, this.padding.top);
        ctx.lineTo(x, this.height - this.padding.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        // Tick line
        ctx.strokeStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(x, this.padding.top - 5);
        ctx.lineTo(x, this.padding.top);
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.fillText(c.toString(), x, this.padding.top - 10);
      }

      // Always draw tick for max cylinder if not on interval
      if (maxCyl % interval !== 0) {
        const x = this.getCylinderX(maxCyl);
        ctx.strokeStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(x, this.padding.top - 5);
        ctx.lineTo(x, this.padding.top);
        ctx.stroke();
        ctx.fillStyle = '#64748b';
        ctx.fillText(maxCyl.toString(), x, this.padding.top - 10);
      }

      // Draw faint vertical guides for requested cylinders
      const uniqueRequests = [...new Set(this.requests)];
      uniqueRequests.forEach(req => {
        const rx = this.getCylinderX(req);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(rx, this.padding.top);
        ctx.lineTo(rx, this.height - this.padding.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        // Small indicator pill on axis
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(rx, this.padding.top, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Initial Head Highlight on Axis
      const headX = this.getCylinderX(this.initialHead);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(headX, this.padding.top, 4, 0, Math.PI * 2);
      ctx.fill();

      // Small badge for head
      ctx.font = 'bold 9px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#f59e0b';
      ctx.textAlign = 'center';
      ctx.fillText(`H:${this.initialHead}`, headX, this.padding.top - 18);
    }

    renderSingleAlgorithm(algoResult) {
      const ctx = this.ctx;
      const steps = algoResult.steps;
      if (!steps || steps.length === 0) return;

      const colors = ALGO_COLORS[algoResult.name] || ALGO_COLORS['FCFS'];
      const totalSteps = steps.length;
      const currentLimit = Math.min(steps.length - 1, Math.floor(this.playbackProgress));
      const fraction = this.playbackProgress - currentLimit;

      // 1. Draw Inactive / Remaining Path (Ghost faint line)
      if (currentLimit < totalSteps - 1) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        for (let i = 0; i < totalSteps; i++) {
          const x = this.getCylinderX(steps[i].cylinder);
          const y = this.getStepY(i, totalSteps);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // 2. Draw Traversed Line Segments up to current playback progress
      for (let i = 1; i <= currentLimit; i++) {
        const prevStep = steps[i - 1];
        const currStep = steps[i];
        const x1 = this.getCylinderX(prevStep.cylinder);
        const y1 = this.getStepY(i - 1, totalSteps);
        const x2 = this.getCylinderX(currStep.cylinder);
        const y2 = this.getStepY(i, totalSteps);

        this.drawSeekSegment(x1, y1, x2, y2, currStep, colors, 1.0);
      }

      // 3. Draw Interpolated Segment for smooth active animation
      if (currentLimit < totalSteps - 1 && fraction > 0) {
        const prevStep = steps[currentLimit];
        const nextStep = steps[currentLimit + 1];
        const x1 = this.getCylinderX(prevStep.cylinder);
        const y1 = this.getStepY(currentLimit, totalSteps);
        const xTarget = this.getCylinderX(nextStep.cylinder);
        const yTarget = this.getStepY(currentLimit + 1, totalSteps);

        const xInterp = x1 + (xTarget - x1) * fraction;
        const yInterp = y1 + (yTarget - y1) * fraction;

        this.drawSeekSegment(x1, y1, xInterp, yInterp, nextStep, colors, 0.8, true);
      }

      // 4. Draw Step Nodes (Points)
      for (let i = 0; i < totalSteps; i++) {
        const step = steps[i];
        const x = this.getCylinderX(step.cylinder);
        const y = this.getStepY(i, totalSteps);
        const isReached = i <= currentLimit;
        const isNextTarget = i === currentLimit + 1;
        const isCurrentActive = i === currentLimit;

        this.drawStepNode(x, y, step, i, colors, isReached, isCurrentActive, isNextTarget);

        // Store for interactive hover & click
        this.interactiveElements.push({
          x,
          y,
          radius: 12,
          step,
          algoName: algoResult.name
        });

        // Y-axis step label
        ctx.fillStyle = isCurrentActive ? '#ffffff' : isReached ? '#94a3b8' : '#475569';
        ctx.font = isCurrentActive ? 'bold 11px "JetBrains Mono", monospace' : '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`t${i}`, this.padding.left - 12, y + 3.5);
      }

      // 5. Draw Animated Head Cursor Marker
      this.drawHeadCursor(steps, currentLimit, fraction, totalSteps, colors);
    }

    drawSeekSegment(x1, y1, x2, y2, step, colors, alpha = 1.0, isPartial = false) {
      const ctx = this.ctx;
      const isReturnJump = step.type === 'return_jump';

      ctx.save();
      ctx.globalAlpha = alpha;

      if (isReturnJump) {
        // Neon dashed line for circular jump
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 5]);
        ctx.shadowColor = 'rgba(244, 63, 94, 0.6)';
        ctx.shadowBlur = 8;
      } else {
        // Solid glowing seek line
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = 6;
      }

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();

      // Only draw distance badges and arrowheads on full segments
      if (!isPartial && Math.abs(x2 - x1) > 2) {
        this.drawSegmentAnnotations(x1, y1, x2, y2, step, isReturnJump);
      }
    }

    drawSegmentAnnotations(x1, y1, x2, y2, step, isReturnJump) {
      const ctx = this.ctx;
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;

      // Directional arrow head
      const angle = Math.atan2(y2 - y1, x2 - x1);
      ctx.save();
      ctx.fillStyle = isReturnJump ? '#f43f5e' : '#38bdf8';
      ctx.translate(midX, midY);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-8, -4);
      ctx.lineTo(-8, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Seek Distance Badge (Δ = distance)
      const badgeText = isReturnJump ? `Jump: Δ${step.distance}` : `Δ${step.distance}`;
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      const textWidth = ctx.measureText(badgeText).width;
      const badgeW = textWidth + 10;
      const badgeH = 16;
      const badgeY = midY - 14;

      // Background pill
      ctx.fillStyle = isReturnJump ? 'rgba(244, 63, 94, 0.9)' : 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = isReturnJump ? '#f43f5e' : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(midX - badgeW / 2, badgeY, badgeW, badgeH, 4);
      } else {
        ctx.rect(midX - badgeW / 2, badgeY, badgeW, badgeH);
      }
      ctx.fill();
      ctx.stroke();

      // Text
      ctx.fillStyle = isReturnJump ? '#ffffff' : '#38bdf8';
      ctx.textAlign = 'center';
      ctx.fillText(badgeText, midX, badgeY + 11.5);
    }

    drawStepNode(x, y, step, index, colors, isReached, isCurrentActive, isNextTarget) {
      const ctx = this.ctx;
      ctx.save();

      let radius = 6;
      let strokeColor = colors.stroke;
      let fillColor = colors.fill;

      if (step.type === 'initial') {
        // Step 0 - Initial Head
        radius = 7;
        strokeColor = '#f59e0b';
        fillColor = '#b45309';
      } else if (step.type === 'boundary') {
        // Boundary turnaround
        radius = 7;
        strokeColor = '#a855f7';
        fillColor = '#1e1b4b'; // hollow
      } else if (step.type === 'return_jump') {
        // Return jump destination
        radius = 6.5;
        strokeColor = '#f43f5e';
        fillColor = '#4c0519';
      }

      if (!isReached) {
        // Future unvisited node
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = '#64748b';
        ctx.fillStyle = '#1e293b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Visited or Active Node
        if (step.type === 'boundary') {
          // Diamond shape for boundary
          ctx.strokeStyle = strokeColor;
          ctx.fillStyle = fillColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, y - radius);
          ctx.lineTo(x + radius, y);
          ctx.lineTo(x, y + radius);
          ctx.lineTo(x - radius, y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          // Circle node
          ctx.strokeStyle = strokeColor;
          ctx.fillStyle = step.type === 'return_jump' ? '#18181b' : fillColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Small inner core
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Cylinder number label next to node
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = isCurrentActive ? '#ffffff' : '#cbd5e1';
        ctx.textAlign = x > this.width - 90 ? 'right' : 'left';
        const textOffset = x > this.width - 90 ? -12 : 12;
        ctx.fillText(`${step.cylinder}`, x + textOffset, y + 3.5);
      }

      ctx.restore();
    }

    drawHeadCursor(steps, currentLimit, fraction, totalSteps, colors) {
      const ctx = this.ctx;
      let curX, curY;

      if (currentLimit >= totalSteps - 1) {
        const lastStep = steps[steps.length - 1];
        curX = this.getCylinderX(lastStep.cylinder);
        curY = this.getStepY(steps.length - 1, totalSteps);
      } else {
        const s1 = steps[currentLimit];
        const s2 = steps[currentLimit + 1];
        const x1 = this.getCylinderX(s1.cylinder);
        const y1 = this.getStepY(currentLimit, totalSteps);
        const x2 = this.getCylinderX(s2.cylinder);
        const y2 = this.getStepY(currentLimit + 1, totalSteps);

        curX = x1 + (x2 - x1) * fraction;
        curY = y1 + (y2 - y1) * fraction;
      }

      ctx.save();

      // Outer pulse ring
      const time = Date.now() / 300;
      const pulseSize = 10 + Math.sin(time) * 4;

      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.5 + Math.sin(time) * 0.3;
      ctx.beginPath();
      ctx.arc(curX, curY, pulseSize, 0, Math.PI * 2);
      ctx.stroke();

      // Glowing cursor center
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = colors.stroke;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(curX, curY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Label head
      ctx.shadowBlur = 0;
      ctx.font = 'bold 9px Inter, system-ui, sans-serif';
      ctx.fillStyle = colors.stroke;
      ctx.textAlign = 'center';
      ctx.fillText('HEAD', curX, curY - pulseSize - 3);

      ctx.restore();
    }

    renderCompareAll() {
      const ctx = this.ctx;
      if (!this.allResults || this.allResults.length === 0) return;

      // Find max steps among all algorithms to align Y-axis
      let maxStepsCount = 0;
      this.allResults.forEach(res => {
        if (res.steps.length > maxStepsCount) maxStepsCount = res.steps.length;
      });

      // Draw all algorithm paths
      this.allResults.forEach(algo => {
        const colors = ALGO_COLORS[algo.name] || ALGO_COLORS['FCFS'];
        const isHovered = this.hoveredAlgo === algo.name;
        const isDimmed = this.hoveredAlgo && !isHovered;
        const steps = algo.steps;
        const totalSteps = steps.length;

        ctx.save();
        ctx.globalAlpha = isHovered ? 1.0 : isDimmed ? 0.2 : 0.75;
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = isHovered ? 3.5 : 2;
        if (isHovered) {
          ctx.shadowColor = colors.glow;
          ctx.shadowBlur = 10;
        }

        ctx.beginPath();
        for (let i = 0; i < totalSteps; i++) {
          const x = this.getCylinderX(steps[i].cylinder);
          const y = this.getStepY(i, maxStepsCount);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);

          // Add interactive node
          this.interactiveElements.push({
            x,
            y,
            radius: 8,
            step: steps[i],
            algoName: algo.name
          });
        }
        ctx.stroke();

        // Small dots on each step
        ctx.fillStyle = colors.stroke;
        for (let i = 0; i < totalSteps; i++) {
          const x = this.getCylinderX(steps[i].cylinder);
          const y = this.getStepY(i, maxStepsCount);
          ctx.beginPath();
          ctx.arc(x, y, isHovered ? 4 : 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      // Overlay interactive Legend in top-right corner
      this.renderCompareLegend();
    }

    renderCompareLegend() {
      const ctx = this.ctx;
      const legendX = this.width - this.padding.right - 260;
      const legendY = this.padding.top + 10;
      const lineH = 19;
      const legendW = 250;
      const legendH = this.allResults.length * lineH + 18;

      ctx.save();
      // Glass background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(legendX, legendY, legendW, legendH, 8);
      } else {
        ctx.rect(legendX, legendY, legendW, legendH);
      }
      ctx.fill();
      ctx.stroke();

      // Legend Title
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('ALGORITHM COMPARISON OVERLAY', legendX + 12, legendY + 14);

      this.allResults.forEach((algo, idx) => {
        const itemY = legendY + 32 + idx * lineH;
        const colors = ALGO_COLORS[algo.name] || ALGO_COLORS['FCFS'];
        const isHovered = this.hoveredAlgo === algo.name;

        // Color indicator pill
        ctx.fillStyle = colors.stroke;
        ctx.beginPath();
        ctx.arc(legendX + 18, itemY - 3.5, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Algorithm Name
        ctx.font = isHovered ? 'bold 11px Inter, system-ui, sans-serif' : '11px Inter, system-ui, sans-serif';
        ctx.fillStyle = isHovered ? '#ffffff' : '#cbd5e1';
        ctx.fillText(algo.name, legendX + 30, itemY);

        // Movement & Rank
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'right';
        ctx.fillText(`${algo.totalHeadMovement} cyl (#${algo.rank})`, legendX + legendW - 12, itemY);
        ctx.textAlign = 'left';
      });

      ctx.restore();
    }

    renderTooltip(target) {
      const ctx = this.ctx;
      const step = target.step;
      const algoName = target.algoName;
      const colors = ALGO_COLORS[algoName] || ALGO_COLORS['FCFS'];

      const lines = [
        `${algoName} • Step #${step.stepIndex}`,
        `Cylinder: ${step.cylinder} (${step.type.toUpperCase()})`,
        step.fromCylinder !== null ? `Seek: ${step.fromCylinder} → ${step.cylinder} (Δ${step.distance} cyl)` : `Initial Start Head`,
        `Cumulative Seek: ${step.cumulativeDistance} cylinders`,
        `Action: ${step.isServiced ? 'Serviced Request ✓' : step.type === 'boundary' ? 'Boundary Turnaround ↺' : 'Return Jump ↷'}`
      ];

      ctx.save();
      ctx.font = '11px Inter, system-ui, sans-serif';
      let maxW = 0;
      lines.forEach(l => {
        const w = ctx.measureText(l).width;
        if (w > maxW) maxW = w;
      });

      const padX = 12;
      const padY = 10;
      const tipW = maxW + padX * 2;
      const tipH = lines.length * 17 + padY * 2;

      let tipX = target.x + 14;
      let tipY = target.y - tipH / 2;

      // Keep within bounds
      if (tipX + tipW > this.width - 10) tipX = target.x - tipW - 14;
      if (tipY < 10) tipY = 10;
      if (tipY + tipH > this.height - 10) tipY = this.height - tipH - 10;

      // Tooltip background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(tipX, tipY, tipW, tipH, 6);
      } else {
        ctx.rect(tipX, tipY, tipW, tipH);
      }
      ctx.fill();
      ctx.stroke();

      // Tooltip text
      ctx.shadowBlur = 0;
      lines.forEach((line, idx) => {
        if (idx === 0) {
          ctx.font = 'bold 12px Inter, system-ui, sans-serif';
          ctx.fillStyle = colors.stroke;
        } else if (idx === 2) {
          ctx.font = '11px "JetBrains Mono", monospace';
          ctx.fillStyle = '#38bdf8';
        } else {
          ctx.font = '11px Inter, system-ui, sans-serif';
          ctx.fillStyle = '#cbd5e1';
        }
        ctx.fillText(line, tipX + padX, tipY + padY + 13 + idx * 17);
      });

      ctx.restore();
    }
  }

  return {
    Visualizer,
    ALGO_COLORS
  };
})();
