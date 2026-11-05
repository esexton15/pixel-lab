# Pixel Lab

A walk-up image-processing exhibit built with Astro. The astronaut sample loads
immediately. Visitors can choose a sample or turn on the camera, choose a pixel
rule, and inspect the same point in the input and output.

```sh
npm install
npm run dev
```

Open the localhost URL printed by Astro. The camera requires browser permission
and localhost or HTTPS. **Freeze** holds a camera frame for inspection. Photos
and camera frames are processed in the browser.

- `src/pages/index.astro` defines the exhibit layout.
- `src/filters.js` defines the filters. The exhibit displays the actual filter function.
- `src/app.js` handles image input, rendering, and pixel inspection.
- `public/samples/` contains the four sample photos supplied from Pexels.

## Offline use at the fair

Open the deployed HTTPS site on the tablet while it has internet. If you add it
to the home screen, launch it from there while still online. Wait for
**Ready offline** on the kiosk screen, then disconnect and relaunch it to check
the setup. The sample photos and filters are stored on the device, and camera
processing runs locally with browser permission.

To try offline mode on the development machine, run `npm run build` followed by
`npm run preview`. The service worker is generated for production builds.
