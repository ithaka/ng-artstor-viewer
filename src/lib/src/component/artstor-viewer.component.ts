import { AfterViewInit, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subscription } from 'rxjs/Subscription'
import { HttpClient } from '@angular/common/http'

import * as OpenSeadragon from 'openseadragon';
import '../viewers/krpano.js';
// Internal Dependencies
import { Asset } from "../asset.interface"

// Browser API delcarations
declare var ActiveXObject: any
declare var embedpano: any

enum viewState {
  loading, // 0
  openSeaReady, // 1
  kalturaReady, // 2 
  krpanoReady, // 3
  thumbnailFallback // 4
}

@Component({
  selector: 'artstor-viewer',
  providers: [],
  templateUrl: './artstor-viewer.component.html',
  styleUrls: ['./artstor-viewer.component.css']
})
export class ArtstorViewer implements OnInit, OnDestroy, AfterViewInit {

    // Required Input
    private _assetId: string = ''
    @Input() set assetId(value: string) {
        if (value != this._assetId) {
            this._assetId = value
            this.loadAssetById()
        }
    }
    get assetId(): string {
        // other logic
        return this._assetId
    }

    // Optional Inputs
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

    // Optional Outputs
    @Output() fullscreenChange = new EventEmitter()
    @Output() nextPage = new EventEmitter()
    @Output() prevPage = new EventEmitter()
    @Output() removeAsset = new EventEmitter()
    @Output() assetDrawer = new EventEmitter()
    // Emits fully formed asset object
    @Output() assetMetadata = new EventEmitter()

    private asset: Asset
    private assetSub: Subscription
    private state: viewState = viewState.loading
    private removableAsset: boolean = false
    private subscriptions: Subscription[] = []
    // private fallbackFailed: boolean = false
    private tileSource: string
    private lastZoomValue: number
    // Thumbanil Size is decremented if load fails (see thumbnailError)
    private thumbnailSize: number = 2
    // private showCaption: boolean = true

    private kalturaUrl: string
    private osdViewer: any

    constructor(
        private _http: HttpClient
    ) { 
        if(!this.index) {
            this.index = 0
        }
    }

    ngOnInit() {
        this.loadAssetById()
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

    private getUrl(): string {
        return this.testEnv ? '//stage.artstor.org/' : '//library.artstor.org/'
    }

    private loadAssetById(): void {
        // Destroy previous viewers
        if (this.osdViewer) {
            this.osdViewer.destroy()
        }
        // Set viewer to "loading"
        this.state = viewState.loading
        // Construct new/replacement asset
        this.asset = new Asset(this.assetId, this._http, this.testEnv)
        
        if (this.assetSub) {
            this.assetSub.unsubscribe()
        }

        this.assetSub = this.asset.isDataLoaded.subscribe(
            loaded => {
                if (loaded) {
                    this.assetMetadata.emit(this.asset)
                    this.loadViewer()
                }
            },
            error => {
                this.assetMetadata.emit({error: error})
            })
    }

    private loadViewer(): void {
        // Object types that need loaders
        switch (this.asset.typeName()) {
            default:
                // Display thumbnail
                this.state = viewState.thumbnailFallback
            case 'image':
                // Image, try IIF
                this.loadIIIF();
                break;
            case 'audio':
                // Kaltura media
                this.loadKaltura();
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
        console.log("LOAD IIIF")
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
        // Set state to IIIF/OpenSeaDragon
        this.state = viewState.openSeaReady
        // OpenSeaDragon Initializer
        let id =  this.asset.id + '-' + this.index;
        this.osdViewer = new OpenSeadragon({
            id: 'osd-' + id,
            // prefix for Icon Images
            prefixUrl: this.getUrl() + 'assets/img/osd/',
            tileSources: this.tileSource,
            gestureSettingsMouse: {
                scrollToZoom: true,
                pinchToZoom: true
            },
            controlsFadeLength: 500,
            //   debugMode: true,
            zoomInButton: 'zoomIn-' + id,
            zoomOutButton: 'zoomOut-' + id,
            homeButton: 'zoomFit-' + id,
            sequenceMode: true,
            initialPage: 0,
            nextButton: 'nextButton',
            showNavigator: true,
            navigatorPosition: 'BOTTOM_LEFT',
            navigatorSizeRatio: 0.15
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
            console.log("Test load Pano metadata")
            // Check if pano xml is available before loading pano
            this._http.get(this.asset.viewerData.panorama_xml)
                .take(1)
                .subscribe(
                    data => {
                       this.embedKrpano()
                    },
                    error => {
                        // // We don't care about parsing, just network access
                        // if (error && error.status == 200) {
                        //     this.embedKrpano()
                        // } else {
                            console.warn("Pano XML was not accessible", error)
                            // Pano xml is not accessible, fallback to image
                            this.loadIIIF()
                        // }
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
        }
    };

    /**
     * Generate Thumbnail URL
     */
    public makeThumbUrl(imagePath: string, size ?: number): string {
        if (imagePath) {
            if (size) {
                imagePath = imagePath.replace(/(size)[0-4]/g, 'size' + size);
            }
            // Ensure relative
            if (imagePath.indexOf('artstor.org') > -1) {
                imagePath = imagePath.substring(imagePath.indexOf('artstor.org') + 12);
            }

            if (imagePath[0] != '/') {
                imagePath = '/' + imagePath;
            }

            if (imagePath.indexOf('thumb') < 0) {
                imagePath = '/thumb' + imagePath;
            }
        } else {
            imagePath = '';
        }

        // Ceanup
        return (this.testEnv ? '//mdxstage.artstor.org' : '//mdxdv.artstor.org') + imagePath;
    }

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

    /**
     * When thumbnail fails to load, try to load a different size
     * - Decrements the thumbnail size
     * - Workaround for missing sizes of particular thumbnails
     */
    private thumbnailError(event: Event) : void {
        this.thumbnailSize--
    }

}

