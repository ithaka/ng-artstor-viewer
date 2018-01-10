import { NgModule }      from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent }  from './app.component';
import { ArtstorViewer, ArtstorViewerModule } from 'artstor-viewer';

@NgModule({
  imports:      [ BrowserModule, ArtstorViewerModule ],
  declarations: [ AppComponent ],
  bootstrap:    [ AppComponent ]
})
export class AppModule { }
