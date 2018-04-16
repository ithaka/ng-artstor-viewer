import { Injectable } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Observable } from 'rxjs/Rx'

import { Asset } from './asset.interface'


/**
 * The point of the AssetService is to get all the relevant information from the server reguarding the contstruciton of assets.
 * Pls don't add things that don't have to do with the construction of assets
 * This service gets everything that an asset needs for its construction from the services, cleans the data into a
 *  digestible format (outlined in the interfaces below), and then feeds that to the Asset constructor in order to
 *  return an Observable resolved with an Asset. The asset is responsible for assigning default values.
 */
@Injectable()
export class AssetService {

  public testEnv: boolean = false
  public encrypted: boolean = false

  constructor(
    private _http: HttpClient
  ) {
  }

  public getUrl(): string {
    /** 
     * Example URLs viewer could be hosted on, and expected endpoint route:
     * - library.artstor.org                     --> /
     * - stage.artstor.org                       --> /
     * - sahara.artstor.org                      --> /
     * - ezproxy-prd.bodleian.ox.ac.uk:3051      --> /
     * - library.artstor.org.luna.wellesley.edu  --> /
     * - localhost                               --> //stage.artstor.org/
     * - local.artstor.org                       --> //stage.artstor.org/
     * - ang-ui.apps.prod.cirrostratus.org       --> //library.artstor.org/
     * - jstor.org                               --> //library.artstor.org/
    */
    let nonRelativeDomains = [
      "localhost",
      "local.",
      "ang-ui.apps.prod.cirrostratus.org",
      "ang-ui.apps.test.cirrostratus.org",
      "www.jstor.org"
    ]
    // If it's a non-relative domain, use an explicit domain for api calls
    let useDomain: boolean = new RegExp(nonRelativeDomains.join("|")).test(document.location.hostname)
    if (useDomain) {
      return this.testEnv ? '//stage.artstor.org/' : '//library.artstor.org/'
    } else {
      return '/'
    }
  }

  public buildAsset(assetId: string, groupId?: string): Observable<Asset> {
    let metadataObservable
    if (this.encrypted) {
      metadataObservable = this.getEncryptedMetadata(assetId)
    } else {
      metadataObservable = this.getMetadata(assetId, groupId)
    }
    return metadataObservable.flatMap((assetData) => {

        // do we need to make an imageFpx call to get kaltura data??
        switch (assetData.object_type_id) {
          case 12:
          case 24:
            return this.getFpxInfo(assetData.object_id)
              .map((res) => {
                assetData.fpxInfo = res
                return assetData
              })
          default: 
            return Observable.of(assetData)
        }
      })
      .map((assetData) => {
        return new Asset(assetData)
      })
  }

  /**
   * Gets the metadata for an asset and cleans it into an object with which an Asset can be constructed
   * @param assetId The id of the asset for which to obtain the metadata
   * @param groupId The group from which the asset was accessed, if it exists (helps with authorization)
   */
  private getMetadata(assetId: string, groupId?: string): Observable<AssetData> {
    let url = this.getUrl() + 'api/v1/metadata?object_ids=' + assetId
    if (groupId){
        // Groups service modifies certain access rights for shared assets
        url = this.getUrl() + 'api/v1/group/'+ groupId +'/metadata?object_ids=' + encodeURIComponent(assetId) 
    }
    let headers: HttpHeaders = new HttpHeaders().set('Content-Type', 'application/json')
    return this._http
        .get<MetadataResponse>( url, { headers: headers, withCredentials: true })
        .map((res) => {
          if (!res.metadata[0]) {
            throw new Error('Unable to load metadata!')
          }
          let data: AssetDataResponse = res.metadata[0]
          let assetData: AssetData = this.mapMetadata(data)
          if (groupId) {
            assetData.groupId = groupId
          }
          return assetData
        })
  }

  /**
     * Call to API which returns an asset, given an encrypted_id
     * @param token The encrypted token that you want to know the asset id for
     */
  public getEncryptedMetadata(secretId: string): Observable<any> {
    let headers: HttpHeaders = new HttpHeaders({ fromKress: 'true'})

    return this._http
      .get<MetadataResponse>(this.getUrl() + "api/v1/items/resolve?encrypted_id=" + encodeURIComponent(secretId), { headers: headers })
      .map((res) => {
          if (!res.metadata[0]) {
            throw new Error('Unable to load metadata via encrypted id!')
          }
          let data: AssetDataResponse = res.metadata[0]
          let assetData: AssetData = this.mapMetadata(data)
          return assetData
      })
  }

  /**
   * Convenience Mapper
   * although this seems repetitive/wordy, it gives us insulation from server name changes because we
   * have a single place to update the naming of any property, resolve types and make changes to data shape
   * defaults which should otherwise be default values returned by the service can also be assigned here
   */
  private mapMetadata(data: any) : AssetData {
    return {
            object_id: data.object_id,
            SSID: data.SSID,
            category_id: data.category_id,
            category_name: data.category_name,
            collections: data.collections,
            collection_id: data.collection_id,
            collection_name: data.collection_name,
            collection_type: data.collection_type,
            contributinginstitutionid: data.contributinginstitutionid,
            download_size: data.downloadSize || data.download_size || '1024,1024',
            fileProperties: data.fileProperties || [],
            height: data.height,
            image_url: data.image_url,
            metadata_json: data.metadata_json,
            object_type_id: data.object_type_id,
            resolution_x: data.resolution_x,
            resolution_y: data.resolution_y,
            thumbnail_url: (this.testEnv ? '//mdxstage.artstor.org' : '//mdxdv.artstor.org') + data.thumbnail_url,
            tileSourceHostname: this.testEnv ? '//tsstage.artstor.org' : '//tsprod.artstor.org',
            title: data.title && data.title !== "" ? data.title : 'Untitled',
            updated_on: data.updated_on,
            viewer_data: data.viewer_data,
            width: data.width,
            baseUrl: this.getUrl()
          }
  } 

  /**
   * Gets the relevant Kaltura info for an asset - should only be used when necessary
   * @param assetId The artstor id for the relevant asset
   * @param objectTypeId The number corresponding to the asset's type - a map to English names can be found in the Asset class
   */
  private getFpxInfo(assetId: string): Observable<ImageFPXResponse> {
    let requestUrl = this.getUrl() + 'api/imagefpx/' + assetId + '/24'

    let headers: HttpHeaders = new HttpHeaders().set('Content-Type', 'application/json')
    return this._http
        .get<ImageFPXResponse>(requestUrl, { headers: headers, withCredentials: true })
        .map((res) => {
            // replace imageUrl with stage url if we are in rest mode
            if (this.testEnv) {
                res.imageUrl = res.imageUrl.replace('kts.artstor','kts.stage.artstor')
            }
            return res
        })
  }
}

export interface MetadataResponse {
  metadata: AssetDataResponse[]
  success: boolean
  total: 1 // the total number of items returned
}

export interface AssetData {
  groupId?: string
  SSID?: string
  category_id: string
  category_name: string
  collections: CollectionValue[]
  collection_id: string
  collection_name: string
  collection_type: number
  contributinginstitutionid: number
  download_size: string
  fileProperties: FileProperty[] // array of objects with a key/value pair
  height: number
  image_url: string
  metadata_json: MetadataField[]
  object_id: string
  object_type_id: number
  resolution_x: number
  resolution_y: number
  thumbnail_url: string
  tileSourceHostname: string
  title: string
  updated_on: string

  viewer_data?: {
      base_asset_url?: string,
      panorama_xml?: string
  }
  width: number
  baseUrl: string
  fpxInfo?: ImageFPXResponse
}

interface AssetDataResponse {
  SSID?: string
  category_id: string
  category_name: string
  collection_id: string
  collection_name: string
  collection_type: number
  contributinginstitutionid: number
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
  updated_on: string
  viewer_data: {
    base_asset_url?: string,
    panorama_xml?: string
  }
  width: number
}

export interface MetadataField {
  count: number // the number of fields with this name
  fieldName: string
  fieldValue: string
  index: number
  link?: string
}

export interface CollectionValue {
  type: string
  name: string
  id: string
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

export interface FileProperty { [key: string]: string }