import { Injectable } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Observable } from 'rxjs/Observable'

import { Asset } from './asset.interface'

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


  public buildAsset(assetId: string, groupId?: string): Asset {
    this.getMetadata(assetId, groupId)
      .take(1)
      .subscribe((assetData) => {

        // do we need to make an imageFpx call??

      }, (err) => {
        // TODO: need to properly handle error!
        console.error(err)
      })
  }

  private getMetadata(assetId: string, groupId?: string): Observable<AssetData> {
    let url = this.getUrl() + 'api/v1/metadata?object_ids=' + assetId
    if (groupId){
        // Groups service modifies certain access rights for shared assets
        url = this.getUrl() + 'api/v1/group/'+ groupId +'/metadata?object_ids=' + assetId
    }
    let headers: HttpHeaders = new HttpHeaders().set('Content-Type', 'application/json')
    return this._http
        .get<MetadataResponse>( url, { headers: headers, withCredentials: true })
        .map((res) => {
          if (!res.metadata[0]) {
            throw new Error('Unable to load metadata!')
          }
          let data: AssetDataResponse = res.metadata[0]

          // although this seems repetitive, it provides us an ability to set defaults at the source
          //  and gives us insulation from server name changes because we have a single place to update
          //  the naming of any property
          let assetData: AssetData = {
            SSID: data.SSID,
            category_id: data.category_id,
            category_name: data.category_name,
            collection_id: data.collection_id,
            collection_name: data.collection_name,
            collection_type: data.collection_type,
            download_size: data.downloadSize || data.download_size || '1024,1024',
            fileProperties: data.fileProperties,
            height: data.height,
            image_url: data.image_url,
            metadata_json: data.metadata_json,
            object_id: data.object_id,
            object_type_id: data.object_type_id,
            resolution_x: data.resolution_x,
            resolution_y: data.resolution_y,
            thumbnail_url: data.thumbnail_url,
            title: data.title && data.title !== "" ? data.title : 'Untitled',
            width: data.width
          }
          return assetData
        })
  }

  private getFpxInfo(assetId: string, objectTypeId: number): Observable<ImageFPXResponse> {
    let requestUrl = this.getUrl() + 'api/imagefpx/' + assetId + '/' + objectTypeId;

    let headers: HttpHeaders = new HttpHeaders().set('Content-Type', 'application/json')
    return this._http
        .get<ImageFPXResponse>(requestUrl, { headers: headers, withCredentials: true })
  }
}

export interface MetadataResponse {
  metadata: AssetDataResponse[]
  success: boolean
  total: 1 // the total number of items returned
}

export interface AssetData {
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

interface AssetDataResponse {
  SSID: string
  category_id: string
  category_name: string
  collection_id: string
  collection_name: string
  collection_type: number
  downloadSize?: string
  download_size?: string
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

export interface MetadataField {
  count: number // the number of fields with this name
  fieldName: string
  fieldValue: string
  index: number
  link?: string
}

export interface ImageFPXResponse {
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