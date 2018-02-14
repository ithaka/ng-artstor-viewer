import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { HttpClientModule } from '@angular/common/http'

import { ArtstorViewer } from './component/artstor-viewer.component'
import { AssetService } from './asset.service'

@NgModule({
  imports: [CommonModule, HttpClientModule],
  declarations: [ArtstorViewer],
  providers: [ArtstorViewer, AssetService],
  exports: [ArtstorViewer]
})
export class ArtstorViewerModule { }
