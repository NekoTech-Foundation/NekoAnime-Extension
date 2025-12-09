// Content Script
// Bridges the web page (Next.js) and the Extension Background

// Inject a script to expose window.NekoHelper to the page
console.log("[NekoHelper Content] Script starting...");

const injectScript = () => {
    try {
        const container = document.head || document.documentElement;
        if (!container) {
            console.error("[NekoHelper Content] No container found to inject script!");
            return;
        }
        const s = document.createElement('script');
        s.src = chrome.runtime.getURL('injected.js');
        s.onload = function() {
            console.log("[NekoHelper Content] injected.js loaded");
            this.remove();
        };
        s.onerror = function(e) {
            console.error("[NekoHelper Content] Failed to load injected.js", e);
        };
        container.appendChild(s);
        console.log("[NekoHelper Content] Script appended to", container.tagName);
    } catch (e) {
        console.error("[NekoHelper Content] Injection Error:", e);
    }
};

// Start injection
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectScript);
} else {
    injectScript();
}

// Listen for messages from the injected script (Page)
window.addEventListener("message", (event) => {
    // Only accept messages from the same window
    if (event.source !== window) return;

    if (event.data.type && event.data.type === "NEKO_BS_REQUEST") {
        // Forward to Background
        chrome.runtime.sendMessage({
            type: "NEKO_FETCH",
            payload: event.data.payload
        }, (response) => {
            // Check for connection errors (background script dead/unreachable)
            if (chrome.runtime.lastError) {
                console.error("[NekoHelper Content] Connection Error:", chrome.runtime.lastError.message);
                window.postMessage({
                    type: "NEKO_BS_RESPONSE",
                    requestId: event.data.requestId,
                    result: {
                        success: false,
                        error: "Extension Background Connection Failed: " + chrome.runtime.lastError.message
                    }
                }, "*");
                return;
            }

            // Send response back to Page
            window.postMessage({
                type: "NEKO_BS_RESPONSE",
                requestId: event.data.requestId,
                result: response
            }, "*");
        });
    }
});
