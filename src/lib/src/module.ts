import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ArtstorViewer } from './component/artstor-viewer.component';

@NgModule({
  imports: [CommonModule],
  declarations: [ArtstorViewer],
  providers: [ArtstorViewer],
  exports: [ArtstorViewer]
})
export class ArtstorViewerModule { }
