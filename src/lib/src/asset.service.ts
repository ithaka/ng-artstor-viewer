import { Injectable } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Observable } from 'rxjs/Observable'

@Injectable()
export class AssetService {

  private _testEnv: boolean = false

  private objectTypeNames: { [key: string]: string } = {
    "1": 'specimen',
    "2": 'visual',
    "3": 'use',
    "6": 'publication',
    "7": 'synonyms',
    "8": 'people',
    "9": 'repository',
    "10": 'image',
    "11": 'panorama',
    "12": 'audio',
    "13": '3d',
    "21": 'powerpoint',
    "22": 'document',
    "23": 'excel',
    "24": 'kaltura'
  }

  private metadataFields: string[] = [
    "arttitle",
    "artclassification",
    "artcollectiontitle",
    "artcreator",
    "artculture",
    "artcurrentrepository",
    "artcurrentrepositoryidnumber",
    "artdate",
    "artidnumber",
    "artlocation",
    "artmaterial",
    "artmeasurements",
    "artrelation",
    "artrepository",
    "artsource",
    "artstyleperiod",
    "artsubject",
    "arttechnique",
    "artworktype"
  ]



  constructor(
    private _http: HttpClient
  ) { }

  private getUrl(): string {
    return this.testEnv ? '//stage.artstor.org/' : '//library.artstor.org/'
  }

  get testEnv(): boolean {
    return this._testEnv
  }
  set testEnv(env: boolean) {
    this._testEnv = env
  }


  public getMetadata(assetId: string, groupId?: string): Observable<MetadataResponse> {
    let url = this.getUrl() + 'api/v1/metadata?object_ids=' + assetId
    if (groupId){
        // Groups service modifies certain access rights for shared assets
        url = this.getUrl() + 'api/v1/group/'+ groupId +'/metadata?object_ids=' + assetId
    }
    let headers: HttpHeaders = new HttpHeaders().set('Content-Type', 'application/json')
    return this._http
        .get<MetadataResponse>( url, { headers: headers, withCredentials: true })
  }

  public getFpxInfo(assetId: string, objectTypeId: number): Observable<ImageFPXResponse> {
    let requestUrl = this.getUrl() + 'api/imagefpx/' + assetId + '/' + objectTypeId;

    let headers: HttpHeaders = new HttpHeaders().set('Content-Type', 'application/json')
    return this._http
        .get<ImageFPXResponse>(requestUrl, { headers: headers, withCredentials: true })
  }
}

interface MetadataResponse {
  metadata: AssetResponse[]
  success: boolean
  total: 1 // the total number of items returned
}

interface AssetResponse {
  SSID: string
  category_id: string
  category_name: string
  collection_id: string
  collection_name: string
  collection_type: number
  download_size: string
  fileProperties: { [key: string]: string }[] // array of objects with a key/value pair
  height: number
  image_url: string
  metadata_json: MetadataField[]
  object_id: string
  object_type_id: number
  resolution_x: number
  resolution_y: number
  thumbnail_url: string
  title: string
  width: number
}

interface MetadataField {
  count: number // the number of fields with this name
  fieldName: string
  fieldValue: string
  index: number
}

interface ImageFPXResponse {
  height: number
  id: {
    fileName: string
    resolution: number
  }
  imageId: string
  imageUrl: string
  resolutionX: number
  resolutionY: number
  width: number
}