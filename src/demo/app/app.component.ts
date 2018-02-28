import { Component } from '@angular/core';
import { ArtstorViewer } from 'artstor-viewer';

@Component({
  selector: 'demo-app',
  templateUrl: './app.component.html'
})
export class AppComponent {
  meaning: number;
  currentId: string = "AWSS35953_35953_33681116"
  useThumbnail: boolean = false

  constructor(libService: ArtstorViewer) {
    // this.meaning = libService.getMeaning();
  }

  handleLoadedMetadata(assetData) {
    console.log(assetData)
  }
}
