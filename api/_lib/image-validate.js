const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Base64 ~4/3 de la taille binaire. */
export const MAX_IMAGE_BASE64_CHARS = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 64;

export function assertImageSize(binary) {
  if (!binary || binary.length === 0) {
    throw new Error('Image vide.');
  }
  if (binary.length > MAX_IMAGE_BYTES) {
    throw new Error('Image trop lourde (max 5 Mo).');
  }
}

export function assertImageMagicBytes(binary, ext) {
  if (binary.length < 12) {
    throw new Error('Fichier image trop court.');
  }

  const h = (i) => binary[i];

  if (ext === 'png') {
    if (h(0) !== 0x89 || h(1) !== 0x50 || h(2) !== 0x4e || h(3) !== 0x47) {
      throw new Error('Le fichier ne ressemble pas à un PNG.');
    }
    return;
  }

  if (ext === 'jpg') {
    if (h(0) !== 0xff || h(1) !== 0xd8 || h(2) !== 0xff) {
      throw new Error('Le fichier ne ressemble pas à un JPEG.');
    }
    return;
  }

  if (ext === 'gif') {
    const sig = binary.toString('ascii', 0, 3);
    if (sig !== 'GIF') {
      throw new Error('Le fichier ne ressemble pas à un GIF.');
    }
    return;
  }

  if (ext === 'webp') {
    const riff = binary.toString('ascii', 0, 4);
    const webp = binary.toString('ascii', 8, 12);
    if (riff !== 'RIFF' || webp !== 'WEBP') {
      throw new Error('Le fichier ne ressemble pas à un WebP.');
    }
  }
}
