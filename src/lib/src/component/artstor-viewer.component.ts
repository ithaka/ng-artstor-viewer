import { AfterViewInit, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subscription } from 'rxjs/Subscription'
import { HttpClient, HttpHeaders } from '@angular/common/http'

import * as OpenSeadragon from 'openseadragon';
import '../viewers/krpano.js';
// Internal Dependencies
import { Asset } from "../asset.interface"
import { AssetService } from '../asset.service'

// Browser API delcarations
declare var ActiveXObject: any
declare var embedpano: any

enum viewState {
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
  styleUrls: ['./artstor-viewer.component.css']
})
export class ArtstorViewer implements OnInit, OnDestroy, AfterViewInit {

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
        this._assetService.testEnv = this.testEnv // keep test environment set here
        this._assetService.encrypted = this.encrypted
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

    // Optional Outputs
    @Output() fullscreenChange = new EventEmitter()
    @Output() nextPage = new EventEmitter()
    @Output() prevPage = new EventEmitter()
    @Output() removeAsset = new EventEmitter()
    @Output() assetDrawer = new EventEmitter()
    // Emits fully formed asset object
    @Output() assetMetadata = new EventEmitter()

    private initialized: boolean = false
    private _asset: Asset
    private assetSub: Subscription
    private state: viewState = viewState.loading
    private removableAsset: boolean = false
    private subscriptions: Subscription[] = []
    // private fallbackFailed: boolean = false
    private tileSource: string | string[]
    private lastZoomValue: number
    // private showCaption: boolean = true

    private kalturaUrl: string
    private osdViewer: any
    private osdViewerId: string

    constructor(
        private _http: HttpClient, // TODO: move _http into a service
        private _assetService: AssetService
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
        
        this._assetService.buildAsset(assetId, {groupId, legacyFlag: this.legacyFlag})
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
        let isMultiView: boolean = Array.isArray(this.tileSource)
        // Set state to IIIF/OpenSeaDragon
        this.state = viewState.openSeaReady
        // OpenSeaDragon Initializer
        this.osdViewer = new OpenSeadragon({
            id: this.osdViewerId,
            // defaultZoomLevel: 1.2, // We don't want the image to be covered on load
            // visibilityRatio: 0.2, // Determines percentage of background that has to be covered by the image while panning 
            // prefix for Icon Images
            prefixUrl: this._assetService.getUrl() + 'assets/img/osd/',
            tileSources: this.tileSource,
            // Trigger conditionally if tilesource is an array of multiple sources
            sequenceMode: isMultiView,
            showReferenceStrip: isMultiView,
            referenceStripScroll: 'horizontal',
            autoHideControls: false,
            gestureSettingsMouse: {
                scrollToZoom: true,
                pinchToZoom: true
            },
            controlsFadeLength: 500,
            //   debugMode: true,
            zoomInButton: 'zoomIn-' + this.osdViewerId,
            zoomOutButton: 'zoomOut-' + this.osdViewerId,
            homeButton: 'zoomFit-' + this.osdViewerId,
            previousButton: 'previousButton-' + this.osdViewerId,
            nextButton: 'nextButton-' + this.osdViewerId,
            initialPage: 1,
            showNavigator: true,
            navigatorPosition: 'BOTTOM_LEFT',
            navigatorSizeRatio: 0.15,
            // viewportMargins: {
            //     bottom: 100
            // },
            timeout: 60000,
            useCanvas: false
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

        this.osdViewer.addHandler('zoom', (value: any) => {
            this.lastZoomValue = value.zoom;

            // Save viewport values for downloading the view
            this.asset.viewportDimensions.containerSize = this.osdViewer.viewport.containerSize
            this.asset.viewportDimensions.contentSize = this.osdViewer.viewport._contentSize
            this.asset.viewportDimensions.zoom = value.zoom
        });

        this.osdViewer.addOnceHandler('tile-load-failed', (e: Event) => {
            console.warn("OSD Loading tiles failed:", e)
            this.state = viewState.thumbnailFallback
            this.osdViewer.destroy();
        });

        this.osdViewer.addOnceHandler('ready', () => {
            console.info("Tiles are ready");
            this.state = viewState.openSeaReady
        });

        // this.osdViewer.addHangler('open', (event) => {
        //     var img = this.osdViewer.drawer.canvas.toDataURL("image/png");
        //     console.log(img)
        //     var downloadlink = document.getElementById("downloadViewViaAssetViewer");
        //     downloadlink['href'] = img;
        // })

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

            // Check if pano xml is available before loading pano
            this._http.get(this.asset.viewerData.panorama_xml, { headers: headers })
                .take(1)
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
    private disableContextMenu(event: Event): boolean{
        return false;
    }
}

