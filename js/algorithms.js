/**
 * Disk Scheduling Algorithms Implementation
 * Supports: FCFS, SSTF, SCAN, C-SCAN, LOOK, C-LOOK
 * Includes comprehensive step telemetry, boundary detection, and textbook compliance.
 */

const DiskAlgorithms = (function () {
  'use strict';

  /**
   * Helper to build structured step telemetry
   */
  function createStep({
    stepIndex,
    cylinder,
    fromCylinder = null,
    type = 'request', // 'initial', 'request', 'boundary', 'return_jump'
    isServiced = true,
    direction = 'idle',
    reason = '',
    cumulativeDistance = 0,
    requestId = null
  }) {
    const distance = fromCylinder === null ? 0 : Math.abs(cylinder - fromCylinder);
    return {
      stepIndex,
      cylinder,
      fromCylinder,
      distance,
      cumulativeDistance: cumulativeDistance + distance,
      type,
      isServiced,
      direction,
      reason,
      requestId
    };
  }

  /**
   * Helper to normalize request objects
   */
  function prepareRequests(requests) {
    return requests.map((cyl, idx) => ({
      id: `req_${idx}_${cyl}`,
      cylinder: cyl,
      originalIndex: idx,
      serviced: false
    }));
  }

  /**
   * 1. FCFS (First-Come, First-Served)
   * Services cylinders strictly in arrival order.
   */
  function fcfs(requests, initialHead, diskSize = 200) {
    const steps = [];
    let current = initialHead;
    let cumDist = 0;

    // Step 0: Initial head
    const initialStep = createStep({
      stepIndex: 0,
      cylinder: initialHead,
      fromCylinder: null,
      type: 'initial',
      isServiced: false,
      direction: 'idle',
      reason: `Read/Write head starts at initial cylinder ${initialHead}.`,
      cumulativeDistance: 0
    });
    steps.push(initialStep);

    requests.forEach((reqCyl, idx) => {
      const dist = Math.abs(reqCyl - current);
      const dir = reqCyl > current ? 'right' : reqCyl < current ? 'left' : 'idle';
      cumDist += dist;

      steps.push(createStep({
        stepIndex: idx + 1,
        cylinder: reqCyl,
        fromCylinder: current,
        type: 'request',
        isServiced: true,
        direction: dir,
        reason: `FCFS services request #${idx + 1} at cylinder ${reqCyl} (Seek distance: ${dist}).`,
        cumulativeDistance: cumDist - dist,
        requestId: `req_${idx}_${reqCyl}`
      }));

      current = reqCyl;
    });

    return formatResult('FCFS', 'First-Come, First-Served', steps, requests.length);
  }

  /**
   * 2. SSTF (Shortest Seek Time First)
   * Always selects the pending request with the minimum seek distance from current head.
   */
  function sstf(requests, initialHead, diskSize = 200, preferredDirection = 'right') {
    const steps = [];
    const pending = prepareRequests(requests);
    let current = initialHead;
    let cumDist = 0;
    let currentDirection = preferredDirection;

    // Step 0
    steps.push(createStep({
      stepIndex: 0,
      cylinder: initialHead,
      fromCylinder: null,
      type: 'initial',
      isServiced: false,
      direction: currentDirection,
      reason: `Read/Write head positioned at initial cylinder ${initialHead}.`,
      cumulativeDistance: 0
    }));

    let stepCounter = 1;
    while (pending.some(r => !r.serviced)) {
      const unserviced = pending.filter(r => !r.serviced);

      // Find closest with deterministic tie-breaking (prefer preferred/current direction)
      let best = null;
      let minDistance = Infinity;

      for (const req of unserviced) {
        const dist = Math.abs(req.cylinder - current);
        if (dist < minDistance) {
          minDistance = dist;
          best = req;
        } else if (dist === minDistance) {
          // Tie-break: if moving right, prefer higher cylinder; if left, prefer lower cylinder
          if (currentDirection === 'right' && req.cylinder > current) {
            best = req;
          } else if (currentDirection === 'left' && req.cylinder < current) {
            best = req;
          }
        }
      }

      best.serviced = true;
      const dist = Math.abs(best.cylinder - current);
      const dir = best.cylinder > current ? 'right' : best.cylinder < current ? 'left' : currentDirection;
      currentDirection = dir;
      cumDist += dist;

      steps.push(createStep({
        stepIndex: stepCounter++,
        cylinder: best.cylinder,
        fromCylinder: current,
        type: 'request',
        isServiced: true,
        direction: dir,
        reason: `SSTF selects cylinder ${best.cylinder}: minimum seek distance of ${dist} cyl from ${current}.`,
        cumulativeDistance: cumDist - dist,
        requestId: best.id
      }));

      current = best.cylinder;
    }

    return formatResult('SSTF', 'Shortest Seek Time First', steps, requests.length);
  }

  /**
   * 3. SCAN (Elevator Algorithm)
   * Sweeps in initial direction servicing requests until it reaches the disk boundary (0 or diskSize - 1),
   * then reverses direction and sweeps toward the opposite boundary.
   */
  function scan(requests, initialHead, diskSize = 200, direction = 'right') {
    const steps = [];
    const maxCyl = diskSize - 1;
    let current = initialHead;
    let cumDist = 0;
    let currentDir = direction;

    steps.push(createStep({
      stepIndex: 0,
      cylinder: initialHead,
      fromCylinder: null,
      type: 'initial',
      isServiced: false,
      direction: currentDir,
      reason: `Head initialized at cylinder ${initialHead}, moving ${currentDir.toUpperCase()} towards ${currentDir === 'right' ? maxCyl : 0}.`,
      cumulativeDistance: 0
    }));

    let stepCounter = 1;

    // Split requests into left and right
    // Note: If initialHead is in requests, service it first
    let leftReqs = requests.filter(c => c < initialHead).sort((a, b) => b - a); // descending
    let rightReqs = requests.filter(c => c > initialHead).sort((a, b) => a - b); // ascending
    let exactHeadReqs = requests.filter(c => c === initialHead);

    // If head itself is requested, service immediately
    if (exactHeadReqs.length > 0) {
      exactHeadReqs.forEach(c => {
        steps.push(createStep({
          stepIndex: stepCounter++,
          cylinder: c,
          fromCylinder: current,
          type: 'request',
          isServiced: true,
          direction: currentDir,
          reason: `Serviced pending request at initial head cylinder ${c} (Seek distance: 0).`,
          cumulativeDistance: cumDist
        }));
      });
    }

    if (direction === 'right') {
      // 1. Service all to the right (ascending)
      for (const reqCyl of rightReqs) {
        const dist = Math.abs(reqCyl - current);
        cumDist += dist;
        steps.push(createStep({
          stepIndex: stepCounter++,
          cylinder: reqCyl,
          fromCylinder: current,
          type: 'request',
          isServiced: true,
          direction: 'right',
          reason: `Elevator moving RIGHT: serviced request at cylinder ${reqCyl}.`,
          cumulativeDistance: cumDist - dist
        }));
        current = reqCyl;
      }

      // 2. Hit boundary if there are remaining requests on the left
      if (leftReqs.length > 0) {
        if (current !== maxCyl) {
          const dist = Math.abs(maxCyl - current);
          cumDist += dist;
          steps.push(createStep({
            stepIndex: stepCounter++,
            cylinder: maxCyl,
            fromCylinder: current,
            type: 'boundary',
            isServiced: requests.includes(maxCyl),
            direction: 'right',
            reason: `Reached upper disk boundary at cylinder ${maxCyl}. Reversing direction to LEFT.`,
            cumulativeDistance: cumDist - dist
          }));
          current = maxCyl;
        }

        // 3. Reverse and service left (descending)
        currentDir = 'left';
        for (const reqCyl of leftReqs) {
          const dist = Math.abs(reqCyl - current);
          cumDist += dist;
          steps.push(createStep({
            stepIndex: stepCounter++,
            cylinder: reqCyl,
            fromCylinder: current,
            type: 'request',
            isServiced: true,
            direction: 'left',
            reason: `Elevator moving LEFT: serviced request at cylinder ${reqCyl}.`,
            cumulativeDistance: cumDist - dist
          }));
          current = reqCyl;
        }
      }
    } else {
      // Moving Left
      // 1. Service all to the left (descending)
      for (const reqCyl of leftReqs) {
        const dist = Math.abs(reqCyl - current);
        cumDist += dist;
        steps.push(createStep({
          stepIndex: stepCounter++,
          cylinder: reqCyl,
          fromCylinder: current,
          type: 'request',
          isServiced: true,
          direction: 'left',
          reason: `Elevator moving LEFT: serviced request at cylinder ${reqCyl}.`,
          cumulativeDistance: cumDist - dist
        }));
        current = reqCyl;
      }

      // 2. Hit boundary 0 if there are remaining requests on the right
      if (rightReqs.length > 0) {
        if (current !== 0) {
          const dist = Math.abs(0 - current);
          cumDist += dist;
          steps.push(createStep({
            stepIndex: stepCounter++,
            cylinder: 0,
            fromCylinder: current,
            type: 'boundary',
            isServiced: requests.includes(0),
            direction: 'left',
            reason: `Reached lower disk boundary at cylinder 0. Reversing direction to RIGHT.`,
            cumulativeDistance: cumDist - dist
          }));
          current = 0;
        }

        // 3. Reverse and service right (ascending)
        currentDir = 'right';
        for (const reqCyl of rightReqs) {
          const dist = Math.abs(reqCyl - current);
          cumDist += dist;
          steps.push(createStep({
            stepIndex: stepCounter++,
            cylinder: reqCyl,
            fromCylinder: current,
            type: 'request',
            isServiced: true,
            direction: 'right',
            reason: `Elevator moving RIGHT: serviced request at cylinder ${reqCyl}.`,
            cumulativeDistance: cumDist - dist
          }));
          current = reqCyl;
        }
      }
    }

    return formatResult('SCAN', 'Elevator Algorithm (Sweeps to Boundary)', steps, requests.length);
  }

  /**
   * 4. C-SCAN (Circular SCAN)
   * Sweeps in one direction to the boundary, then jumps directly to opposite boundary
   * without servicing requests on the return journey, providing uniform wait time.
   */
  function cscan(requests, initialHead, diskSize = 200, direction = 'right') {
    const steps = [];
    const maxCyl = diskSize - 1;
    let current = initialHead;
    let cumDist = 0;

    steps.push(createStep({
      stepIndex: 0,
      cylinder: initialHead,
      fromCylinder: null,
      type: 'initial',
      isServiced: false,
      direction: direction,
      reason: `C-SCAN starts at cylinder ${initialHead}, moving ${direction.toUpperCase()}.`,
      cumulativeDistance: 0
    }));

    let stepCounter = 1;
    let leftReqs = requests.filter(c => c < initialHead).sort((a, b) => a - b); // ascending
    let rightReqs = requests.filter(c => c > initialHead).sort((a, b) => a - b); // ascending
    let exactHeadReqs = requests.filter(c => c === initialHead);

    exactHeadReqs.forEach(c => {
      steps.push(createStep({
        stepIndex: stepCounter++,
        cylinder: c,
        fromCylinder: current,
        type: 'request',
        isServiced: true,
        direction: direction,
        reason: `Serviced pending request at initial head cylinder ${c}.`,
        cumulativeDistance: cumDist
      }));
    });

    if (direction === 'right') {
      // 1. Service rightward requests
      for (const reqCyl of rightReqs) {
        const dist = Math.abs(reqCyl - current);
        cumDist += dist;
        steps.push(createStep({
          stepIndex: stepCounter++,
          cylinder: reqCyl,
          fromCylinder: current,
          type: 'request',
          isServiced: true,
          direction: 'right',
          reason: `C-SCAN servicing cylinder ${reqCyl} in forward sweep.`,
          cumulativeDistance: cumDist - dist
        }));
        current = reqCyl;
      }

      // 2. If requests exist on the left, proceed to maxCyl, then circular jump to 0
      if (leftReqs.length > 0) {
        if (current !== maxCyl) {
          const dist = Math.abs(maxCyl - current);
          cumDist += dist;
          steps.push(createStep({
            stepIndex: stepCounter++,
            cylinder: maxCyl,
            fromCylinder: current,
            type: 'boundary',
            isServiced: requests.includes(maxCyl),
            direction: 'right',
            reason: `Reached end of disk at cylinder ${maxCyl}. Preparing circular jump to 0.`,
            cumulativeDistance: cumDist - dist
          }));
          current = maxCyl;
        }

        // Return jump from maxCyl to 0
        const jumpDist = Math.abs(0 - current);
        cumDist += jumpDist;
        steps.push(createStep({
          stepIndex: stepCounter++,
          cylinder: 0,
          fromCylinder: current,
          type: 'return_jump',
          isServiced: requests.includes(0),
          direction: 'jump',
          reason: `Circular return jump from ${current} to cylinder 0 (no requests serviced during jump).`,
          cumulativeDistance: cumDist - jumpDist
        }));
        current = 0;

        // 3. Service remaining leftward requests moving rightward from 0
        for (const reqCyl of leftReqs) {
          const dist = Math.abs(reqCyl - current);
          cumDist += dist;
          steps.push(createStep({
            stepIndex: stepCounter++,
            cylinder: reqCyl,
            fromCylinder: current,
            type: 'request',
            isServiced: true,
            direction: 'right',
            reason: `C-SCAN continuing forward sweep: serviced cylinder ${reqCyl}.`,
            cumulativeDistance: cumDist - dist
          }));
          current = reqCyl;
        }
      }
    } else {
      // Moving Left
      leftReqs.sort((a, b) => b - a); // descending
      rightReqs.sort((a, b) => b - a); // descending

      for (const reqCyl of leftReqs) {
        const dist = Math.abs(reqCyl - current);
        cumDist += dist;
        steps.push(createStep({
          stepIndex: stepCounter++,
          cylinder: reqCyl,
          fromCylinder: current,
          type: 'request',
          isServiced: true,
          direction: 'left',
          reason: `C-SCAN servicing cylinder ${reqCyl} in downward sweep.`,
          cumulativeDistance: cumDist - dist
        }));
        current = reqCyl;
      }

      if (rightReqs.length > 0) {
        if (current !== 0) {
          const dist = Math.abs(0 - current);
          cumDist += dist;
          steps.push(createStep({
            stepIndex: stepCounter++,
            cylinder: 0,
            fromCylinder: current,
            type: 'boundary',
            isServiced: requests.includes(0),
            direction: 'left',
            reason: `Reached beginning of disk at cylinder 0. Preparing circular jump to ${maxCyl}.`,
            cumulativeDistance: cumDist - dist
          }));
          current = 0;
        }

        const jumpDist = Math.abs(maxCyl - current);
        cumDist += jumpDist;
        steps.push(createStep({
          stepIndex: stepCounter++,
          cylinder: maxCyl,
          fromCylinder: current,
          type: 'return_jump',
          isServiced: requests.includes(maxCyl),
          direction: 'jump',
          reason: `Circular return jump from 0 to cylinder ${maxCyl} (no requests serviced during jump).`,
          cumulativeDistance: cumDist - jumpDist
        }));
        current = maxCyl;

        for (const reqCyl of rightReqs) {
          const dist = Math.abs(reqCyl - current);
          cumDist += dist;
          steps.push(createStep({
            stepIndex: stepCounter++,
            cylinder: reqCyl,
            fromCylinder: current,
            type: 'request',
            isServiced: true,
            direction: 'left',
            reason: `C-SCAN continuing downward sweep: serviced cylinder ${reqCyl}.`,
            cumulativeDistance: cumDist - dist
          }));
          current = reqCyl;
        }
      }
    }

    return formatResult('C-SCAN', 'Circular SCAN (Jump Back to Boundary)', steps, requests.length);
  }

  /**
   * 5. LOOK
   * Like SCAN, but reverses immediately at the furthest request in current direction
   * without needlessly travelling all the way to 0 or diskSize - 1.
   */
  function look(requests, initialHead, diskSize = 200, direction = 'right') {
    const steps = [];
    let current = initialHead;
    let cumDist = 0;

    steps.push(createStep({
      stepIndex: 0,
      cylinder: initialHead,
      fromCylinder: null,
      type: 'initial',
      isServiced: false,
      direction: direction,
      reason: `LOOK begins at cylinder ${initialHead}, looking ahead in ${direction.toUpperCase()} direction.`,
      cumulativeDistance: 0
    }));

    let stepCounter = 1;
    let leftReqs = requests.filter(c => c < initialHead).sort((a, b) => b - a); // descending
    let rightReqs = requests.filter(c => c > initialHead).sort((a, b) => a - b); // ascending
    let exactHeadReqs = requests.filter(c => c === initialHead);

    exactHeadReqs.forEach(c => {
      steps.push(createStep({
        stepIndex: stepCounter++,
        cylinder: c,
        fromCylinder: current,
        type: 'request',
        isServiced: true,
        direction: direction,
        reason: `Serviced request at initial head cylinder ${c}.`,
        cumulativeDistance: cumDist
      }));
    });

    if (direction === 'right') {
      // Service rightward
      for (const reqCyl of rightReqs) {
        const dist = Math.abs(reqCyl - current);
        cumDist += dist;
        steps.push(createStep({
          stepIndex: stepCounter++,
          cylinder: reqCyl,
          fromCylinder: current,
          type: 'request',
          isServiced: true,
          direction: 'right',
          reason: `LOOK moving RIGHT: serviced request at cylinder ${reqCyl}.`,
          cumulativeDistance: cumDist - dist
        }));
        current = reqCyl;
      }

      // If requests remain to the left, reverse immediately from current without touching boundary!
      if (leftReqs.length > 0) {
        for (const reqCyl of leftReqs) {
          const dist = Math.abs(reqCyl - current);
          cumDist += dist;
          steps.push(createStep({
            stepIndex: stepCounter++,
            cylinder: reqCyl,
            fromCylinder: current,
            type: 'request',
            isServiced: true,
            direction: 'left',
            reason: `LOOK reversed to LEFT from furthest request: serviced cylinder ${reqCyl}.`,
            cumulativeDistance: cumDist - dist
          }));
          current = reqCyl;
        }
      }
    } else {
      // Service leftward
      for (const reqCyl of leftReqs) {
        const dist = Math.abs(reqCyl - current);
        cumDist += dist;
        steps.push(createStep({
          stepIndex: stepCounter++,
          cylinder: reqCyl,
          fromCylinder: current,
          type: 'request',
          isServiced: true,
          direction: 'left',
          reason: `LOOK moving LEFT: serviced request at cylinder ${reqCyl}.`,
          cumulativeDistance: cumDist - dist
        }));
        current = reqCyl;
      }

      if (rightReqs.length > 0) {
        for (const reqCyl of rightReqs) {
          const dist = Math.abs(reqCyl - current);
          cumDist += dist;
          steps.push(createStep({
            stepIndex: stepCounter++,
            cylinder: reqCyl,
            fromCylinder: current,
            type: 'request',
            isServiced: true,
            direction: 'right',
            reason: `LOOK reversed to RIGHT from furthest request: serviced cylinder ${reqCyl}.`,
            cumulativeDistance: cumDist - dist
          }));
          current = reqCyl;
        }
      }
    }

    return formatResult('LOOK', 'LOOK Algorithm (Reverses at Furthest Request)', steps, requests.length);
  }

  /**
   * 6. C-LOOK (Circular LOOK)
   * Sweeps to furthest request in current direction, then jumps directly to furthest request
   * at opposite end without going to boundary or servicing intermediate tracks.
   */
  function clook(requests, initialHead, diskSize = 200, direction = 'right') {
    const steps = [];
    let current = initialHead;
    let cumDist = 0;

    steps.push(createStep({
      stepIndex: 0,
      cylinder: initialHead,
      fromCylinder: null,
      type: 'initial',
      isServiced: false,
      direction: direction,
      reason: `C-LOOK begins at cylinder ${initialHead}, scanning ${direction.toUpperCase()}.`,
      cumulativeDistance: 0
    }));

    let stepCounter = 1;
    let leftReqs = requests.filter(c => c < initialHead).sort((a, b) => a - b); // ascending
    let rightReqs = requests.filter(c => c > initialHead).sort((a, b) => a - b); // ascending
    let exactHeadReqs = requests.filter(c => c === initialHead);

    exactHeadReqs.forEach(c => {
      steps.push(createStep({
        stepIndex: stepCounter++,
        cylinder: c,
        fromCylinder: current,
        type: 'request',
        isServiced: true,
        direction: direction,
        reason: `Serviced request at initial head cylinder ${c}.`,
        cumulativeDistance: cumDist
      }));
    });

    if (direction === 'right') {
      // 1. Service all rightward requests
      for (const reqCyl of rightReqs) {
        const dist = Math.abs(reqCyl - current);
        cumDist += dist;
        steps.push(createStep({
          stepIndex: stepCounter++,
          cylinder: reqCyl,
          fromCylinder: current,
          type: 'request',
          isServiced: true,
          direction: 'right',
          reason: `C-LOOK servicing forward request at cylinder ${reqCyl}.`,
          cumulativeDistance: cumDist - dist
        }));
        current = reqCyl;
      }

      // 2. Direct circular jump to lowest pending request
      if (leftReqs.length > 0) {
        const lowestReq = leftReqs[0];
        const jumpDist = Math.abs(lowestReq - current);
        cumDist += jumpDist;

        steps.push(createStep({
          stepIndex: stepCounter++,
          cylinder: lowestReq,
          fromCylinder: current,
          type: 'return_jump',
          isServiced: true,
          direction: 'jump',
          reason: `C-LOOK circular jump directly from ${current} to lowest request at ${lowestReq}.`,
          cumulativeDistance: cumDist - jumpDist
        }));
        current = lowestReq;

        // 3. Service remaining leftward requests ascending
        for (let i = 1; i < leftReqs.length; i++) {
          const reqCyl = leftReqs[i];
          const dist = Math.abs(reqCyl - current);
          cumDist += dist;
          steps.push(createStep({
            stepIndex: stepCounter++,
            cylinder: reqCyl,
            fromCylinder: current,
            type: 'request',
            isServiced: true,
            direction: 'right',
            reason: `C-LOOK servicing cylinder ${reqCyl} after circular reposition.`,
            cumulativeDistance: cumDist - dist
          }));
          current = reqCyl;
        }
      }
    } else {
      // Moving Left
      leftReqs.sort((a, b) => b - a); // descending
      rightReqs.sort((a, b) => b - a); // descending

      for (const reqCyl of leftReqs) {
        const dist = Math.abs(reqCyl - current);
        cumDist += dist;
        steps.push(createStep({
          stepIndex: stepCounter++,
          cylinder: reqCyl,
          fromCylinder: current,
          type: 'request',
          isServiced: true,
          direction: 'left',
          reason: `C-LOOK servicing downward request at cylinder ${reqCyl}.`,
          cumulativeDistance: cumDist - dist
        }));
        current = reqCyl;
      }

      if (rightReqs.length > 0) {
        const highestReq = rightReqs[0];
        const jumpDist = Math.abs(highestReq - current);
        cumDist += jumpDist;

        steps.push(createStep({
          stepIndex: stepCounter++,
          cylinder: highestReq,
          fromCylinder: current,
          type: 'return_jump',
          isServiced: true,
          direction: 'jump',
          reason: `C-LOOK circular jump directly from ${current} to highest request at ${highestReq}.`,
          cumulativeDistance: cumDist - jumpDist
        }));
        current = highestReq;

        for (let i = 1; i < rightReqs.length; i++) {
          const reqCyl = rightReqs[i];
          const dist = Math.abs(reqCyl - current);
          cumDist += dist;
          steps.push(createStep({
            stepIndex: stepCounter++,
            cylinder: reqCyl,
            fromCylinder: current,
            type: 'request',
            isServiced: true,
            direction: 'left',
            reason: `C-LOOK servicing cylinder ${reqCyl} after circular reposition.`,
            cumulativeDistance: cumDist - dist
          }));
          current = reqCyl;
        }
      }
    }

    return formatResult('C-LOOK', 'Circular LOOK (Direct Jump to Opposite Furthest Request)', steps, requests.length);
  }

  /**
   * Helper to format final result object with metrics
   */
  function formatResult(name, fullName, steps, requestCount) {
    const totalHeadMovement = steps.length > 0 ? steps[steps.length - 1].cumulativeDistance : 0;
    
    // Calculate movement excluding return jumps
    let servicingMovement = 0;
    let returnJumpDistance = 0;
    let returnJumpCount = 0;

    for (let i = 1; i < steps.length; i++) {
      if (steps[i].type === 'return_jump') {
        returnJumpDistance += steps[i].distance;
        returnJumpCount++;
      } else {
        servicingMovement += steps[i].distance;
      }
    }

    const validRequestCount = requestCount || 1;
    const averageSeekTime = (totalHeadMovement / validRequestCount).toFixed(2);
    const averageSeekServicingOnly = (servicingMovement / validRequestCount).toFixed(2);

    return {
      name,
      fullName,
      steps,
      totalHeadMovement,
      servicingMovement,
      returnJumpDistance,
      returnJumpCount,
      averageSeekTime: parseFloat(averageSeekTime),
      averageSeekServicingOnly: parseFloat(averageSeekServicingOnly),
      requestCount,
      sequence: steps.map(s => s.cylinder)
    };
  }

  /**
   * Compute all 6 algorithms for comparison
   */
  function compareAll(requests, initialHead, diskSize, direction) {
    const results = [
      fcfs(requests, initialHead, diskSize),
      sstf(requests, initialHead, diskSize, direction),
      scan(requests, initialHead, diskSize, direction),
      cscan(requests, initialHead, diskSize, direction),
      look(requests, initialHead, diskSize, direction),
      clook(requests, initialHead, diskSize, direction)
    ];

    // Sort by total head movement ascending (lowest seek is best)
    results.sort((a, b) => a.totalHeadMovement - b.totalHeadMovement);

    const minMovement = results[0].totalHeadMovement;
    results.forEach((r, idx) => {
      r.rank = idx + 1;
      r.diffPercent = minMovement > 0 ? (((r.totalHeadMovement - minMovement) / minMovement) * 100).toFixed(1) : 0;
    });

    return results;
  }

  return {
    fcfs,
    sstf,
    scan,
    cscan,
    look,
    clook,
    compareAll
  };
})();

// Export for Node/CommonJS test runners if present, else global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DiskAlgorithms;
}
