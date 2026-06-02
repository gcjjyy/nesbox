(function () {
  const BUTTON_BITS = {
    a: 1 << 0,
    b: 1 << 1,
    select: 1 << 2,
    start: 1 << 3,
    up: 1 << 4,
    down: 1 << 5,
    left: 1 << 6,
    right: 1 << 7,
  };

  let fceuxScriptPromise = null;

  function loadFceuxScript() {
    if (window.FCEUX) return Promise.resolve(window.FCEUX);
    if (!fceuxScriptPromise) {
      fceuxScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "/cores/vendor/fceux.js";
        script.async = true;
        script.onload = () => {
          if (window.FCEUX) resolve(window.FCEUX);
          else reject(new Error("FCEUX factory was not registered"));
        };
        script.onerror = () => reject(new Error("failed to load /cores/vendor/fceux.js"));
        document.head.appendChild(script);
      });
    }
    return fceuxScriptPromise;
  }

  function encodeSaveFiles(files) {
    const payload = {};
    for (const [name, bytes] of Object.entries(files || {})) {
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      payload[name] = btoa(binary);
    }
    return new TextEncoder().encode(JSON.stringify({ type: "fceux-save-files", files: payload }));
  }

  function decodeSaveFiles(bytes) {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    const out = {};
    for (const [name, base64] of Object.entries(parsed.files || {})) {
      const binary = atob(String(base64));
      const data = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
      out[name] = data;
    }
    return out;
  }

  window.createNesboxFceuxCore = async function createNesboxFceuxCore(options) {
    const FCEUX = await loadFceuxScript();
    const module = await FCEUX({
      canvas: options.canvas,
      locateFile(path) {
        if (path.endsWith(".wasm")) return options.wasmUrl || "/cores/vendor/fceux.wasm";
        return `/cores/vendor/${path}`;
      },
      print(text) {
        options.onLog && options.onLog(String(text));
      },
      printErr(text) {
        options.onLog && options.onLog(String(text));
      },
    });

    if (!options.canvas.id) {
      options.canvas.id = "nesbox-fceux-canvas-" + Math.random().toString(36).slice(2);
    }
    if (!module.init("#" + CSS.escape(options.canvas.id))) {
      throw new Error("FCEUX init failed");
    }
    module.setMuted(false);
    module.setPaused(true);

    let raf = 0;
    let running = false;
    let controllerBits = 0;

    function delayFrame() {
      return new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }

    async function resumeAudio() {
      try {
        if (module._audioContext && module._audioContext.state !== "closed") {
          await module._audioContext.resume();
        }
      } catch (_err) {
        // Browsers can reject resume() outside a user gesture.
      }
    }

    function primeVideoFrame(count = 2) {
      const wasPaused = !running;
      module.setPaused(false);
      for (let i = 0; i < count; i += 1) {
        module.setControllerBits(controllerBits);
        module.update();
      }
      if (wasPaused) module.setPaused(true);
    }

    function frame() {
      if (!running) return;
      module.setControllerBits(controllerBits);
      module.update();
      raf = requestAnimationFrame(frame);
    }

    function startLoop() {
      if (running) return;
      running = true;
      resumeAudio();
      module.setPaused(false);
      raf = requestAnimationFrame(frame);
    }

    function stopLoop() {
      running = false;
      module.setPaused(true);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    return {
      metadata: {
        system: "nes",
        name: "FCEUX",
        source: "https://github.com/TASEmulators/fceux",
        license: "GPL-2.0",
        version: "2.2.0",
      },
      async loadRom(rom, name) {
        module.loadGame(rom, name);
        module.setState(0);
        stopLoop();
        await delayFrame();
        primeVideoFrame(1);
      },
      start: startLoop,
      pause: stopLoop,
      resume: startLoop,
      reset() {
        module.reset();
      },
      stop: stopLoop,
      setButton(_player, button, pressed) {
        const bit = BUTTON_BITS[button];
        if (!bit) return;
        controllerBits = pressed ? controllerBits | bit : controllerBits & ~bit;
        module.setControllerBits(controllerBits);
      },
      setVolume(volume) {
        module.setMuted(volume <= 0);
      },
      resumeAudio,
      async saveState() {
        module.setState(0);
        module.saveState();
        return encodeSaveFiles(module.exportSaveFiles());
      },
      async loadState(state) {
        module.importSaveFiles(decodeSaveFiles(state));
        module.setState(0);
        module.loadState();
        await delayFrame();
        await delayFrame();
        primeVideoFrame(3);
      },
      dispose() {
        stopLoop();
        try {
          module.setMuted(true);
          module.setPaused(true);
        } catch (_err) {
          // Best-effort shutdown; route changes must never leave audio running.
        }
        try {
          if (module.scriptProcessorNode) {
            module.scriptProcessorNode.onaudioprocess = null;
            module.scriptProcessorNode.disconnect();
          }
        } catch (_err) {
          // Ignore WebAudio shutdown differences across browsers.
        }
        try {
          if (module._audioContext && module._audioContext.state !== "closed") {
            module._audioContext.close();
          }
        } catch (_err) {
          // Ignore close failures when the context is already unavailable.
        }
      },
    };
  };
})();
