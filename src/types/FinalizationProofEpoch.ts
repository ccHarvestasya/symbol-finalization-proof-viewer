export type MessageGroupSignaturePublicKey = {
  parentPublicKey: string
  signature: string
}

export type MessageGroupSignature = {
  root: MessageGroupSignaturePublicKey
  bottom: MessageGroupSignaturePublicKey
}

export type MessageGroup = {
  stage: number
  height: string
  hashes: string[]
  signatures: MessageGroupSignature[]
}

export type FinalizationProofEpoch = {
  version: number
  finalizationEpoch: number
  finalizationPoint: number
  height: string
  hash: string
  messageGroups: MessageGroup[]
}
