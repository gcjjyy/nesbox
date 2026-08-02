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

  function sameDescriptor(left, right) {
    if (!left || !right) return left === right;
    if (left.configurable !== right.configurable || left.enumerable !== right.enumerable) return false;
    if ("value" in left || "value" in right) {
      return "value" in left && "value" in right && left.value === right.value && left.writable === right.writable;
    }
    return left.get === right.get && left.set === right.set;
  }

  function replacePropertyTemporarily(target, property, value) {
    if ((typeof target !== "object" && typeof target !== "function") || target === null) {
      throw new Error(`${property} owner is not an object`);
    }
    const original = Object.getOwnPropertyDescriptor(target, property);
    if (original && !original.configurable && (!("value" in original) || !original.writable)) {
      throw new Error(`${property} cannot be temporarily overridden`);
    }

    const replacement = original && !original.configurable
      ? { ...original, value }
      : {
          configurable: true,
          enumerable: original ? original.enumerable : false,
          value,
          writable: true,
        };
    Object.defineProperty(target, property, replacement);
    const installed = Object.getOwnPropertyDescriptor(target, property);
    if (!(installed && "value" in installed && installed.value === value)) {
      if (original) Object.defineProperty(target, property, original);
      else delete target[property];
      throw new Error(`${property} override could not be verified`);
    }

    let restored = false;
    return function restoreProperty() {
      if (restored) return;
      if (original) Object.defineProperty(target, property, original);
      else if (!delete target[property]) throw new Error(`${property} override could not be removed`);
      restored = true;
      if (!sameDescriptor(Object.getOwnPropertyDescriptor(target, property), original)) {
        throw new Error(`${property} descriptor could not be restored`);
      }
    };
  }

  function initWithSharedAudioContext(module, selector, sharedContext) {
    if ((typeof sharedContext !== "object" && typeof sharedContext !== "function") || sharedContext === null) {
      throw new Error("FCEUX requires a shared AudioContext");
    }
    if (typeof sharedContext.resume !== "function") {
      throw new Error("Shared AudioContext resume is unavailable");
    }

    const restores = [];
    let setupError = null;
    try {
      function SharedAudioContext() {
        return sharedContext;
      }
      restores.push(replacePropertyTemporarily(globalThis, "AudioContext", SharedAudioContext));
      restores.push(replacePropertyTemporarily(globalThis, "webkitAudioContext", SharedAudioContext));
      restores.push(replacePropertyTemporarily(sharedContext, "resume", () => Promise.resolve()));
    } catch (error) {
      setupError = error;
    }

    if (setupError) {
      let restoreError = null;
      for (let index = restores.length - 1; index >= 0; index -= 1) {
        try {
          restores[index]();
        } catch (error) {
          restoreError = restoreError || error;
        }
      }
      if (restoreError) throw new AggregateError([setupError, restoreError], "FCEUX audio init guard setup failed");
      throw setupError;
    }

    let initError = null;
    let initResult = false;
    let moduleContextError = null;
    let restoreError = null;
    try {
      module._audioContext = sharedContext;
      if (module._audioContext !== sharedContext) throw new Error("FCEUX rejected the shared AudioContext");
      initResult = module.init(selector);
    } catch (error) {
      initError = error;
    } finally {
      try {
        module._audioContext = sharedContext;
        if (module._audioContext !== sharedContext) throw new Error("FCEUX replaced the shared AudioContext");
      } catch (error) {
        moduleContextError = error;
      }
      for (let index = restores.length - 1; index >= 0; index -= 1) {
        try {
          restores[index]();
        } catch (error) {
          restoreError = restoreError || error;
        }
      }
    }

    const failures = [initError, moduleContextError, restoreError].filter(Boolean);
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) throw new AggregateError(failures, "FCEUX audio init guard failed");
    return initResult;
  }

  window.createNesboxFceuxCore = async function createNesboxFceuxCore(options) {
    const FCEUX = await loadFceuxScript();
    const module = await FCEUX({
      canvas: options.canvas,
      _audioContext: options.audioContext,
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
    if (!initWithSharedAudioContext(module, "#" + CSS.escape(options.canvas.id), options.audioContext)) {
      throw new Error("FCEUX init failed");
    }
    module.setMuted(false);
    module.setPaused(true);
    normalizeCanvasStyle();

    let raf = 0;
    let running = false;
    let controllerBits = 0;

    function normalizeCanvasStyle() {
      options.canvas.style.setProperty("width", "100%", "important");
      options.canvas.style.setProperty("height", "100%", "important");
    }

    function delayFrame() {
      return new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }

    function primeVideoFrame(count = 2) {
      const wasPaused = !running;
      module.setPaused(false);
      for (let i = 0; i < count; i += 1) {
        module.setControllerBits(controllerBits);
        module.update();
      }
      normalizeCanvasStyle();
      if (wasPaused) module.setPaused(true);
    }

    function frame() {
      if (!running) return;
      module.setControllerBits(controllerBits);
      module.update();
      normalizeCanvasStyle();
      raf = requestAnimationFrame(frame);
    }

    function startLoop() {
      if (running) return;
      running = true;
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
        normalizeCanvasStyle();
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
      },
    };
  };
})();
