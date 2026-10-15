/**
 * Address of a product's photo. The `v` part changes whenever the photo is replaced, so browsers, the service worker and
 * any other cache treat a new photo as a new file and never show the old one.
 */
export const productImageUrl = (id: string, version: Date | string | number | null | undefined) =>
  `/api/products/${id}/image?v=${version ? new Date(version).getTime() : 0}`;
