// The compositor omits headless WebGPU canvas pixels. Copy the swap-chain
// texture before presentation, as mark_pixel_check.ts does. Capture is OFF
// during upload measurements, so these diagnostic allocations do not pollute
// the instrumentation window.
export const SCALE_CAPTURE = `(() => {
  let enabled = false, shot = null, latest = null;
  const devices = new WeakMap();
  const request = GPUAdapter.prototype.requestDevice;
  GPUAdapter.prototype.requestDevice = function (...args) {
    return request.apply(this, args).then(device => {
      devices.set(device.queue, device); return device;
    });
  };
  const configure = GPUCanvasContext.prototype.configure;
  GPUCanvasContext.prototype.configure = function (config) {
    this.__scaleFormat = config.format;
    return configure.call(this, { ...config, usage: (config.usage || GPUTextureUsage.RENDER_ATTACHMENT) | GPUTextureUsage.COPY_SRC });
  };
  const texture = GPUCanvasContext.prototype.getCurrentTexture;
  GPUCanvasContext.prototype.getCurrentTexture = function () {
    const value = texture.call(this);
    latest = { texture: value, format: this.__scaleFormat };
    return value;
  };
  const submit = GPUQueue.prototype.submit;
  GPUQueue.prototype.submit = function (buffers) {
    const result = submit.call(this, buffers);
    const device = devices.get(this);
    if (enabled && latest && device) {
      const { texture, format } = latest;
      const width = texture.width, height = texture.height;
      const bytesPerRow = Math.ceil(width * 4 / 256) * 256;
      const buffer = device.createBuffer({ size: bytesPerRow * height, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
      const encoder = device.createCommandEncoder();
      encoder.copyTextureToBuffer({ texture }, { buffer, bytesPerRow }, { width, height });
      submit.call(this, [encoder.finish()]);
      if (shot) shot.buffer.destroy();
      shot = { buffer, bytesPerRow, width, height, format };
      latest = null;
    }
    return result;
  };
  globalThis.__beginScaleCapture = () => { enabled = true; latest = null; };
  globalThis.__readScaleCapture = async () => {
    enabled = false;
    if (!shot) throw new Error('No GPU frame captured');
    const { buffer, bytesPerRow, width, height, format } = shot;
    await buffer.mapAsync(GPUMapMode.READ);
    const bytes = new Uint8Array(buffer.getMappedRange().slice(0));
    buffer.unmap();
    const rgba = new Uint8ClampedArray(width * height * 4);
    const bgra = format.startsWith('bgra');
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * bytesPerRow + x * 4, o = (y * width + x) * 4;
      rgba[o] = bytes[i + (bgra ? 2 : 0)]; rgba[o + 1] = bytes[i + 1];
      rgba[o + 2] = bytes[i + (bgra ? 0 : 2)]; rgba[o + 3] = 255;
    }
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    canvas.getContext('2d').putImageData(new ImageData(rgba, width, height), 0, 0);
    return canvas.toDataURL('image/png');
  };
})();`;
