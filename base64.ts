
/**
 * Safe Base64 encoding for Unicode strings (like Persian/Farsi).
 */
export const toBase64 = (str: string): string => {
  try {
    const bytes = new TextEncoder().encode(str);
    const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    return btoa(binString);
  } catch (e) {
    console.error("Base64 Encoding Error:", e);
    return "";
  }
};

/**
 * Safe Base64 decoding for Unicode strings.
 */
export const fromBase64 = (base64: string): string => {
  try {
    const binString = atob(base64);
    const bytes = Uint8Array.from(binString, (m) => m.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch (e) {
    console.error("Base64 Decoding Error:", e);
    throw new Error("فرمت توکن نامعتبر است.");
  }
};
