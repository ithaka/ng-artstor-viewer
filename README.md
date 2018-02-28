# Artstor Viewer, Angular Component

Uses [Angular Package Format v4.0](https://docs.google.com/document/d/1CZC2rcpxffTDfRDs6p1cfbmKNLA6x5O-NtkJglDaBVs/edit#heading=h.k0mh3o8u5hx).

_Commands use `yarn`, which we recommend, but can be replaced with `npm`_

Using this repo:
- `yarn start` to run a live-reload server with the demo app
- `yarn run test` to test in watch mode, or `yarn run test:once` to only run once
- `yarn run build` to build the library
- `yarn run lint` to lint 
- `yarn run clean` to clean
- `yarn run integration` to run the integration e2e tests
- `yarn install ./relative/path/to/lib` after `yarn run build` to test locally in another app

If you need to debug the integration app, please check `./integration/README.md`.

## The Demo App
Used to test the viewer, and provides multiple asset ids to test different use cases.

1. [Clone](#clone "Clone it from github") or [download](#download "download it from github") the **artstor-viewer**.
1. Install npm packages with `yarn install`.
1. Run `npm start` to launch the sample application.

## Directory
```
src/
├── demo/
|  └── app/
|     ├── app.component.ts
|     └── app.module.ts
└── lib/
   ├── index.ts
   └── src/
      ├── component/
      |  └── artstor-viewer.component.ts
      ├── service/
      |  └── lib.service.ts
      └── module.ts

```
