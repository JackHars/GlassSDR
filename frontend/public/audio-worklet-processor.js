class RingBufferProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(48000 * 2); // 2 sec ring buffer @ 48 kHz
    this.write = 0;
    this.read = 0;
    this.size = 0;
    this.port.onmessage = (e) => {
      // e.data is a Float32Array of samples
      const incoming = e.data;
      for (let i = 0; i < incoming.length; i++) {
        this.buf[this.write] = incoming[i];
        this.write = (this.write + 1) % this.buf.length;
        if (this.size < this.buf.length) {
          this.size++;
        } else {
          this.read = (this.read + 1) % this.buf.length; // overwrite oldest
        }
      }
    };
  }

  process(_inputs, outputs) {
    const out = outputs[0][0];
    for (let i = 0; i < out.length; i++) {
      if (this.size > 0) {
        out[i] = this.buf[this.read];
        this.read = (this.read + 1) % this.buf.length;
        this.size--;
      } else {
        out[i] = 0;
      }
    }
    return true;
  }
}

registerProcessor("ring-buffer", RingBufferProcessor);
