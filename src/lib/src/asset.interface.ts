// import { HttpClient, HttpHeaders } from '@angular/common/http'
import { BehaviorSubject, Observable } from 'rxjs/Rx'

// import { AssetService, AuthService } from './../shared';
import { AssetData, MetadataField, FileProperty } from './asset.service'

export class Asset {
    id: string
    groupId: string
    typeId: number // determines what media type the asset is
    typeName: string // the name correlating to the typeId
    title: string
    thumbnail_url: string
    thumbnail_size: number = 3
    kalturaUrl: string
    downloadLink: string
    downloadName: string
    tileSource: string
    collectionType: number
    // Not reliably available
    categoryId: string
    categoryName: string
    collectionId: string
    collectionName: string
    SSID: string
    fileName: string

    viewportDimensions: {
        contentSize?: any,
        zoom?: number,
        containerSize?: any,
        center?: any
    } = {}

//   private dataLoadedSource = new BehaviorSubject<boolean>(false)
//   public isDataLoaded = this.dataLoadedSource.asObservable()

    public disableDownload: boolean = false

    /** Used for holding asset file properties array from the service response */
    filePropertiesArray: FileProperty[] = []
    /** Used for holding formatted asset metadata from the service response */
    formattedMetadata: FormattedMetadata = {}

    /** Used for holding media resolver info from the service response */
    viewerData?: {
        base_asset_url?: string,
        panorama_xml?: string
    }

    constructor(assetData: AssetData) {
        if (!assetData) {
            throw new Error('No data passed to construct asset')
        }
        this.initAssetProperties(assetData)
    }

    private formatMetadata(metadata: MetadataField[]): FormattedMetadata {
        let formattedData: FormattedMetadata = {}
        for (let data of metadata) {
            // this is stupid, but if there's a link then it needs to be assigned to the fieldValue
            if (data.link) {
                data.fieldValue = data.link
            }

            // if the field exists, add to it
            if (formattedData[data.fieldName]) {
                formattedData[data.fieldName].push(data.fieldValue)
            } else { // otherwise make a new field
                formattedData[data.fieldName] = [data.fieldValue]
            }
        }
        return formattedData
    }

    private buildDownloadLink(data: AssetData): string {
        let downloadLink: string
        switch (data.object_type_id) {
            case 20:
            case 21:
            case 22:
            case 23:
                // Non-image Download Link format: /media/ARTSTORID/TYPEID
                downloadLink = [data.baseUrl + 'media', this.id, data.object_type_id].join("/")
                break
            default:
                if (data.image_url) { //this is a general fallback, but should work specifically for images and video thumbnails
                    let imageServer = 'http://imgserver.artstor.net/' // TODO: check if this should be different for test
                    let url = imageServer + data.image_url + "?cell=" + data.download_size + "&rgnn=0,0,1,1&cvt=JPEG"
                    downloadLink = data.baseUrl + "api/download?imgid=" + this.id + "&url=" + encodeURIComponent(url)
                } else {
                    // nothing happens here because some assets are not allowed to be downloaded
                }
        }
        return downloadLink
    }

    /**
     * Sets the correct typeName based on a map
     * @param typeId the asset's object_type_id
     */
    private initTypeName(typeId: number): string {
        let objectTypeNames: { [key: number]: string } = {
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
        }
        return objectTypeNames[typeId]
    }

    get creator(): string {
        return (this.formattedMetadata.Creator && this.formattedMetadata.Creator[0]) || ''
    }
    get date(): string {
        return (this.formattedMetadata.Date && this.formattedMetadata.Date[0]) || ''
    }
    get description(): string {
        return (this.formattedMetadata.Description && this.formattedMetadata.Description[0]) || ''
    }

    /**
     * Sets up the Asset object with needed properties
     * - Behaves like a delayed constructor
     * - Reports status via 'this.dataLoadedSource' observable
     */
    private initAssetProperties(data: AssetData): void {
        // Set array of asset metadata fields to Asset, and format
        if (data.metadata_json) {
            this.formattedMetadata = this.formatMetadata(data.metadata_json)
        }
        this.id = data.object_id
        this.typeId = data.object_type_id
        this.title = data.title
        this.categoryId = data.category_id
        this.categoryName = data.category_name
        this.collectionId = data.collection_id
        this.collectionName = data.collection_name
        this.filePropertiesArray = data.fileProperties
        this.collectionType = data.collection_type
        // we control the default size of the thumbnail url
        this.thumbnail_url = this.replaceThumbnailSize(data.thumbnail_url, this.thumbnail_size)
        this.typeId = data.object_type_id
        this.typeName = this.initTypeName(data.object_type_id)
        this.disableDownload =  data.download_size === '0,0'
        this.SSID = data.SSID
        this.fileName = data.fileProperties.find((obj) => {
            return !!obj.fileName
        }).fileName
        // Set Download information
        let fileExt = this.fileName.substr(this.fileName.lastIndexOf('.'), this.fileName.length - 1)
        this.downloadName = this.title.replace(/\./g,'-') + '.' + fileExt
        this.downloadLink = this.buildDownloadLink(data)
        data.viewer_data && (this.viewerData = data.viewer_data)

        // Save the Tile Source for IIIF
        //  sometimes it doesn't come back with .fpx, so we need to add it
        let imgPath
        if (data.image_url.lastIndexOf('.fpx') > -1) {
            imgPath = '/' + data.image_url.substring(0, data.image_url.lastIndexOf('.fpx') + 4)
        } else {
            imgPath = '/' + data.image_url
        }
        this.tileSource = data.tileSourceHostname + '/rosa-iiif-endpoint-1.0-SNAPSHOT/fpx' + encodeURIComponent(imgPath) + '/info.json'

        // set up kaltura info if it exists
        if (data.fpxInfo) {
            this.kalturaUrl = data.fpxInfo.imageUrl
        }
    }

    /**
     * Sometimes the thumbnail url will not exist and we need to fall back to a different thumbnail size
     */
    public fallbackThumbnailUrl(): void {
        if (this.thumbnail_size > 0) {
            this.thumbnail_size --
            this.thumbnail_url = this.replaceThumbnailSize(this.thumbnail_url, this.thumbnail_size)
        }
    }

    private replaceThumbnailSize(url: string, size: number): string {
        return url.replace(/(size)[0-9]/g, 'size' + size)
    }
}

interface FormattedMetadata {
    [fieldName: string]: string[]
}