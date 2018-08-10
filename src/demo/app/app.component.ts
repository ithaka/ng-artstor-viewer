import { Component, OnInit } from '@angular/core';
import { ArtstorViewer } from 'artstor-viewer';
import { AppService } from './app.service';

@Component({
  selector: 'demo-app',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  meaning: number;
  currentId: string = "AWSS35953_35953_33681116"
  useThumbnail: boolean = false
  testEnv: boolean = false
  isEncrypted: boolean = false
  downloadLink: string = ""
  userHasSession: boolean = false
  
  constructor(private _app: AppService) {
    // this.meaning = libService.getMeaning();
  }

  ngOnInit(): void {
    this._app.getUser(this.testEnv).take(1)
      .subscribe(data => {
        console.log("Got a user!", data)
        this.userHasSession = true
      }, error => {
        console.error("Failed to get user!", error)
      })
  }

  handleLoadedMetadata(assetData) {
    console.log(assetData)
    this.downloadLink = assetData.downloadLink
  }
}
