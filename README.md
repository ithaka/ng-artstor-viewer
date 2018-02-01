# Artstor Viewer, Angular Component

This is a simple library quickstart for Angular libraries, implementing the
[Angular Package Format v4.0](https://docs.google.com/document/d/1CZC2rcpxffTDfRDs6p1cfbmKNLA6x5O-NtkJglDaBVs/edit#heading=h.k0mh3o8u5hx).

Using this repo:
- `npm start` to run a live-reload server with the demo app
- `npm run test` to test in watch mode, or `npm run test:once` to only run once
- `npm run build` to build the library
- `npm run lint` to lint 
- `npm run clean` to clean
- `npm run integration` to run the integration e2e tests
- `npm install ./relative/path/to/lib` after `npm run build` to test locally in another app

If you need to debug the integration app, please check `./integration/README.md`.

## The Demo App

1. Create a project folder (you can call it `artstor-viewer` and rename it later).
1. [Clone](#clone "Clone it from github") or [download](#download "download it from github") the **QuickStart Library seed** into your project folder.
1. Install npm packages.
1. Run `npm start` to launch the sample application.


### Clone

Perform the _clone-to-launch_ steps with these terminal commands.

```
git clone git@github.com:ithaka/ng-artstor-viewer.git
cd ng-artstor-viewer
npm install
npm start
```

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
