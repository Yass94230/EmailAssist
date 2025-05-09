/**
 * utils/base64.ts
 * 
 * Utilitaires de conversion de données Base64 compatibles avec tous les navigateurs
 * Solution pour éviter les erreurs "x.from is not a function", "y.from is not a function", etc.
 */

/**
 * Convertit une chaîne Base64 en Blob sans utiliser .from()
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  try {
    // Retirer les caractères non-base64 si nécessaire
    const cleanBase64 = base64.replace(/^data:.*,/, '');
    
    // Décodage Base64 sans utiliser Uint8Array.from ou Array.from
    const binaryString = window.atob(cleanBase64);
    const length = binaryString.length;
    
    // Créer le tableau d'octets manuellement, sans utiliser .from()
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new Blob([bytes], { type: mimeType });
  } catch (error) {
    console.error('Erreur dans base64ToBlob:', error);
    // Retourner un blob vide en cas d'erreur
    return new Blob([], { type: mimeType });
  }
}

/**
 * Convertit une chaîne Base64 en ArrayBuffer sans utiliser .from()
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  try {
    // Retirer les caractères non-base64 si nécessaire
    const cleanBase64 = base64.replace(/^data:.*,/, '');
    
    // Décodage Base64 sans utiliser Uint8Array.from ou Array.from
    const binaryString = window.atob(cleanBase64);
    const length = binaryString.length;
    
    // Créer le tableau d'octets manuellement, sans utiliser .from()
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes.buffer;
  } catch (error) {
    console.error('Erreur dans base64ToArrayBuffer:', error);
    // Retourner un ArrayBuffer vide en cas d'erreur
    return new ArrayBuffer(0);
  }
}

/**
 * Convertit une chaîne Base64 en URL de données sans utiliser .from()
 */
export function base64ToDataUrl(base64: string, mimeType: string): string {
  try {
    // Si c'est déjà une URL de données, la retourner telle quelle
    if (base64.startsWith('data:')) {
      return base64;
    }
    
    // Sinon, créer une URL de données
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('Erreur dans base64ToDataUrl:', error);
    return '';
  }
}

/**
 * Convertit une chaîne Base64 en URL d'objet (pour l'audio ou l'image)
 */
export function base64ToObjectUrl(base64: string, mimeType: string): string {
  try {
    const blob = base64ToBlob(base64, mimeType);
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Erreur dans base64ToObjectUrl:', error);
    return '';
  }
}

/**
 * Fonction universelle pour manipuler Base64 en toute sécurité
 * Cette fonction polyvalente peut être utilisée dans toute l'application pour remplacer 
 * les conversions problématiques utilisant .from()
 */
export function safeBase64Convert(
  base64: string, 
  mimeType: string = 'application/octet-stream', 
  outputFormat: 'blob' | 'arrayBuffer' | 'dataUrl' | 'objectUrl' = 'blob'
): any {
  switch (outputFormat) {
    case 'blob':
      return base64ToBlob(base64, mimeType);
    case 'arrayBuffer':
      return base64ToArrayBuffer(base64);
    case 'dataUrl':
      return base64ToDataUrl(base64, mimeType);
    case 'objectUrl':
      return base64ToObjectUrl(base64, mimeType);
    default:
      return base64ToBlob(base64, mimeType);
  }
}

/**
 * Exporte la bonne fonction en fonction du navigateur ou de l'environnement
 * Cela permet d'utiliser cette méthode comme remplacement de .from() tout en restant compatible
 */
export const safeConversion = {
  toBlob: base64ToBlob,
  toArrayBuffer: base64ToArrayBuffer,
  toDataUrl: base64ToDataUrl,
  toObjectUrl: base64ToObjectUrl,
  convert: safeBase64Convert
};

export default safeConversion;