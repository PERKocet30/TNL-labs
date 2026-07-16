class TNLSequencerEngine {
  constructor(audioContext = new (window.AudioContext || window.webkitAudioContext)()) {
    this.ctx = audioContext;
    this.tempo = 140;
    this.swing = 0; // Range: 0.0 to 1.0
    this.humanize = 0; // Range: 0.0 to 1.0 (random micro-timing deviation)
    
    this.channels = {}; 
    this.isPlaying = false;
    this.currentStep = 0;
    this.totalSteps = 16;
    
    this.nextNoteTime = 0.0;
    this.lookahead = 25.0; // milliseconds
    this.scheduleAheadTime = 0.1; // seconds
    this.timerID = null;

    // Track active sound sources to enforce Choke Groups
    this.activeSources = {};
  }

  /**
   * Adds a new instrument channel to the studio sequencer
   */
  addChannel(id, buffer, options = {}) {
    this.channels[id] = {
      buffer: buffer,
      chokeGroup: options.chokeGroup || null, // e.g., 'hats'
      volume: options.volume || 1.0,
      steps: Array.from({ length: this.totalSteps }, () => ({
        active: false,
        velocity: 1.0, // Individual step volume (0.0 to 1.0)
        pitch: 1.0     // Individual step pitch playback rate ratio (0.5 to 2.0)
      }))
    };
    this.activeSources[id] = [];
  }

  /**
   * Triggers an individual step's sample playback with timing and velocity offsets
   */
  playStep(channelId, stepIndex, time) {
    const channel = this.channels[channelId];
    const step = channel.steps[stepIndex];

    if (!step.active) return;

    // 1. CHOKE GROUP LOGIC (e.g., Closed Hat cuts off Open Hat)
    if (channel.chokeGroup) {
      Object.keys(this.channels).forEach(otherId => {
        if (this.channels[otherId].chokeGroup === channel.chokeGroup) {
          this.activeSources[otherId].forEach(source => {
            try {
              source.stop(time);
            } catch (e) {
              // Node has already ended naturally
            }
          });
          this.activeSources[otherId] = [];
        }
      });
    }

    // 2. HUMANIZATION / MICRO-TIMING ENGINE
    let playTime = time;
    if (this.humanize > 0) {
      const maxTimingDeviation = 0.012; // Maximum 12ms deviation
      const randomOffset = (Math.random() * 2 - 1) * maxTimingDeviation * this.humanize;
      playTime += randomOffset;
    }

    // Construct and configure nodes
    const source = this.ctx.createBufferSource();
    source.buffer = channel.buffer;

    const gainNode = this.ctx.createGain();

    // 3. VELOCITY ENGINE
    let finalVelocity = step.velocity * channel.volume;
    if (this.humanize > 0) {
      const maxVolDeviation = 0.08; // Slight velocity randomization
      finalVelocity += (Math.random() * 2 - 1) * maxVolDeviation * this.humanize;
      finalVelocity = Math.max(0.01, Math.min(1.0, finalVelocity));
    }
    gainNode.gain.setValueAtTime(finalVelocity, playTime);

    // 4. PITCH ENGINE
    source.playbackRate.setValueAtTime(step.pitch, playTime);

    source.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    source.start(playTime);
    this.activeSources[channelId].push(source);
  }

  /**
   * High-accuracy lookahead scheduling loop
   */
  scheduler() {
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNextStep();
    }
    this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
  }

  scheduleNextStep() {
    const secondsPerBeat = 60.0 / this.tempo;
    const stepDuration = secondsPerBeat / 4; // 16th notes

    // Apply Global Swing to even-numbered steps
    let currentStepTime = this.nextNoteTime;
    if (this.currentStep % 2 !== 0 && this.swing > 0) {
      const swingOffset = stepDuration * (this.swing * 0.33); 
      currentStepTime += swingOffset;
    }

    // Trigger all active channels for this step
    Object.keys(this.channels).forEach(channelId => {
      this.playStep(channelId, this.currentStep, currentStepTime);
    });

    this.nextNoteTime += stepDuration;
    this.currentStep = (this.currentStep + 1) % this.totalSteps;
  }

  start() {
    if (this.isPlaying) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.isPlaying = true;
    this.currentStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.scheduler();
  }

  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    clearTimeout(this.timerID);
    Object.keys(this.activeSources).forEach(id => {
      this.activeSources[id].forEach(src => { try { src.stop(); } catch(e){} });
      this.activeSources[id] = [];
    });
  }
}

// Export module for browser context
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TNLSequencerEngine;
}
