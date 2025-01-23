import createClient from 'openapi-fetch'
import { components, paths } from './schema'
import { ChainInfo } from './types/ChainInfo'

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

  /**
   * コンストラクタ
   * @param networkType - 'testnet' or 'mainnet'
   */
  constructor(private networkType: string | 'testnet' | 'mainnet') {
    if (!(networkType === 'mainnet' || networkType === 'testnet'))
      throw Error('unknown network type.')
  }

  /**
   * 初期化処理
   */
  async init() {
    const statisticsUrls =
      this.networkType === 'mainnet' ? this.MAINNET_STATISTICS_URLS : this.TESTNET_STATISTICS_URLS

    for (const statisticsUrl of statisticsUrls) {
      // Statisticsから全ノード情報取得
      const client = createClient<paths>({
        baseUrl: statisticsUrl,
      })
      const { data, error } = await client.GET('/nodes')
      if (error) {
        console.error(error)
        continue
      }

      // 活きているAPIノード情報をキャッシュ
      const apiNodes = data.filter(
        (val) =>
          (val.roles & 2) !== 0 &&
          val.apiStatus?.isAvailable === true &&
          val.apiStatus?.isHttpsEnabled === true
      )
      this.apiNodesCache = apiNodes

      // Votingノード情報をキャッシュ
      const votingNodes = data.filter((val) => (val.roles & 4) !== 0)
      this.votingNodesCache = votingNodes

      break
    }

    if (this.apiNodesCache.length === 0) {
      throw Error('failed to fetch statistics service.')
    }
  }

  /**
   * APIノード情報をランダムに取得
   * @returns APIノード情報
   */
  async fetchOne(): Promise<SelectedNode> {
    // APIノード情報をMAX_RANDOM_VAL個取得
    const apiNodeCount = this.apiNodesCache.length
    const maxRandomVal =
      (apiNodeCount < this.MAX_RANDOM_VAL ? apiNodeCount : apiNodeCount - this.MAX_RANDOM_VAL) - 1
    const randomIndex = Math.floor(Math.random() * maxRandomVal)

    // ブロック高取得URL生成
    const fetchPromises = []
    for (let i = randomIndex; i < randomIndex + this.MAX_RANDOM_VAL; i++) {
      const restUrl = this.apiNodesCache[i].apiStatus?.restGatewayUrl
      console.log(`${restUrl}/chain/info`)
      fetchPromises.push(fetch(`${restUrl}/chain/info`))
    }

    // ブロック高取得リクエスト
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

    // ブロック高降順にソート
    const nodes: { url: string; chainInfo: ChainInfo }[] = []
    for (const response of responses) {
      const data = await response.value.json()
      const url = new URL(response.value.url)
      nodes.push({ url: `${url.protocol}//${url.host}`, chainInfo: data })
    }
    const sortedNodes = nodes.sort(
      (a, b) => parseInt(b.chainInfo.height) - parseInt(a.chainInfo.height)
    )

    // 2番目のノード情報を返す
    return sortedNodes.length === 1 ? sortedNodes[0] : sortedNodes[1]
  }

  /**
   * Votingノード情報を取得
   * @returns Votingノード情報
   */
  getVotingNodes(): components['schemas']['NodeInfo'][] {
    return this.votingNodesCache
  }
}
