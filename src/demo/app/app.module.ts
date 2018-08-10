import { NgModule }      from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent }  from './app.component';
import { ArtstorViewerModule } from 'artstor-viewer';
import { AppService } from './app.service';

@NgModule({
  imports:      [ BrowserModule, ArtstorViewerModule ],
  declarations: [ AppComponent ],
  bootstrap:    [ AppComponent ],
  providers: [ AppService ]
})
export class AppModule { }
