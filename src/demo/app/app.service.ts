import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class AppService {

    constructor(private _http: HttpClient) {

    }

    /**
     * Get user object
     * - Not already logged in or IP auth'd, this will return an "unaffiliated" user object
     * @param isTest is Test or Prod environment
     */
    getUser(isTest: boolean) : Observable<any> {
        let stageSubdomain = window.location.protocol === 'http:' ? 'stagely' : 'stage'
        let url = '//' + (isTest ? stageSubdomain : 'library' ) +'.artstor.org/api/secure/userinfo?no-cache=' + new Date().valueOf()
        return this._http.get(url)
    }

}