import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';

import { ArtstorViewer } from './component/artstor-viewer.component';

@NgModule({
  imports: [CommonModule, HttpClientModule],
  declarations: [ArtstorViewer],
  providers: [ArtstorViewer],
  exports: [ArtstorViewer]
})
export class ArtstorViewerModule { }
