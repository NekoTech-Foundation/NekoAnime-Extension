// Background Service Worker
// Handles requests from content scripts to bypass CORS

console.log("[Background] Service Worker Starting...");

chrome.runtime.onInstalled.addListener(() => {
    console.log("[Background] Installed");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "NEKO_FETCH") {
        handleFetch(request.payload, sendResponse);
        return true; // Indicates we will respond asynchronously
    }
});

async function handleFetch(payload, sendResponse) {
    const { url, options } = payload;
    
    try {
        // 1. Setup declarativeNetRequest rule to spoof Referer
        const hostname = new URL(url).hostname;
        const ruleId = 1; // Simple single rule for now

        // Note: This requires 'declarativeNetRequest' permission in manifest.json
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [ruleId],
            addRules: [{
                "id": ruleId,
                "priority": 1,
                "action": {
                    "type": "modifyHeaders",
                    "requestHeaders": [
                        { "header": "Referer", "operation": "set", "value": "https://animevietsub.show/" },
                        { "header": "Origin", "operation": "set", "value": "https://animevietsub.show" }
                    ]
                },
                "condition": {
                    "urlFilter": hostname, 
                    "resourceTypes": ["xmlhttprequest"]
                }
            }]
        });

        console.log("[Background] Fetching with DNR Rule:", url);
        
        // 2. Perform the fetch
        const response = await fetch(url, {
             method: options.method || "GET"
        });

        console.log("[Background] Response:", response.status);

        // 3. Convert Blob to Base64
        const blob = await response.blob();
        const base64Data = await blobToBase64(blob);

        sendResponse({
            success: true,
            data: base64Data,
            url: response.url,
            status: response.status
        });

    } catch (error) {
        console.error("[Background] Fetch Error:", error);
        sendResponse({
            success: false,
            error: error.message || "Unknown fetch error"
        });
    }
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
