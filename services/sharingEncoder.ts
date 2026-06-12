// URL-Safe Base64 encoder and decoder with full Unicode/UTF-8 support

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
