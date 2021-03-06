# Artstor Viewer, Angular Component
Media viewer for content within Artstor Image Workspace

## Ithaka Open Source Initiative
This repository is open sourced by Ithaka as part of our initiative to increase transparency and contribute to the community. This particular repository is a working repository not intended as software available for consumption.

[Learn more](http://artstor.org/open-source) about our open source initiative

**Copyright 2018 Ithaka Harbors, Inc.**

## Building the Project

_Commands use `yarn`, which we recommend, but can be replaced with `npm`_

Using this repo:
- `yarn start` to run a live-reload server with the demo app
- `yarn run test` to test in watch mode, or `yarn run test:once` to only run once
- `yarn run build` to build the library
- `yarn run lint` to lint 
- `yarn run clean` to clean
- `yarn run integration` to run the integration e2e tests
- `yarn install ./relative/path/to/lib` after `yarn run build` to test locally in another app

To publish a new version:
- `yarn release` to increment version
- `git commit` to commit the version
- `yarn build` to build with new version
- `npm publish dist` to publish to yarn/npm
- `git push` to push version to master

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
