/** Patches the pinned 4.2.3 runtime: persist extracted core files, keyed by build and variant. */
export function patchEmulatorJsCoreCache(source: string): string {
  const replacements: Array<[string, string]> = [
    ['        this.textElem.innerText = this.localization("Download Game Core");',
      '        this.textElem.innerText = this.localization("Load Game Core");'],
    ['const gotCore = (data) => {', 'const gotCore = (data, cachedFiles, cacheKey, version) => {'],
    ['this.checkCompression(new Uint8Array(data), this.localization("Decompress Game Core")).then((data) => {',
      '(cachedFiles ? Promise.resolve(cachedFiles) : this.checkCompression(new Uint8Array(data), this.localization("Decompress Game Core"))).then((data) => {'],
    ['                this.initGameCore(js, wasm, thread);', `                if (!cachedFiles && cacheKey) {
                    // A cache write is optional; quota/private-mode failures must not prevent play.
                    this.storage.core.put(cacheKey, { version, files: data }).catch(() => {});
                }
                this.initGameCore(js, wasm, thread);`],
    [`            if (!this.debug) {
                const result = await this.storage.core.get(filename);
                if (result && result.version === rep.buildStart) {
                    gotCore(result.data);
                    return;
                }
            }`, `            const cacheKey = "nesbox-expanded-v1:" + filename;
            const result = await this.storage.core.get(cacheKey).catch(() => undefined);
            const validFiles = result && result.files && Object.keys(result.files).some(k => k.endsWith(".wasm") && result.files[k]?.byteLength > 0)
                && Object.keys(result.files).some(k => k.endsWith(".js") && !k.endsWith(".worker.js") && result.files[k]?.byteLength > 0)
                && result.files["build.json"]?.byteLength > 0;
            if (result && result.version === rep.buildStart && validFiles) {
                this.textElem.innerText = this.localization("Load Cached Game Core");
                gotCore(null, result.files);
                return;
            }`],
    [`            gotCore(res.data);
            this.storage.core.put(filename, {
                version: rep.buildStart,
                data: res.data
            });`, '            gotCore(res.data, null, cacheKey, rep.buildStart);'],
  ];
  for (const [before, after] of replacements) {
    if (!source.includes(before)) throw new Error('Unsupported pinned EmulatorJS core cache layout');
    source = source.replace(before, after);
  }
  return source;
}
