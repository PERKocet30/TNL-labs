// tnl-social/public/export-engine.js

class TNLExportEngine {
  constructor(sequencerEngine) {
    this.engine = sequencerEngine;
  }

  /**
   * Renders a single channel track to a PCM WAV Blob offline
   */
  async renderChannelToWav(channelId) {
    const channel = this.engine.channels[channelId];
    const sampleRate = 44100;
    const secondsPerBeat = 60.0 / this.engine.tempo;
    const stepDuration = secondsPerBeat / 4;
    const totalDuration = stepDuration * this.engine.totalSteps;

    const offlineCtx = new OfflineAudioContext(2, sampleRate * totalDuration, sampleRate);

    // Build track events sequentially onto the offline context timeline
    for (let i = 0; i < this.engine.totalSteps; i++) {
      const step = channel.steps[i];
      if (step.active) {
        let playTime = i * stepDuration;
        
        if (i % 2 !== 0 && this.engine.swing > 0) {
          playTime += stepDuration * (this.engine.swing * 0.33);
        }

        const source = offlineCtx.createBufferSource();
        source.buffer = channel.buffer;

        const gainNode = offlineCtx.createGain();
        gainNode.gain.setValueAtTime(step.velocity * channel.volume, playTime);
        source.playbackRate.setValueAtTime(step.pitch, playTime);

        source.connect(gainNode);
        gainNode.connect(offlineCtx.destination);
        source.start(playTime);
      }
    }

    const renderedBuffer = await offlineCtx.startRendering();
    return this.bufferToWavBlob(renderedBuffer);
  }

  /**
   * Converts the OfflineAudioContext buffer array to a structural WAV blob
   */
  bufferToWavBlob(audioBuffer) {
    const numOfChan = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let i, sample, offset = 0, pos = 0;

    const setUint32 = (data) => { view.setUint32(pos, data, true); pos += 4; };
    const setUint16 = (data) => { view.setUint16(pos, data, true); pos += 2; };

    // Standard WAV Header Structure
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); 
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16);         
    setUint16(1);          // Linear PCM format code
    setUint16(numOfChan);
    setUint32(audioBuffer.sampleRate);
    setUint32(audioBuffer.sampleRate * 2 * numOfChan); 
    setUint16(numOfChan * 2); 
    setUint16(16);         // Bit Depth
    setUint32(0x61746164); // "data" chunk
    setUint32(length - pos - 4); 

    for (i = 0; i < audioBuffer.numberOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i));
    }

    while (pos < length) {
      for (i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF; // 16-bit PCM scale
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  /**
   * Executes downloading of all stems as separate track files
   */
  async downloadAllStems() {
    for (const channelId of Object.keys(this.engine.channels)) {
      const blob = await this.renderChannelToWav(channelId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TNL_STUDIO_${channelId}_stem.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }
}

// Export module for browser context
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TNLExportEngine;
}
