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
        // 1. Setup declarativeNetRequest rule
        // We only override Referer/Origin if strictly needed or just trust the client provided headers?
        // DNR is global for the browser, modifying it for every request might be race-condition prone if multiple requests happen.
        // But for this use case (single user), it's probably OK.
        
        const hostname = new URL(url).hostname;
        const ruleId = 1;

        // Extract headers from options to see if we need to modify DNR
        // Actually DNR is better for Referer/Origin than fetch headers often because of browser restrictions (Refused to set unsafe header).
        
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

        console.log("[Background] Fetching:", url, options);
        
        // 2. Perform the fetch
        // Prepare fetch options
        const fetchOptions = {
            method: options.method || "GET",
            headers: options.headers || {},
        };

        if (options.body || options.data) {
            fetchOptions.body = options.body || options.data;
        }

        const response = await fetch(url, fetchOptions);

        console.log("[Background] Response:", response.status);

        // 3. Read body
        const blob = await response.blob();
        const base64Data = await blobToBase64(blob);
        
        // Gather response headers
        const responseHeaders = {};
        for (const [key, value] of response.headers.entries()) {
             responseHeaders[key] = value;
        }

        // 4. Capture Cookies (since fetch hides Set-Cookie)
        try {
            const cookies = await chrome.cookies.getAll({ url: url });
            const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
            if (cookieStr) {
                // Mimic Set-Cookie or just provide a consolidated cookie string
                // The client looks for 'set-cookie' or just a raw string to parse.
                // Note: Standard Set-Cookie is one header per cookie, but here we can just put all in one string
                // because useAuthStore splits by ';' which matches our format.
                responseHeaders['set-cookie'] = cookieStr;
            }
        } catch (cookieErr) {
            console.warn("[Background] Cookie fetch failed:", cookieErr);
        }

        sendResponse({
            success: true,
            data: base64Data, // Always Base64
            url: response.url,
            status: response.status,
            headers: responseHeaders
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
