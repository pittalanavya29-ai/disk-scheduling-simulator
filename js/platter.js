/**
 * Disk Platter & Actuator Arm Visualizer
 * Simulates a realistic mechanical Hard Disk Drive (HDD) with spinning magnetic platter,
 * concentric track cylinders, and pivoting actuator arm with read/write magnetic head slider.
 */

const PlatterVisualizer = (function () {
  'use strict';

  class Platter {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.diskSize = 200;
      this.currentCylinder = 53;
      this.targetCylinder = 53;
      this.interpolatedCylinder = 53;
      this.requests = [];
      this.spinAngle = 0;
      this.isSpinning = true;
      this.activeStep = null;
      this.headFlash = 0; // flash timer when request is serviced

      this.dpr = window.devicePixelRatio || 1;
      this.width = 400;
      this.height = 400;

      this.resize();
      this.startLoop();
    }

    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.width = Math.max(260, rect.width);
      this.height = Math.max(260, Math.min(500, rect.height || 400));

      this.dpr = window.devicePixelRatio || 1;
      this.canvas.width = this.width * this.dpr;
      this.canvas.height = this.height * this.dpr;
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;

      this.ctx.scale(this.dpr, this.dpr);
    }

    setData({ diskSize = 200, requests = [], currentCylinder = 53, activeStep = null }) {
      this.diskSize = Math.max(1, diskSize);
      this.requests = requests;
      this.targetCylinder = currentCylinder;
      this.activeStep = activeStep;
      if (activeStep && activeStep.isServiced) {
        this.headFlash = 1.0;
      }
    }

    setCylinder(cylinder, isServiced = false) {
      this.targetCylinder = cylinder;
      if (isServiced) {
        this.headFlash = 1.0;
      }
    }

    startLoop() {
      const loop = () => {
        this.update();
        this.render();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    update() {
      // Rotate platter continuously
      this.spinAngle = (this.spinAngle + 0.04) % (Math.PI * 2);

      // Smooth actuator arm interpolation
      const diff = this.targetCylinder - this.interpolatedCylinder;
      this.interpolatedCylinder += diff * 0.18;

      // Decay service spark flash
      if (this.headFlash > 0) {
        this.headFlash = Math.max(0, this.headFlash - 0.04);
      }
    }

    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);

      // HDD Base Chassis
      const cx = this.width * 0.44;
      const cy = this.height * 0.5;
      const platterRadius = Math.min(this.width * 0.36, this.height * 0.42);

      // Platter Cast & Drop Shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(cx, cy, platterRadius + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Platter Surface (Brushed Metallic Aluminum Gradient)
      ctx.save();
      const platterGrad = ctx.createRadialGradient(cx, cy, platterRadius * 0.15, cx, cy, platterRadius);
      platterGrad.addColorStop(0, '#1e293b');
      platterGrad.addColorStop(0.3, '#334155');
      platterGrad.addColorStop(0.6, '#1e293b');
      platterGrad.addColorStop(0.85, '#475569');
      platterGrad.addColorStop(1, '#0f172a');

      ctx.fillStyle = platterGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, platterRadius, 0, Math.PI * 2);
      ctx.fill();

      // Rotating anisotropic reflection sheen
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(this.spinAngle);
      const sheenGrad = ctx.createLinearGradient(-platterRadius, -platterRadius, platterRadius, platterRadius);
      sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
      sheenGrad.addColorStop(0.25, 'rgba(255, 255, 255, 0.0)');
      sheenGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.12)');
      sheenGrad.addColorStop(0.75, 'rgba(255, 255, 255, 0.0)');
      sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
      ctx.fillStyle = sheenGrad;
      ctx.beginPath();
      ctx.arc(0, 0, platterRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Concentric Cylinder Track Rings
      const innerTrackR = platterRadius * 0.32;
      const outerTrackR = platterRadius * 0.94;
      const trackSpan = outerTrackR - innerTrackR;
      const maxCyl = Math.max(1, this.diskSize - 1);

      // Subtle track grooves
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const r = innerTrackR + (trackSpan * i) / 7;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw requested cylinder tracks as glowing neon rings
      const uniqueReqs = [...new Set(this.requests)];
      uniqueReqs.forEach(req => {
        // In magnetic disks, cylinder 0 is typically the outer diameter and max is inner
        const trackRatio = 1 - (req / maxCyl);
        const tr = innerTrackR + trackRatio * trackSpan;

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(cx, cy, tr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Active Target Cylinder Ring
      const currentTrackRatio = 1 - (this.interpolatedCylinder / maxCyl);
      const activeTrackR = innerTrackR + currentTrackRatio * trackSpan;

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, activeTrackR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Spindle Center Hub
      const hubRadius = platterRadius * 0.22;
      const hubGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, hubRadius);
      hubGrad.addColorStop(0, '#94a3b8');
      hubGrad.addColorStop(0.7, '#475569');
      hubGrad.addColorStop(1, '#1e293b');

      ctx.fillStyle = hubGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, hubRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Spindle Screws
      for (let i = 0; i < 3; i++) {
        const scrAng = this.spinAngle + (i * Math.PI * 2) / 3;
        const sx = cx + Math.cos(scrAng) * (hubRadius * 0.55);
        const sy = cy + Math.sin(scrAng) * (hubRadius * 0.55);
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Render Actuator Arm Assembly
      this.renderActuatorArm(cx, cy, innerTrackR, outerTrackR, trackSpan, maxCyl);

      // Status HUD overlay
      this.renderHUD(activeTrackR, cx, cy);
    }

    renderActuatorArm(cx, cy, innerTrackR, outerTrackR, trackSpan, maxCyl) {
      const ctx = this.ctx;

      // Actuator pivot base located to the bottom-right of the platter
      const pivotX = this.width * 0.88;
      const pivotY = this.height * 0.76;
      const armLength = Math.min(this.width * 0.52, this.height * 0.55);

      // Calculate target head tip position on active track
      // Head rests on the horizontal/upper section of the platter (e.g. angle ~ -25 deg)
      const headAngleOnPlatter = -Math.PI * 0.18;
      const headTrackRatio = 1 - (this.interpolatedCylinder / maxCyl);
      const headR = innerTrackR + headTrackRatio * trackSpan;

      const headTipX = cx + Math.cos(headAngleOnPlatter) * headR;
      const headTipY = cy + Math.sin(headAngleOnPlatter) * headR;

      // Draw VCM (Voice Coil Motor) base at pivot
      ctx.save();
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Magnet coils behind pivot
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(pivotX + 12, pivotY + 10, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.stroke();

      // Pivot Bearing Center
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 3, 0, Math.PI * 2);
      ctx.fill();

      // Mechanical Arm Body (Tapered triangle from pivot to head tip)
      const armAngle = Math.atan2(headTipY - pivotY, headTipX - pivotX);
      const perpAngle = armAngle + Math.PI / 2;
      const baseW = 10;

      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(pivotX + Math.cos(perpAngle) * baseW, pivotY + Math.sin(perpAngle) * baseW);
      ctx.lineTo(headTipX, headTipY);
      ctx.lineTo(pivotX - Math.cos(perpAngle) * baseW, pivotY - Math.sin(perpAngle) * baseW);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner arm cutout for lightweight aerospace aesthetic
      const midArmX = (pivotX + headTipX) * 0.52;
      const midArmY = (pivotY + headTipY) * 0.52;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(midArmX, midArmY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Magnetic Read/Write Slider (Head tip)
      ctx.save();
      ctx.translate(headTipX, headTipY);
      ctx.rotate(armAngle);

      // Slider head block
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-6, -3, 8, 6);

      // Magnetic coil indicator
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-2, -1.5, 4, 3);
      ctx.restore();

      // Service Flash / Magnetic Spark if active
      if (this.headFlash > 0) {
        ctx.save();
        ctx.globalAlpha = this.headFlash;
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(headTipX, headTipY, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(headTipX, headTipY, 12 * (1 - this.headFlash + 0.2), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    }

    renderHUD(activeTrackR, cx, cy) {
      const ctx = this.ctx;
      const cyl = Math.round(this.interpolatedCylinder);

      ctx.save();
      // Mini HUD card in top left
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;

      const hudX = 14;
      const hudY = 14;
      const hudW = 160;
      const hudH = 54;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(hudX, hudY, hudW, hudH, 6);
      } else {
        ctx.rect(hudX, hudY, hudW, hudH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px Inter, system-ui, sans-serif';
      ctx.fillText('ACTUATOR POSITION', hudX + 10, hudY + 16);

      ctx.font = 'bold 16px "JetBrains Mono", monospace';
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(`Cyl: ${cyl}`, hudX + 10, hudY + 38);

      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText(`/${this.diskSize - 1}`, hudX + 90, hudY + 38);

      ctx.restore();
    }
  }

  return {
    Platter
  };
})();
