// Fixed Windows NCSI probe; no user data or configurable URLs. Informational only.
export class Connectivity {
  constructor({ fetcher = fetch, now = Date.now, ttl = 30000 } = {}) {
    this.fetcher = fetcher;
    this.now = now;
    this.ttl = ttl;
    this.cached = null;
    this.pending = null;
  }
  check() {
    if (this.cached && this.now() - this.cached.checkedAt < this.ttl)
      return Promise.resolve(this.cached);
    return (this.pending ||= this.probe().finally(() => {
      this.pending = null;
    }));
  }
  async probe() {
    let online = false;
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 5000);
    timer.unref?.();
    try {
      const response = await this.fetcher(
        "http://www.msftconnecttest.com/connecttest.txt",
        {
          redirect: "manual",
          signal: controller.signal,
          headers: { "Cache-Control": "no-cache" },
        },
      );
      if (response.status === 200) {
        let text = "",
          size = 0;
        for await (const chunk of response.body) {
          size += chunk.length;
          if (size > 128) {
            controller.abort();
            break;
          }
          text += new TextDecoder().decode(chunk);
        }
        online = size <= 128 && text.trim() === "Microsoft Connect Test";
      } else await response.body?.cancel();
    } catch {
    } finally {
      clearTimeout(timer);
    }
    return (this.cached = { online, checkedAt: this.now() });
  }
}
