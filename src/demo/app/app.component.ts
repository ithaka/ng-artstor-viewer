import { Component } from '@angular/core';
import { ArtstorViewer } from 'artstor-viewer';

@Component({
  selector: 'demo-app',
  templateUrl: './app.component.html'
})
export class AppComponent {
  meaning: number;
  currentId: string = "ARTSTOR_103_41822003761960"

  constructor(libService: ArtstorViewer) {
    // this.meaning = libService.getMeaning();
  }

  handleLoadedMetadata(assetData) {
    console.log(assetData)
  }
}
