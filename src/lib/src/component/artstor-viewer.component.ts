import { AfterViewInit, Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { Subscription, Observable, of } from 'rxjs'
import { take, map, mergeMap } from 'rxjs/operators'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import * as OpenSeadragon from 'openseadragon'

// Internal Dependencies
import '../viewers/krpano.js'
import { Asset } from "../asset.interface"
// import { AssetService, ImageFPXResponse } from '../asset.service'

// Browser API delcarations
declare var ActiveXObject: any
declare var embedpano: any

export enum viewState {
  loading, // 0
  openSeaReady, // 1
  kalturaReady, // 2 
  krpanoReady, // 3
  thumbnailFallback, // 4
  audioFallback //5
}

@Component({
  selector: 'artstor-viewer',
  templateUrl: './artstor-viewer.component.html',
  styleUrls: ['./artstor-viewer.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class ArtstorViewer implements OnInit, OnDestroy, AfterViewInit {

    // public testEnv: boolean = false
    // public encrypted: boolean = false

    // Optional Inputs
    @Input() groupId: string
    @Input() index: number
    @Input() assetCompareCount: number
    @Input() assetGroupCount: number
    @Input() assetNumber: number
    @Input() assets: Asset[]
    @Input() prevAssetResults: any
    @Input() isFullscreen: boolean
    @Input() showCaption: boolean
    @Input() quizMode: boolean
    @Input() testEnv: boolean
    @Input() thumbnailMode: boolean
    @Input() encrypted: boolean

    // Required Input
    private _assetId: string = ''
    @Input() set assetId(value: string) {
        // this.testEnv = this.testEnv // keep test environment set here
        // this.encrypted = this.encrypted
        if (value && value != this._assetId) {
            this._assetId = value
            if(this.initialized) {
                this.loadAssetById(this.assetId, this.groupId)
            }
        }
    }
    get assetId(): string {
        // other logic
        return this._assetId
    }
    get asset(): Asset {
        if (this._asset) {
            return this._asset
        } else {
            // this super weird bad-feeling thing is because, for some reason, the template
            //  *ngIf="asset" always thought asset was undefined, and if we left it off we'd
            //  get errors saying "cannot read property 'id' of undefined"
            //  so this is a simple getter/setter combo which will initially provide an empty
            //  object, but an empty object should not be assignable here at any point in the future
            //  because this coercive casting is a bad pattern
            return <Asset>{}
        }
    }
    set asset(asset: Asset) {
        this._asset = asset
    }
    // Optional Inputs
    @Input() legacyFlag: boolean
    @Input() openLibraryFlag: boolean

    // Optional Outputs
    @Output() fullscreenChange = new EventEmitter()
    @Output() nextPage = new EventEmitter()
    @Output() prevPage = new EventEmitter()
    @Output() removeAsset = new EventEmitter()
    @Output() assetDrawer = new EventEmitter()
    @Output() multiViewHelp = new EventEmitter()
    // Emits fully formed asset object
    @Output() assetMetadata = new EventEmitter()

    @Output() multiViewPageViaArrow = new EventEmitter()
    @Output() multiViewPageViaThumbnail = new EventEmitter()

    // Flag to differentiate the page event between arrow pressed and thumbnail click
    private multiViewArrowPressed: boolean = false

    private initialized: boolean = false
    private _asset: Asset
    private assetSub: Subscription
    public state: viewState = viewState.loading
    private removableAsset: boolean = false
    private subscriptions: Subscription[] = []
    // private fallbackFailed: boolean = false
    private tileSource: string | string[]
    public lastZoomValue: number
    // private showCaption: boolean = true

    public kalturaUrl: string
    public osdViewer: any
    public osdViewerId: string
    public isMultiView: boolean
    public multiViewPage: number = 1
    public multiViewCount: number = 1

    constructor(
        private _http: HttpClient // TODO: move _http into a service
        // private: AssetService
    ) { 
        if(!this.index) {
            this.index = 0
        }
    }

    ngOnInit() {
        // Ensure component is initialized, and all inputs available, before first load of asset
        this.initialized = true
        this.loadAssetById(this.assetId, this.groupId)
        // Assets don't initialize with fullscreen variable
        // And assets beyond the first/primary only show in fullscreen
        if (this.index > 0) {
            this.isFullscreen = true;
        }

        // Events for fullscreen/Presentation mode
        document.addEventListener('fullscreenchange', () => {
            this.changeHandler();
        }, false);

        document.addEventListener('mozfullscreenchange', () => {
            this.changeHandler();
        }, false);

        document.addEventListener('webkitfullscreenchange', () => {
            this.changeHandler();
        }, false);
    }

    ngOnDestroy() {
        this.subscriptions.forEach((sub) => {
            sub.unsubscribe();
        });
    }

    ngAfterViewInit() {
    }

    private loadAssetById(assetId: string, groupId: string): void {
        // Destroy previous viewers
        if (this.osdViewer) {
            this.osdViewer.destroy()
        }
        // change id for new viewer
        this.osdViewerId = 'osd-' + assetId + '-' + this.index
        // Set viewer to "loading"
        this.state = viewState.loading
        
        this.buildAsset(assetId, {groupId, legacyFlag: this.legacyFlag, openLib: this.openLibraryFlag })
            .subscribe((asset) => {
                // Replace <br/> tags from title, creator & date values with a space
                asset.title = asset.title.replace(/<br\s*[\/]?>/gi, ' ')
                if(asset.formattedMetadata && asset.formattedMetadata['Creator'] && asset.formattedMetadata['Creator'][0]){
                    asset.formattedMetadata['Creator'][0] = asset.formattedMetadata['Creator'][0].replace(/<br\s*[\/]?>/gi, ' ')
                }
                if(asset.formattedMetadata && asset.formattedMetadata['Date'] && asset.formattedMetadata['Date'][0]){
                    asset.formattedMetadata['Date'][0] = asset.formattedMetadata['Date'][0].replace(/<br\s*[\/]?>/gi, ' ')
                }

                this.asset = asset
                this.assetMetadata.emit(asset)
                this.loadViewer(asset)
            }, (err) => {
                this.assetMetadata.emit({ error: err })
            })
    }

    private loadViewer(asset: Asset): void {
        // Reset options
        this.isMultiView = false
        // Display thumbnail
        this.state = viewState.thumbnailFallback
        if (this.thumbnailMode) { return } // leave state on thumbnail if thumbnail mode is triggered

        // Object types that need loaders
        switch (asset.typeName) {
            case 'image':
                // Image, try IIF
                this.loadIIIF();
                break;
            case 'audio':
                // Kaltura media
                this.loadKaltura();
                // this.state = viewState.audioFallback
                break;
            case 'kaltura':
                // Kaltura media
                this.loadKaltura();
                break;
            case 'panorama':
                this.loadKrpanoViewer();
                break;
        }
    }


    /**
     * Gets information needed to load IIIF viewers, such as OpenSeaDragon
     */
    private loadIIIF(): void {
        if (this.asset.tileSource) {
            this.tileSource = this.asset.tileSource
            this.loadOpenSea()
        } else {
            this.state = viewState.thumbnailFallback
        }
    }

    /**
     * Loads the OpenSeaDragon on element at 'viewer-' + id
     * - Requires this.asset to have an id
     */
    private loadOpenSea(): void {
        this.isMultiView = Array.isArray(this.tileSource)
        this.multiViewPage = 1
        this.multiViewCount = this.tileSource.length
        // Set state to IIIF/OpenSeaDragon
        this.state = viewState.openSeaReady
        // OpenSeaDragon Initializer
        this.osdViewer = new OpenSeadragon({
            id: this.osdViewerId,
            // prefix for Icon Images
            prefixUrl: this.getUrl() + 'assets/img/osd/',
            tileSources: this.tileSource,
            // Trigger conditionally if tilesource is an array of multiple sources
            sequenceMode: this.isMultiView,
            // OpenSeaDragon bug workaround: Reference strip will not load on init
            showReferenceStrip: false,
            referenceStripScroll: 'horizontal',
            autoHideControls: false,
            gestureSettingsMouse: {
                scrollToZoom: true,
                pinchToZoom: true
            },
            controlsFadeLength: 500,
            zoomInButton: 'zoomIn-' + this.osdViewerId,
            zoomOutButton: 'zoomOut-' + this.osdViewerId,
            homeButton: 'zoomFit-' + this.osdViewerId,
            previousButton: 'previousButton-' + this.osdViewerId,
            nextButton: 'nextButton-' + this.osdViewerId,
            initialPage: 0,
            showNavigator: true,
            navigatorPosition: 'BOTTOM_LEFT',
            navigatorSizeRatio: 0.15,
            viewportMargins: {
                // Center the image when reference strip shows
                bottom: this.isMultiView ? 190 : 0
            },
            timeout: 60000,
            // useCanvas: false,
            // defaultZoomLevel: 1.2, // We don't want the image to be covered on load
            // visibilityRatio: 0.2, // Determines percentage of background that has to be covered by the image while panning 
            // debugMode: true,
        });

        // ---- Use handler in case other error crops up
        this.osdViewer.addOnceHandler('open-failed', (e: Event) => {
            console.error("OSD Opening source failed:",e)
            this.state = viewState.thumbnailFallback
            this.osdViewer.destroy();
        });

        this.osdViewer.addHandler('pan', (value: any) => {
            // Save viewport pan for downloading the view
            this.asset.viewportDimensions.center = value.center
        });

        this.osdViewer.addHandler('page', (value: {page: number, eventSource: any, userData?: any}) => {
            let index = value.page
            // Set current view "page" number
            this.multiViewPage = index + 1

            if(this.multiViewArrowPressed){
                this.multiViewArrowPressed = false
                this.multiViewPageViaArrow.emit()
            } else {
                this.multiViewPageViaThumbnail.emit()
            }
        })

        this.osdViewer.addHandler('zoom', (value: any) => {
            this.lastZoomValue = value.zoom;

            // Save viewport values for downloading the view
            this.asset.viewportDimensions.containerSize = this.osdViewer.viewport.containerSize
            this.asset.viewportDimensions.contentSize = this.osdViewer.viewport._contentSize
            this.asset.viewportDimensions.zoom = value.zoom
        })

        this.osdViewer.addOnceHandler('tile-load-failed', (e: Event) => {
            console.warn("OSD Loading tiles failed:", e)
            this.state = viewState.thumbnailFallback
            this.osdViewer.destroy();
        })

        this.osdViewer.addOnceHandler('ready', () => {
            console.info("Tiles are ready");
            this.state = viewState.openSeaReady
        })

        this.osdViewer.addOnceHandler('tile-loaded', () => {
            console.info("Tiles are loaded")
            this.state = viewState.openSeaReady
            // Load Reference Strip once viewer is ready
            if (this.isMultiView) {
                this.osdViewer.addReferenceStrip()
                
                this.osdViewer.nextButton.element.title = 'Next Item'
                this.osdViewer.previousButton.element.title = 'Previous Item'

                this.osdViewer.previousButton.addHandler('press', () => {
                    this.multiViewArrowPressed = true
                })
                this.osdViewer.nextButton.addHandler('press', () => {
                    this.multiViewArrowPressed = true
                })
            }
        })

        if (this.osdViewer && this.osdViewer.ButtonGroup) {
            this.osdViewer.ButtonGroup.element.addClass('button-group');
        }
        this.osdViewer.navigator.element.style.marginBottom = "50px";
    }

    private loadKrpanoViewer(): void{
        if( this.asset.viewerData && this.asset.viewerData.panorama_xml ){
            let headers = new HttpHeaders({ 'Content-Type': 'text/xml' }).set('Accept', 'text/xml');

            // Format pano_xml url incase it comes badly formatted from backend 
            this.asset.viewerData.panorama_xml = this.asset.viewerData.panorama_xml.replace('stor//', 'stor/')
            // Ensure URL uses relative protocol
            this.asset.viewerData.panorama_xml = this.asset.viewerData.panorama_xml.replace('http://', '//')

            // Check if pano xml is available before loading pano
            this._http.get(this.asset.viewerData.panorama_xml, { headers: headers })
                .pipe(take(1))
                .subscribe(
                    data => {
                       this.embedKrpano()
                    },
                    error => {
                        // // We don't care about parsing, just network access
                        if (error && error.status == 200) {
                            this.embedKrpano()
                        } else {
                            console.warn("Pano XML was not accessible", error)
                            // Pano xml is not accessible, fallback to image
                            this.loadIIIF()
                        }
                    }
                )
        }
        else{ // If the media resolver info is not available then fallback to image viewer
            this.loadIIIF()
        }
    }

    private embedKrpano() : void {
         // Run if Pano xml is accessible
        this.state = viewState.krpanoReady
        embedpano({ 
            html5: "always",
            localfallback: "error",
            xml: this.asset.viewerData.panorama_xml,  
            target: "pano-" + this.index, 
            onready: (viewer) => {
                console.log("KR Pano has loaded", viewer)
                // See if there was an unreported error during final load
                setTimeout(() => {
                    let content = viewer.innerHTML ? viewer.innerHTML : ''
                    // Workaround for detecting load failure
                    if (content.search('FATAL ERROR') >= 0 && content.search('loading failed') >= 0) {
                        this.state = viewState.thumbnailFallback
                    }
                }, 1000)
            },
            onerror: (err) => {
                // This handler does not fire for "Fatal Error" when loading XML
                console.log(err)
                this.state = viewState.thumbnailFallback
            },
        })
    }

    private requestFullScreen(el: any): void {
        // Supports most browsers and their versions.
        var requestMethod = el.requestFullScreen || el.webkitRequestFullScreen || el.mozRequestFullScreen || el.msRequestFullScreen;

        if (requestMethod) { // Native full screen.
            requestMethod.call(el);
        } else if (window['ActiveXObject'] && typeof window['ActiveXObject'] !== "undefined") { // Older IE.
            var wscript = new ActiveXObject("WScript.Shell");
            if (wscript !== null) {
                wscript.SendKeys("{F11}");
            }
        }
    }

    private exitFullScreen(): void {
        // Being permissive to reference possible Document methods
        let document: any = window.document;
        if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }

    private changeHandler() {
        if (document['webkitIsFullScreen'] || document['mozFullScreen'] || document['fullscreen']) {
            this.setFullscreen(true);
        } else {
            this.assets.splice(1);
            for(let i = 0; i < this.prevAssetResults.thumbnails.length; i++){
                this.prevAssetResults.thumbnails[i].selected = false;
            }

            this.setFullscreen(false);
        }
    }

    public togglePresentationMode(): void {
        // Make the body go full screen.
        var elem = document.body;

        if (!this.isFullscreen) {
            this.requestFullScreen(elem);
            this.setFullscreen(true);
        } else {
            this.exitFullScreen();
            this.setFullscreen(false);
        }
    };

    /**
     * Setter for isFullscreen
     * - Ensures event is sent out to the Asset Page!
     */
    private setFullscreen(isFullscreen: boolean): void {
        this.isFullscreen = isFullscreen;
        this.fullscreenChange.emit(isFullscreen);
    }

    /**
     * Setup the embedded Kaltura player
     */
    private loadKaltura(): void {
        console.log("Load Kaltura")
        let targetId = 'kalturaIframe-' + this.index;
        if (this.asset.kalturaUrl) {
            document.getElementById(targetId).setAttribute('src', this.asset.kalturaUrl);
            this.state = viewState.kalturaReady
        } else {
            this.state = viewState.thumbnailFallback
        }
    };

    // Keep: We will want to dynamically load the Kaltura player
    // private getAndLoadKalturaId(data): void {
        // let kalturaId: string;
        // let targetId = 'video-' + this.asset.id + '-' + this.index;

        //  if (data['imageUrl']) {
        //         kalturaId = data['imageUrl'].substr(data['imageUrl'].lastIndexOf(':') + 1, data['imageUrl'].length - 1);
        //     }

        //     if (kalturaId && kalturaId.length > 0) {
        //         this.isKalturaAsset = true;
                // this.isOpenSeaDragonAsset = false;

        //         kWidget.embed({
        //             'targetId': targetId,
        //             'wid': '_101',
        //             'uiconf_id': '23448189',
        //             'entry_id': kalturaId,
        //             'flashvars': {
        //                 // We provide our own fullscreen interface
        //                 'fullScreenBtn.plugin': false
        //             },
        //             'readyCallback': function(playerId) {
        //                 var kdp: any = document.getElementById(playerId);
        //                 kdp.kBind('mediaError', function() {
        //                     console.error('Media error!');
        //                     this.mediaLoadingFailed = true;
        //                 });
        //             }
        //         });
        //         let kPlayer = document.getElementById(targetId);
        //     }
    // };

    /**
     * disableContextMenu
     * - Disable browser context menu / right click on the image viewer
     */
    public disableContextMenu(event: Event): boolean{
        return false;
    }

    /**
     * Is Multi View help output defined
     */
    public hasMultiViewHelp(): boolean {
        return this.multiViewHelp.observers.length > 0
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
          "ngrok.io",
          "ang-ui.apps.prod.cirrostratus.org",
          "ang-ui.apps.test.cirrostratus.org",
          "www.jstor.org"
        ]
        // If it's a non-relative domain, use an explicit domain for api calls
        let stageSubdomain = window.location.protocol === 'http:' ? 'stagely' : 'stage'
        let useDomain: boolean = new RegExp(nonRelativeDomains.join("|")).test(document.location.hostname)
        if (useDomain) {
          return this.testEnv ? '//'+stageSubdomain+'.artstor.org/' : '//library.artstor.org/'
        } else {
          return '/'
        }
      }
    
      public buildAsset(assetId: string, { groupId = '', legacyFlag = true, openLib = false }={}): Observable<Asset> {
        let metadataObservable
        if (this.encrypted) {
          metadataObservable = this.getEncryptedMetadata(assetId, legacyFlag, openLib)
        } else {
          metadataObservable = this.getMetadata(assetId, { groupId, legacyFlag })
        }
        return metadataObservable.pipe(mergeMap((assetData: AssetData) => {
    
            // do we need to make an imageFpx call to get kaltura data??
            switch (assetData.object_type_id) {
              case 12:
              case 24:
                return this.getFpxInfo(assetData.object_id)
                  .pipe(map((res) => {
                    assetData.fpxInfo = res
                    return assetData
                  }))
              default: 
                return of(assetData)
            }
          }),map((assetData: AssetData) => {
            console.log("data",assetData)
            return new Asset(assetData, this.testEnv)
          }))
      }
    
      /**
       * Gets the metadata for an asset and cleans it into an object with which an Asset can be constructed
       * @param assetId The id of the asset for which to obtain the metadata
       * @param groupId The group from which the asset was accessed, if it exists (helps with authorization)
       */
      private getMetadata(assetId: string, { groupId, legacyFlag }): Observable<AssetData> {
        let url = this.getUrl() + 'api/v1/metadata?object_ids=' + assetId + '&legacy=' + legacyFlag 
        if (groupId){
            // Groups service modifies certain access rights for shared assets
            url = this.getUrl() + 'api/v1/group/'+ groupId +'/metadata?object_ids=' + encodeURIComponent(assetId) + '&legacy=' + legacyFlag 
        }
        let headers: HttpHeaders = new HttpHeaders().set('Content-Type', 'application/json')
        return this._http
            .get<MetadataResponse>( url, { headers: headers, withCredentials: true })
            .pipe(map((res) => {
              if (!res.metadata[0]) {
                throw new Error('Unable to load metadata!')
              }
              let data: AssetDataResponse = res.metadata[0]
              let assetData: AssetData = this.mapMetadata(data)
              if (groupId) {
                assetData.groupId = groupId
              }
              return assetData
            }))
      }
    
      /**
         * Call to API which returns an asset, given an encrypted_id
         * @param token The encrypted token that you want to know the asset id for
         */
      public getEncryptedMetadata(secretId: string, legacyFlag?: boolean, openLib?: boolean): Observable<any> {
        let headers: HttpHeaders = new HttpHeaders({ fromKress: 'true'})
        let referrer: string = document.referrer
        let url: string = this.getUrl() + "api/v2/items/resolve?encrypted_id=" + encodeURIComponent(secretId) + "&ref=" + encodeURIComponent(referrer) + '&legacy=' + legacyFlag 

        if (openLib) {
            url += '&openLib=' + openLib
        }
    
        return this._http
          .get<MetadataResponse>(url, { headers: headers })
          .pipe(map((res) => {
              if (!res.metadata[0]) {
                throw new Error('Unable to load metadata via encrypted id!')
              }
              let data: AssetDataResponse = res.metadata[0]
              let assetData: AssetData = this.mapMetadata(data)
              return assetData
          }))
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
                personalCollectionOwner: data.personalCollectionOwner,
                download_size: data.downloadSize || data.download_size || '1024,1024',
                fileProperties: data.fileProperties || [],
                height: data.height,
                image_url: data.image_url,
                image_compound_urls: data.image_compound_urls,
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
            .pipe(map((res) => {
                // replace imageUrl with stage url if we are in rest mode
                if (this.testEnv) {
                    res.imageUrl = res.imageUrl.replace('kts.artstor','kts.stage.artstor')
                }
                return res
            }))
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
    personalCollectionOwner: number
    download_size: string
    fileProperties: FileProperty[] // array of objects with a key/value pair
    height: number
    image_url: string
    image_compound_urls?: string[],
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
  
  export interface AssetDataResponse {
    SSID?: string
    category_id: string
    category_name: string
    collection_id: string
    collection_name: string
    collection_type: number
    contributinginstitutionid: number
    personalCollectionOwner: number
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