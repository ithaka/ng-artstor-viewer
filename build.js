'use strict';

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const camelCase = require('camelcase');
const ngc = require('@angular/compiler-cli/src/main').main;
// const rollup = require('rollup');
// const uglify = require('rollup-plugin-uglify');
// const sourcemaps = require('rollup-plugin-sourcemaps');
// const nodeResolve = require('rollup-plugin-node-resolve');
// const commonjs = require('rollup-plugin-commonjs');

const inlineResources = require('./inline-resources');

const libName = require('./package.json').name;
const rootFolder = path.join(__dirname);
const compilationFolder = path.join(rootFolder, 'out-tsc');
const srcFolder = path.join(rootFolder, 'src/lib');
const distFolder = path.join(rootFolder, 'dist');
const tempLibFolder = path.join(compilationFolder, 'lib');
const es5OutputFolder = path.join(compilationFolder, 'lib-es5');
// const es2015OutputFolder = path.join(compilationFolder, 'lib-es2015');

return Promise.resolve()
  // Copy library to temporary folder and inline html/css.
  .then(() => _relativeCopy(`**/*`, srcFolder, tempLibFolder)
    .then(() => inlineResources(tempLibFolder))
    .then(() => console.log('Inlining succeeded.'))
  )
  // // Compile to ES2015.
  // .then(() => ngc([ '--project', `${tempLibFolder}/tsconfig.lib.json` ]))
  // .then(exitCode => exitCode === 0 ? Promise.resolve() : Promise.reject())
  // .then(() => console.log('ES2015 compilation succeeded.'))
  // Compile to ES5.
  .then(() => ngc([ '--project', `${tempLibFolder}/tsconfig.es5.json` ]))
  .then(exitCode => exitCode === 0 ? Promise.resolve() : Promise.reject())
  .then(() => console.log('ES5 compilation succeeded.'))
  // Copy package files
  .then(() => Promise.resolve()
    .then(() => _relativeCopy('LICENSE.md', rootFolder, distFolder))
    .then(() => _relativeCopy('package.json', rootFolder, distFolder))
    .then(() => _relativeCopy('README.md', rootFolder, distFolder))
    .then(() => _relativeCopy('**/*', es5OutputFolder, distFolder ))
    .then(() => console.log('Package files copy succeeded.'))
  )
  .catch(e => {
    console.error('\Build failed. See below for errors.\n');
    console.error(e);
    process.exit(1);
  });


// Copy files maintaining relative paths.
function _relativeCopy(fileGlob, from, to) {
  console.log("Copying ", fileGlob)
  return new Promise((resolve, reject) => {
    glob(fileGlob, { cwd: from, nodir: true }, (err, files) => {
      if (err) reject(err);
      files.forEach(file => {
        const origin = path.join(from, file);
        const dest = path.join(to, file);
        const data = fs.readFileSync(origin, 'utf-8');
        _recursiveMkDir(path.dirname(dest));
        fs.writeFileSync(dest, data);
        resolve();
      })
    })
  });
}

// Recursively create a dir.
function _recursiveMkDir(dir) {
  if (!fs.existsSync(dir)) {
    _recursiveMkDir(path.dirname(dir));
    fs.mkdirSync(dir);
  }
}
