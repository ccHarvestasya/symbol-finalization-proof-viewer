import createClient from 'openapi-fetch'
import { components, paths } from './schema'

export type ChainInfo = {
  scoreHigh: string
  scoreLow: string
  height: string
  latestFinalizedBlock: {
    finalizationEpoch: number
    finalizationPoint: number
    height: string
    hash: string
  }
}

export type SelectedNode = {
  url: string
  chainInfo: ChainInfo
}

export class StatisticsService {
  private TESTNET_STATISTICS_URLS = ['https://testnet.symbol.services']
  private MAINNET_STATISTICS_URLS = ['https://symbol.services']
  private MAX_RANDOM_VAL = 5

  private apiNodesCache: components['schemas']['NodeInfo'][] = []
  private votingNodesCache: components['schemas']['NodeInfo'][] = []

  constructor(private networkType: string | 'testnet' | 'mainnet') {
    if (!(networkType === 'mainnet' || networkType === 'testnet'))
      throw Error('unknown network type.')
  }

  async init() {
    const statisticsUrls =
      this.networkType === 'mainnet' ? this.MAINNET_STATISTICS_URLS : this.TESTNET_STATISTICS_URLS

    for (const statisticsUrl of statisticsUrls) {
      const client = createClient<paths>({
        baseUrl: statisticsUrl,
      })

      const { data, error } = await client.GET('/nodes')
      if (error) {
        console.error(error)
        continue
      }

      const apiNodes = data.filter(
        (val) =>
          (val.roles & 2) !== 0 &&
          val.apiStatus?.isAvailable === true &&
          val.apiStatus?.isHttpsEnabled === true
      )
      this.apiNodesCache = apiNodes

      const votingNodes = data.filter((val) => (val.roles & 4) !== 0)
      this.votingNodesCache = votingNodes

      break
    }

    if (this.apiNodesCache.length === 0) {
      throw Error('failed to fetch statistics service.')
    }
  }

  async fetchOne(): Promise<SelectedNode> {
    const apiNodeCount = this.apiNodesCache.length
    const maxRandomVal =
      (apiNodeCount < this.MAX_RANDOM_VAL ? apiNodeCount : apiNodeCount - this.MAX_RANDOM_VAL) - 1
    const randomIndex = Math.floor(Math.random() * maxRandomVal)

    const fetchPromises = []
    for (let i = randomIndex; i < randomIndex + this.MAX_RANDOM_VAL; i++) {
      const restUrl = this.apiNodesCache[i].apiStatus?.restGatewayUrl
      console.log(`${restUrl}/chain/info`)
      fetchPromises.push(fetch(`${restUrl}/chain/info`))
    }

    const responses = await Promise.allSettled(fetchPromises)
      .then((results) => {
        const successfulResponses = results.filter((result) => result.status === 'fulfilled')
        if (successfulResponses.length > 0) {
          return successfulResponses
        } else {
          throw new Error('failed fetch request for all api nodes.')
        }
      })
      .catch((error) => {
        throw new Error(`error fetching chain info: ${error}`)
      })

    const nodes: {
      url: string
      chainInfo: ChainInfo
    }[] = []

    for (const response of responses) {
      const data = await response.value.json()
      const url = new URL(response.value.url)
      nodes.push({ url: `${url.protocol}//${url.host}`, chainInfo: data })
    }
    const sortedNodes = nodes.sort(
      (a, b) => parseInt(b.chainInfo.height) - parseInt(a.chainInfo.height)
    )

    return sortedNodes.length === 1 ? sortedNodes[0] : sortedNodes[1]
  }

  getVotingNodes(): components['schemas']['NodeInfo'][] {
    return this.votingNodesCache
  }
}
