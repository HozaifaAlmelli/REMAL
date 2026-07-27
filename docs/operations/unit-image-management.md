# Unit Image Management

This guide explains how to manage unit images from the admin portal:
`Admin -> Units -> Unit details -> Images`.

## Add by direct URL

1. Upload the image to any public host or CDN.
2. Copy the direct image URL of the image itself, e.g.
   `https://cdn.example.com/units/unit-photo.webp`.
3. Open the unit's **Images** tab.
4. Select **Direct URL**.
5. Paste the link into **Direct image URL**.
6. Tick **Set as cover image** if this is the main photo.
7. Click **Add image**.

The system stores the URL as an image reference only. The file is NOT copied to the
VPS in this flow.

## Upload from device

1. Open the unit's **Images** tab.
2. Select **Upload from device**.
3. Pick the image or drag it into the drop zone.
4. Allowed types: JPG, PNG, WebP, AVIF.
5. Maximum size: 5MB.
6. Tick **Set as cover image** if this is the main photo.
7. Click **Upload & add image**.

After a successful upload:

- The API saves the file inside the container at `/app/uploads/units/...`.
- In production, that path is bind-mounted from the VPS host:
  `/opt/kaza/uploads`.
- The DB stores only the relative `fileKey`, e.g.
  `units/<unitId>/20260705/<guid>.webp`.
- The public URL is:
  `https://api.kaza-booking.com/uploads/units/...`.

## What NOT to do

- Do NOT use `docker cp` as a production way to add images. It is acceptable only as a
  temporary manual diagnostic/emergency measure, never as an operating workflow.
- Do NOT store production images inside the container only; any file inside the
  container without a bind mount is lost on rebuild/recreate.
- Do NOT upload huge uncompressed images.
- Do NOT use SVG for unit images; the upload accepts raster formats only.
- Do NOT store filesystem paths or base64 data in the database.

## Best practices

- WebP is usually the best choice for size vs. quality.
- Target under 300KB per image where possible.
- Use web-appropriate dimensions instead of large raw camera files.
- Keep exactly one clear cover image.
- Order images deliberately; the first image drives the first impression on the
  storefront.

## Operations and backup

- VPS host path: `/opt/kaza/uploads`.
- API container path: `/app/uploads`.
- Public API path: `/uploads/**`.
- Backup is mandatory: `/opt/kaza/uploads` must be part of the backup plan.
- Back up the DB and the uploads together. DB references become worthless if the
  files are lost from `/opt/kaza/uploads`.
- Never delete the uploads folder in any cleanup.
- Monitoring disk usage of `/opt/kaza/uploads` is an important operational concern,
  but it is a separate follow-up from the upload feature itself.

## Deploy notes

- No DB migration is required for this feature.
- Do not edit `.env.production` for this feature; the defaults cover the upload path.
- On the shared VPS, never start Kaza's `nginx`/`certbot`.
- When deploying after merge, rebuild `api` and `portal` only. No `demo` rebuild is
  needed.
- If `novatova-nginx` does not set `client_max_body_size 6m;` for the
  `api.kaza-booking.com` server block, images larger than 1MB may fail with 413 before
  reaching the API. Any live edit to `novatova-nginx` requires explicit approval, a
  backup of the config file, then `nginx -t` before reload.
