import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs/Rx'

// import { AssetService, AuthService } from './../shared';

export class Asset {
  private http: HttpClient
  private testEnv: boolean

  private header = new HttpHeaders().set('Content-Type', 'application/json');
  private defaultOptions = { headers: this.header, withCredentials: true };

  id: string;
  artstorid: string;
  groupId: string;
  /** typeId determines what media type the asset is */
  typeId: number;
  title: string;
  creator: string;
  date: string;
  imgURL: string;
  kalturaUrl: string;
  fileExt: string;
  downloadLink: string;
  downloadName: string
  tileSource: any;
  record: any;
  collectionName: string = ''
  collectionType: number
  // Not reliably available
  collectionId: number
  SSID: string
  fileName: string

  viewportDimensions: {
      contentSize?: any,
      zoom?: number,
      containerSize?: any,
      center?: any
  } = {}

  private dataLoadedSource = new BehaviorSubject<boolean>(false);
  public isDataLoaded = this.dataLoadedSource.asObservable();

  public disableDownload: boolean = false;

  /** Used for holding asset metadata array from the service response */
  metaDataArray: any = [];
  /** Used for holding asset file properties array from the service response */
  filePropertiesArray: any = [];
  /** Used for holding formatted asset metadata from the service response */
  formattedMetaArray: any = [];

  /** Used for holding media resolver info from the service response */
  viewerData?: {
    base_asset_url?: string,
    panorama_xml?: string
  }

  private objectTypeNames: any = {
      1: 'specimen',
      2: 'visual',
      3: 'use',
      6: 'publication',
      7: 'synonyms',
      8: 'people',
      9: 'repository',
      10: 'image',
      11: 'panorama',
      12: 'audio',
      13: '3d',
      21: 'powerpoint',
      22: 'document',
      23: 'excel',
      24: 'kaltura'
  };

  metadataFields = [
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
    ];

  constructor(asset_id: string, http: HttpClient, testEnv? : boolean, groupId ?: string) {
    this.id = this.artstorid = asset_id
    this.groupId = groupId
    this.testEnv = testEnv
    this.http = http
    this.loadMediaMetaData();
  }

  private getUrl(): string {
    return this.testEnv ? '//stage.artstor.org/' : '//library.artstor.org/'
  }

  /**
   * Get name for Object Type
   */
  public typeName(): string {
      return this.objectTypeNames[this.typeId];
  }

  private formatMetadata(){
    let metaArray = [];
    // loop through all of the metadata we get from the service
    for(let data of this.metaDataArray){
        let fieldExists = false;

        // if the fieldName matches, we store all the data under one object here
        for(let metaData of metaArray){
            if(metaData['fieldName'] === data.fieldName){
                metaData['fieldValue'].push(data.fieldValue);
                fieldExists = true;
                break;
            }
        }

        // if there was no match to the fieldName above, we create a field and begin collating metadata beneath it
        if(!fieldExists){
            let fieldObj = {
                'fieldName': data.fieldName,
                'fieldValue': []
            }
            // see Air-826 - sometimes the data has a link property, which can vary from fieldValue, but
            //  the institution actually wanted the fieldValue to be the same as the link... so that's what this does
            if (data.link) {
                data.fieldValue = data.link
            }

            fieldObj['fieldValue'].push(data.fieldValue);
            metaArray.push(fieldObj);
        }

    }

    this.formattedMetaArray = metaArray;
  }

  /**
   * Searches through the metaDataArray for the asset's collection name
   * @returns The name of the asset's collection or undefined
   */
  private getCollectionName(): string {
    let len = this.metaDataArray.length
    for (let i = 0; i < len; i++) {
        if (this.metaDataArray[i].fieldName == "Collection") {
            return this.metaDataArray[i].fieldValue
        }
    }
  }

  /** Set Creator and Date for the asset from the metadata Array; to be used for tombstone data on fullscreen mode */
  private setCreatorDate(): void {
      for(var i = 0; i < this.metaDataArray.length; i++){
          if(this.metaDataArray[i].fieldName == 'Creator'){
              this.creator = this.metaDataArray[i].fieldValue;
            //   document.querySelector('meta[name="DC.creator"]').setAttribute('content', this.creator);
          }
        //   else if(this.metaDataArray[i].fieldName == 'Date'){
        //       this.date = this.metaDataArray[i].fieldValue;
        //       document.querySelector('meta[name="DCTERMS.issued"]').setAttribute('content', this.date);
        //   }
        //   else if(this.metaDataArray[i].fieldName == 'Description'){
        //       document.querySelector('meta[name="DC.description"]').setAttribute('content', this.metaDataArray[i].fieldValue);
        //   }
      }
  }

  /**
   * Sets up the Asset object with needed properties
   * - Behaves like a delayed constructor
   * - Reports status via 'this.dataLoadedSource' observable
   */
  private setAssetProperties(data: any): void {
    // Make sure we've received data that we expect from /metadata
    if (!data || !data.metadata || !data.metadata[0]) {
        // We can assume the user was unauthorized if no metadata came back but an error wasn't thrown
        this.dataLoadedSource.error({'message':'Unable to load metadata.', 'status':403 })
        return
    } else {
        data = data.metadata[0]
    }
    // Set array of asset metadata fields to Asset, and format
    if (data['metadata_json']) {
        this.metaDataArray =  data['metadata_json']
        this.formatMetadata();
    }
    // Set Title
    // - Optional: We can come through the metadata array to find the title: let title = this.metaDataArray.find(elem => elem.fieldName.match(/^\s*Title/))
    this.title = data.title && data.title !== "" ? data.title : 'Untitled'
    // Set Creator, Date, and Description
    this.setCreatorDate();
    // Set File Properties to Asset
    this.filePropertiesArray = data.fileProperties || [];
    // Set media data to Asset
    this.imgURL = data['thumbnail_url']
    this.typeId = data['object_type_id']
    // Set Collection Name
    this.collectionName = this.getCollectionName()
    // Set Download information
    this.downloadName = this.title.replace(/\./g,'-') + '.' + this.fileExt
    let downloadSize = data.downloadSize || data.download_size || '1024,1024'
    this.disableDownload =  downloadSize === '0,0'
    // set SSID and fileName
    this.SSID = data.SSID
    if (data.fileProperties) {
        this.fileName = data.fileProperties.find((obj) => {
            return !!obj.fileName
        }).fileName
    }
    // Set Object Type ID
    this.typeId = data.object_type_id || data.objectTypeId;
    // Build Download Link
    // - Download link is differs based on typeIds
    let imageServer = data.imageServer || 'http://imgserver.artstor.net/'
    if (this.typeId === 20 || this.typeId === 21 || this.typeId === 22 || this.typeId === 23) { //all of the typeIds for documents
        this.downloadLink = [this.getUrl() + 'media', this.id, this.typeId].join("/");
    } else if (imageServer && data.image_url) { //this is a general fallback, but should work specifically for images and video thumbnails
        let url = imageServer + data.image_url + "?cell=" + downloadSize + "&rgnn=0,0,1,1&cvt=JPEG";
        this.downloadLink = this.getUrl() + "api/download?imgid=" + this.id + "&url=" + encodeURIComponent(url);
    }

    // Set the media resolver info for panorama assets
    if( data.viewer_data ){
        this.viewerData = data.viewer_data
    }

    // Save the Tile Source for IIIF
    let imgPath
    if (data && data.metadata && data.metadata[0] && data.metadata[0]['image_url']) {
        imgPath = '/' + data.metadata[0]['image_url']
    } else {
        imgPath = '/' + data['image_url'].substring(0, data['image_url'].lastIndexOf('.fpx') + 4)
    }
    this.tileSource = (this.testEnv ? '//tsstage.artstor.org' : '//tsprod.artstor.org') + '/rosa-iiif-endpoint-1.0-SNAPSHOT/fpx' + encodeURIComponent(imgPath) + '/info.json'

    // If Kaltura, we need more information!
    if (this.typeName() == 'kaltura') {
        this.getFpxInfo(this.id, 24)
            .then(data => {
                this.kalturaUrl = data['imageUrl'];
                if (this.testEnv) {
                    this.kalturaUrl = this.kalturaUrl.replace('kts.artstor','kts.stage.artstor')
                }
                this.dataLoadedSource.next(true);
            })
            .catch(err => {
                console.log(err);
            });
    } else {
        this.dataLoadedSource.next(true);
    }
  }

  /**
   * Pulls additional media metadata
   * - Constructs a download link
   * - Constructs the IIIF tile source URL
   * - Finds the asset Type id
  */
  private loadMediaMetaData(): void {
      this.getMetadata( this.id, this.groupId )
        .subscribe((data) => {
            this.setAssetProperties(data)
        }, (err) => {
            // If it's an access denied error, throw that to the subscribers
            this.dataLoadedSource.error( err )
        });
  }

   public getMetadata(assetId: string, groupId?: string): Observable<any> {
      let url = this.getUrl() + 'api/v1/metadata?object_ids=' + assetId
      if (groupId){
          // Groups service modifies certain access rights for shared assets
          url = this.getUrl() + 'api/v1/group/'+ groupId +'/metadata?object_ids=' + assetId
      }
      return this.http
          .get( url, this.defaultOptions)
  }

  public getFpxInfo(objectId: string, objectTypeId: number): Promise<any> {
        let requestUrl = this.getUrl() + 'api/imagefpx/' + objectId + '/' + objectTypeId;

        return this.http
            .get(requestUrl, this.defaultOptions)
            .toPromise()
  }
}
