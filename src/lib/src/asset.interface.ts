export interface Asset {
  id: string
  artstorid: string
  groupId: string
  /** typeId determines what media type the asset is */
  typeId: number
  title: string
  creator: string
  date: string
  imgURL: string
  fileExt: string
  downloadLink: string
  downloadName: string
  tileSource: any
  record: any
  collectionName: string
  collectionType: number
  collectionId: number
  SSID: string
  fileName: string
  viewportDimensions: {
      contentSize?: any,
      zoom?: number,
      containerSize?: any,
      center?: any
  }
  // Functions
  typeName: Function
}
