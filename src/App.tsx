import {
  Card,
  CardContent,
  Grid2,
  LinearProgress,
  LinearProgressProps,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import './App.css'
import { StatisticsService } from './StatisticsService'
import { AccountInfo } from './types/Account'
import { FinalizationProofEpoch } from './types/FinalizationProofEpoch'
import {
  findAccountNativeCurrencyByPublicKey,
  seachAccountsByPublicKeysFromRest,
} from './utils/findAccount'
import { hexToBase32 } from './utils/hexToBase32'
import { formatStringNumber, formatXymString } from './utils/numberFormat'

const NETWORK_TYPE = 'testnet'

type VotingNodeInfoData = {
  host: string
  publicKey: string
  address: string
  amount: string
  votingPublicKeys?: {
    votingPublicKey?: string
    startEpoch?: number
    endEpoch?: number
    progress?: number
    stage0Signature?: string
    stage1Signature?: string
  }[]
}

const LinearProgressExt = (props: LinearProgressProps & { value: number }) => {
  let color: 'success' | 'warning' | 'error' = 'success'
  if (props.value < 85) {
    // 85%未満
    color = 'success'
  } else if (props.value <= 99) {
    // 85%以上、99%以下
    color = 'warning'
  } else {
    // 100%
    color = 'error'
  }

  return (
    <LinearProgress
      variant="determinate"
      color={color}
      style={{ clear: 'both' }}
      value={props.value}
    />
  )
}

const judgmentVotingKey = (currentEpoch: number, startEpoch: number, endEpoch: number) => {
  if (currentEpoch < startEpoch) {
    return 'Next'
  } else if (currentEpoch > endEpoch) {
    return 'Expired'
  }
  return 'Current'
}

const GridItem = (props: { title: string; value: string }) => {
  return (
    <>
      <Typography component="div" sx={{ color: 'text.secondary', fontSize: 14 }}>
        {props.title}
      </Typography>
      <Typography
        variant="body1"
        component="div"
        gutterBottom
        style={{ whiteSpace: 'nowrap', overflowX: 'hidden', textOverflow: 'ellipsis' }}
      >
        {props.value}
      </Typography>
    </>
  )
}

function App() {
  const [connectedNode, setConnectedNode] = useState('Connecting...')
  const [height, setHeight] = useState('0')
  const [finalizedHeight, setFinalizedHeight] = useState('0')
  const [finalizationPoint, setFinalizationPoint] = useState('0 / 48')
  const [finalizationEpoch, setFinalizationEpoch] = useState('0')
  const [finalizationEpochProgress, setFinalizationEpochProgress] = useState(0)
  const [votingNodeInfos, setVotingNodeInfos] = useState<VotingNodeInfoData[]>([])
  const [stage0Height, setStage0Height] = useState('0')
  const [stage1Height, setStage1Height] = useState('0')

  // URLからパラメータを取得
  const urlParams = new URLSearchParams(window.location.search)
  const urlFilter = urlParams.get('filter')

  useEffect(() => {
    const retchData = async () => {
      console.info('network type:', NETWORK_TYPE)

      // Rest用APIノード取得
      const ss = new StatisticsService(NETWORK_TYPE)
      await ss.init()
      const selectedNode = await ss.fetchOne()

      // ファイナライゼーションプルーフ取得
      const restUrl = selectedNode.url
      const epoch = selectedNode.chainInfo.latestFinalizedBlock.finalizationEpoch
      const finalizationProofEpochUrl = `${restUrl}/finalization/proof/epoch/${epoch}`
      console.debug('finalization proof epoch url:', finalizationProofEpochUrl)
      const finalizationProofResponse = await fetch(finalizationProofEpochUrl)
      const finalizationProof: FinalizationProofEpoch = await finalizationProofResponse.json()

      // ファイナライゼーションプルーフステージブロック高
      const stage0Height = finalizationProof.messageGroups[1].height
      const stage1Height = finalizationProof.messageGroups[0].height

      // Votingノード情報取得
      let votingNodes = ss.getVotingNodes()
      // フィルタ
      if (urlFilter) {
        votingNodes = votingNodes.filter((val) => {
          return val.host.includes(urlFilter) || val.publicKey.includes(urlFilter)
        })
      }

      // アカウント情報取得
      const accountPublicKeys = votingNodes.map((val) => val.publicKey)
      let accountInfos: AccountInfo[] = []
      try {
        accountInfos = await seachAccountsByPublicKeysFromRest(accountPublicKeys, restUrl)
      } catch (e) {
        console.error(e)
      }

      const votingNodeInfoDatas: VotingNodeInfoData[] = []

      for (const node of votingNodes) {
        // Stateにセットするデータ作成
        const votingNodeInfoData: VotingNodeInfoData = {
          host: node.host,
          publicKey: node.publicKey,
          address: '-',
          amount: '0 XYM',
          votingPublicKeys: [],
        }

        // アカウント情報検索
        const accountInfo = findAccountNativeCurrencyByPublicKey(
          NETWORK_TYPE,
          accountInfos,
          node.publicKey
        )

        if (accountInfo) {
          // アドレスBase32変換
          votingNodeInfoData.address = hexToBase32(accountInfo.account.address)
          // アカウント残高取得
          if (accountInfo.account.mosaics!.length !== 0) {
            const amount = formatXymString(accountInfo.account.mosaics![0].amount) + ' XYM'
            votingNodeInfoData.amount = amount
          }

          // ファイナライゼーションプルーフの署名取得
          const votingPublicKeys = accountInfo.account.supplementalPublicKeys?.voting?.publicKeys
          if (votingPublicKeys) {
            for (const votingPublicKey of votingPublicKeys) {
              let progress = 0
              if (epoch < votingPublicKey.startEpoch) {
                // 未開始
              } else if (epoch >= votingPublicKey.endEpoch) {
                // 終了
                progress = 100
              } else {
                // 進行中
                progress =
                  ((epoch - votingPublicKey.startEpoch) /
                    (votingPublicKey.endEpoch - votingPublicKey.startEpoch)) *
                  100
              }

              // 投票してるか確認
              const signatureMap = new Map<string, string>()
              signatureMap.set('stage0', '-')
              signatureMap.set('stage1', '-')
              for (const messageGroup of finalizationProof.messageGroups) {
                const signature = messageGroup.signatures.find((val) => {
                  return val.root.parentPublicKey === votingPublicKey.publicKey
                })
                if (signature) {
                  signatureMap.set(`stage${messageGroup.stage}`, signature.bottom.signature)
                }
              }

              votingNodeInfoData.votingPublicKeys!.push({
                votingPublicKey: votingPublicKey.publicKey,
                startEpoch: votingPublicKey.startEpoch,
                endEpoch: votingPublicKey.endEpoch,
                progress: progress,
                stage0Signature: signatureMap.get('stage0'),
                stage1Signature: signatureMap.get('stage1'),
              })

              votingNodeInfoData.votingPublicKeys!.sort((a, b) => {
                const isAInRange = epoch >= a.startEpoch! && epoch <= a.endEpoch!
                const isBInRange = epoch >= b.startEpoch! && epoch <= b.endEpoch!

                if (isAInRange && !isBInRange) {
                  return -1 // aを先に
                } else if (!isAInRange && isBInRange) {
                  return 1 // bを先に
                } else {
                  return b.startEpoch! - a.startEpoch! // startEpochの降順
                }
              })
            }
          }
        }

        votingNodeInfoDatas.push(votingNodeInfoData)
      }

      votingNodeInfoDatas.sort((a, b) => {
        // votingPublicKeysが空のデータを一番下にする
        if (a.votingPublicKeys!.length === 0 && b.votingPublicKeys!.length > 0) {
          return 1
        } else if (a.votingPublicKeys!.length > 0 && b.votingPublicKeys!.length === 0) {
          return -1
        }

        // votingPublicKeysが空でない場合は、amountでソート
        return parseInt(b.amount) - parseInt(a.amount)
      })

      // Stateにセット
      setConnectedNode(selectedNode.url)
      setHeight(formatStringNumber(selectedNode.chainInfo.height))
      setFinalizedHeight(formatStringNumber(selectedNode.chainInfo.latestFinalizedBlock.height))
      setFinalizationEpoch(
        formatStringNumber(selectedNode.chainInfo.latestFinalizedBlock.finalizationEpoch.toString())
      )
      const finalizationPoint = selectedNode.chainInfo.latestFinalizedBlock.finalizationPoint
      const finalizationEpochProgress = (finalizationPoint / 48) * 100
      setVotingNodeInfos(votingNodeInfoDatas)
      setFinalizationPoint(finalizationPoint.toString() + ' / 48')
      setFinalizationEpochProgress(finalizationEpochProgress)
      setStage0Height(formatStringNumber(stage0Height))
      setStage1Height(formatStringNumber(stage1Height))
    }

    retchData()
  }, [urlFilter])

  return (
    <>
      <h2>Symbol Finalization Proof</h2>

      <Card sx={{ minWidth: 275 }}>
        <CardContent>
          <Typography gutterBottom sx={{ color: 'text.primary', fontSize: 18, fontWeight: 'bold' }}>
            Chain Info
          </Typography>

          <Grid2 container spacing={0.5}>
            <Grid2 size={{ xs: 12, sm: 12, md: 12 }}>
              <GridItem title="Connected Node" value={connectedNode} />
            </Grid2>

            <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
              <GridItem title="Block Height" value={height} />
            </Grid2>

            <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
              <GridItem title="Finalized Height" value={finalizedHeight} />
            </Grid2>

            <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
              <GridItem title="Finalized Epoch" value={finalizationEpoch} />
            </Grid2>

            <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography component="div" sx={{ color: 'text.secondary', fontSize: 14 }}>
                Finalization Point
              </Typography>
              <Typography
                variant="body1"
                component="div"
                style={{
                  marginRight: '10px',
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                  overflowX: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {finalizationPoint}
                <LinearProgress
                  variant="determinate"
                  color="info"
                  value={finalizationEpochProgress}
                />
              </Typography>
            </Grid2>
          </Grid2>
        </CardContent>
      </Card>

      <br />

      {votingNodeInfos.map((votingNodeInfo, index) => (
        <Card
          variant="outlined"
          sx={{ minWidth: 275 }}
          style={{ marginBottom: '10px' }}
          key={index}
        >
          <CardContent>
            <Typography
              gutterBottom
              sx={{ color: 'text.primary', fontSize: 18, fontWeight: 'bold' }}
            >
              Node Info
            </Typography>

            <Grid2 container spacing={0.5}>
              <Grid2 size={{ xs: 12, sm: 12, md: 12 }}>
                <GridItem title="Host" value={votingNodeInfo.host} />
              </Grid2>

              <Grid2 size={{ xs: 12, sm: 12, md: 12 }}>
                <GridItem title="PublicKey" value={votingNodeInfo.publicKey} />
              </Grid2>

              <Grid2 size={{ xs: 12, sm: 7, md: 9 }}>
                <GridItem title="Address" value={votingNodeInfo.address} />
              </Grid2>

              <Grid2 size={{ xs: 12, sm: 5, md: 3 }}>
                <GridItem title="Amount" value={votingNodeInfo.amount} />
              </Grid2>

              <Grid2 size={{ xs: 12, sm: 12, md: 12 }}>
                <Card sx={{ minWidth: 275 }} style={{ marginTop: '10px' }} key={index}>
                  <CardContent>
                    <Typography
                      gutterBottom
                      sx={{ color: 'text.primary', fontSize: 16, fontWeight: 'bold' }}
                    >
                      Voting Key Info
                    </Typography>

                    {votingNodeInfo.votingPublicKeys?.map((val, index) => (
                      <Card
                        variant="outlined"
                        sx={{ minWidth: 275 }}
                        style={{ marginBottom: '10px' }}
                        key={index}
                      >
                        <CardContent>
                          <Typography
                            gutterBottom
                            sx={{ color: 'text.primary', fontSize: 16, fontWeight: 'bold' }}
                          >
                            {judgmentVotingKey(
                              parseInt(finalizationEpoch.replace(/,/g, '')),
                              val.startEpoch!,
                              val.endEpoch!
                            )}{' '}
                            Voting Key
                          </Typography>

                          <Grid2 container spacing={0.5}>
                            <Grid2 size={{ xs: 12, sm: 12, md: 12 }}>
                              <GridItem title="Voting PublicKey" value={val.votingPublicKey!} />
                              <Grid2 size={{ xs: 12, sm: 12, md: 12 }}>
                                <Typography
                                  component="div"
                                  sx={{ color: 'text.secondary', fontSize: 14 }}
                                >
                                  Voting Key Period
                                </Typography>
                                <Typography
                                  variant="body1"
                                  component="div"
                                  gutterBottom
                                  style={{
                                    whiteSpace: 'nowrap',
                                    overflowX: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  <div style={{ float: 'left' }}>
                                    {formatStringNumber(val.startEpoch!.toString())}
                                  </div>
                                  <div style={{ float: 'right' }}>
                                    {formatStringNumber(val.endEpoch!.toString())}
                                  </div>
                                  <LinearProgressExt value={val.progress!} />
                                </Typography>
                              </Grid2>
                            </Grid2>

                            {index === 0 ? (
                              <>
                                <Grid2 size={{ xs: 12, sm: 6, md: 6 }}>
                                  <GridItem
                                    title={`Stage0 Bottom Signature (Height: ${stage0Height})`}
                                    value={val.stage0Signature!}
                                  />
                                </Grid2>

                                <Grid2 size={{ xs: 12, sm: 6, md: 6 }}>
                                  <GridItem
                                    title={`Stage1 Bottom Signature (Height: ${stage1Height})`}
                                    value={val.stage1Signature!}
                                  />
                                </Grid2>
                              </>
                            ) : (
                              <></>
                            )}
                          </Grid2>
                        </CardContent>
                      </Card>
                    ))}
                  </CardContent>
                </Card>
              </Grid2>
            </Grid2>
          </CardContent>
        </Card>
      ))}
    </>
  )
}

export default App
