export async function handleApiResponse(res: Response) {
    // A 204 No Content response is a success case, but has no body to parse.
    // We can return null to indicate success without a payload.
    if (res.status === 204) {
      return null;
    }

    const text = await res.text();
  
    if (!res.ok) {
        let errorMsg = `Request failed with status: ${res.status}`;
        try {
            if (text) {
                const errorJson = JSON.parse(text);
                errorMsg = errorJson.error || errorMsg;
            }
        } catch (e) {
            if (text) {
                errorMsg = text;
            }
        }
        throw new Error(errorMsg);
    }
  
    // It's possible for a successful response (200 OK) to have an empty body.
    if (!text) {
        return null;
    }
  
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse successful response as JSON:", text);
        throw new Error("Received an invalid JSON response from the server.");
    }
  }
  