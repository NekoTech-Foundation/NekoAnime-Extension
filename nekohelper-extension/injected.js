// Injected Script
// Runs in the Page Context. Exposes window.NekoHelper

class NekoHelperAPI {
    constructor() {
        this.requests = new Map();
        this.requestIdCounter = 0;

        // Listen for responses from Content Script
        window.addEventListener("message", (event) => {
            if (event.source !== window) return;

            if (event.data.type === "NEKO_BS_RESPONSE") {
                const { requestId, result } = event.data;
                if (this.requests.has(requestId)) {
                    const { resolve, reject } = this.requests.get(requestId);

                    if (result && result.success) {
                        resolve(result);
                    } else {
                        reject(result ? result.error : "Unknown Extension Error");
                    }

                    this.requests.delete(requestId);
                }
            }
        });
    }

    // Public API
    fetch(url, options = {}) {
        return new Promise((resolve, reject) => {
            const requestId = ++this.requestIdCounter;
            this.requests.set(requestId, { resolve, reject });

            window.postMessage({
                type: "NEKO_BS_REQUEST",
                requestId: requestId,
                payload: { url, options }
            }, "*");

            // Timeout safety
            setTimeout(() => {
                if (this.requests.has(requestId)) {
                    this.requests.delete(requestId);
                    reject("NekoHelper Request Timeout");
                }
            }, 30000); // 30s timeout
        });
    }

    isReady() {
        return true;
    }
}

window.NekoHelper = new NekoHelperAPI();
console.log("NekoHelper Loaded ✓");
