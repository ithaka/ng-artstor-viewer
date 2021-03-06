/**
 * System configuration for Angular samples
 * Adjust as necessary for your application needs.
 */
(function (global) {
  System.config({
    paths: {
      // paths serve as alias
      'npm:': 'node_modules/'
    },
    // map tells the System loader where to look for things
    map: {
      // our app is within the app folder
      app: 'app',
      'rxjs/internal/util': 'npm:rxjs/internal/util',
      'rxjs/internal/operators': 'npm:rxjs/internal/operators',
      'rxjs/internal': 'npm:rxjs/internal',
      'rxjs/operators': 'npm:rxjs/operators',
      'rxjs': 'npm:rxjs/bundles/rxjs.umd.js',
      // angular bundles
      '@angular/core': 'npm:@angular/core/bundles/core.umd.js',
      '@angular/common/http' : 'npm:@angular/common/bundles/common-http.umd.js',
      'tslib': 'npm:tslib/tslib.js',
      '@angular/common': 'npm:@angular/common/bundles/common.umd.js',
      '@angular/compiler': 'npm:@angular/compiler/bundles/compiler.umd.js',
      '@angular/platform-browser': 'npm:@angular/platform-browser/bundles/platform-browser.umd.js',
      '@angular/platform-browser-dynamic': 'npm:@angular/platform-browser-dynamic/bundles/platform-browser-dynamic.umd.js',
      '@angular/http': 'npm:@angular/http/bundles/http.umd.js',
      '@angular/router': 'npm:@angular/router/bundles/router.umd.js',
      '@angular/forms': 'npm:@angular/forms/bundles/forms.umd.js',
      'openseadragon': 'npm:openseadragon/build/openseadragon/openseadragon.js',

      // other libraries
    },
    // packages tells the System loader how to load when no filename and/or no extension
    packages: {
      app: {
        defaultExtension: 'js',
        meta: {
          './*.js': {
            loader: 'systemjs-angular-loader.js'
          }
        }
      },
      rxjs: {
        defaultExtension: 'js'
      },
      'rxjs/operators': {
        defaultExtension: 'js',
        main: 'index'
      },
      'rxjs/internal': {
        defaultExtension: 'js'
      },
      'rxjs/internal/util': {
        defaultExtension: 'js'
      },
      'rxjs/internal/operators': {
        defaultExtension: 'js'
      },
      'artstor-viewer': {
        main: 'index.js',
        defaultExtension: 'js',
        meta: {
          './*.js': {
            loader: 'systemjs-angular-loader.js'
          }
        }
      }
    }
  });
})(this);
