import { Component } from '@angular/core';
import { ArtstorViewer } from 'artstor-viewer';

@Component({
  selector: 'demo-app',
  templateUrl: './app.component.html'
})
export class AppComponent {
  meaning: number;
  constructor(libService: ArtstorViewer) {
    // this.meaning = libService.getMeaning();
  }
}
