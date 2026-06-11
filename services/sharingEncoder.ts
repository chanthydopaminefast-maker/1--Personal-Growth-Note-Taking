// URL-Safe Base64 encoder and decoder with full Unicode/UTF-8 support

export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("navigator.clipboard.writeText failed, using fallback:", err);
    }
  }

  // Robust fallback using temporary textarea
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Position out of sight
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return !!successful;
  } catch (err) {
    console.error("Fallback copy to clipboard failed:", err);
    return false;
  }
};

export const encodeToURLSafeBase64 = (obj: any): string => {
  try {
    const str = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch (err) {
    console.error("Base64 Encoding Error:", err);
    return '';
  }
};

export const decodeFromURLSafeBase64 = (base64: string): any => {
  try {
    let binary = base64.replace(/-/g, '+').replace(/_/g, '/');
    while (binary.length % 4) {
      binary += '=';
    }
    const str = atob(binary);
    const len = str.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = str.charCodeAt(i);
    }
    const decodedStr = new TextDecoder().decode(bytes);
    return JSON.parse(decodedStr);
  } catch (err) {
    console.error("Base64 Decoding Error:", err);
    return null;
  }
};
