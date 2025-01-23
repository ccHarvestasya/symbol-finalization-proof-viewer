export type VotingPublicKey = {
  publicKey: string
  startEpoch: number
  endEpoch: number
}

export type LinkedPublicKey = { publicKey: string }

export type LinkedVotingPublicKey = { publicKeys: VotingPublicKey[] }

export type SupplementalPublicKeys = {
  linked?: LinkedPublicKey
  vrf?: LinkedPublicKey
  voting?: LinkedVotingPublicKey
}

export type ActivityBuckets = {
  startHeight: string
  totalFeesPaid: string
  beneficiaryCount: number
  rawScore: string
}

export type Mosaic = {
  id: string
  amount: string
}

export type Account = {
  version: number
  address: string
  addressHeight: string
  publicKey: string
  publicKeyHeight: string
  accountType: number
  supplementalPublicKeys?: SupplementalPublicKeys
  activityBuckets?: ActivityBuckets[]
  mosaics?: Mosaic[]
  importance: string
  importanceHeight: string
}

export type AccountInfo = {
  account: Account
  id: string
}
