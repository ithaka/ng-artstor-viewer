import { Component } from '@angular/core';
import { ArtstorViewer } from 'artstor-viewer';

@Component({
  selector: 'demo-app',
  templateUrl: './app.component.html'
})
export class AppComponent {
  meaning: number;
  currentId: string = "SS34216_34216_38866586"

  constructor(libService: ArtstorViewer) {
    // this.meaning = libService.getMeaning();
  }
}
