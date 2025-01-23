export type LatestFinalizedBlock = {
  finalizationEpoch: number
  finalizationPoint: number
  height: string
  hash: string
}

export type ChainInfo = {
  scoreHigh: string
  scoreLow: string
  height: string
  latestFinalizedBlock: LatestFinalizedBlock
}
