import { Card, CardContent, Grid2, LinearProgress, Paper, styled, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import './App.css'
import { StatisticsService } from './StatisticsService'
import { AccountInfo } from './types/Account'
import { FinalizationProofEpoch } from './types/FinalizationProofEpoch'
import { hexToBase32 } from './utils/hexToBase32'

const NETWORK_TYPE = 'testnet'

type VotingNodeInfoData = {
  host: string
  publicKey: string
  address?: string
  votingPublicKeys?: {
    votingPublicKey?: string
    startEpoch?: number
    endEpoch?: number
    progress?: number
  }[]
  signatures?: { height: string; signature: string }[]
}

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: '#fff',
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: 'center',
  color: theme.palette.text.secondary,
  ...theme.applyStyles('dark', {
    backgroundColor: '#1A2027',
  }),
}))

const ItemDark = styled(Paper)(({ theme }) => ({
  // backgroundColor: '#fff',
  ...theme.typography.body2,
  padding: theme.spacing(1),
  // textAlign: 'center',
  color: theme.palette.text.secondary,
  ...theme.applyStyles('dark', {
    backgroundColor: '#040404',
    whiteSpace: 'nowrap',
    overflowX: 'hidden',
    textOverflow: 'ellipsis',
  }),
}))

function App() {
  const [connectedNode, setConnectedNode] = useState('Connecting...')
  const [height, setHeight] = useState('0')
  const [finalizedHeight, setFinalizedHeight] = useState('0')
  const [finalizationPoint, setFinalizationPoint] = useState('0')
  const [finalizationEpoch, setFinalizationEpoch] = useState('0')
  const [finalizationEpochProgress, setFinalizationEpochProgress] = useState(0)
  const [votingNodeInfos, setVotingNodeInfos] = useState<VotingNodeInfoData[]>([])

  useEffect(() => {
    const retchData = async () => {
      // Rest用APIノード取得
      const ss = new StatisticsService(NETWORK_TYPE)
      await ss.init()
      const selectedNode = await ss.fetchOne()

      // ファイナライゼーションプルーフ取得
      const restUrl = selectedNode.url
      const epoch = selectedNode.chainInfo.latestFinalizedBlock.finalizationEpoch
      const finalizationProofResponse = await fetch(`${restUrl}/finalization/proof/epoch/${epoch}`)
      const finalizationProof: FinalizationProofEpoch = await finalizationProofResponse.json()

      // Votingノード情報取得
      const votingNodes = ss.getVotingNodes()

      // アカウント情報取得
      const accountPublicKeys = votingNodes.map((val) => val.publicKey)
      const accountInfoResponse = await fetch(`${restUrl}/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: `{"publicKeys":${JSON.stringify(accountPublicKeys)}}`,
      })
      const accountInfos: AccountInfo[] = await accountInfoResponse.json()

      const votingNodeInfoDatas: VotingNodeInfoData[] = []
      for (const node of votingNodes) {
        // // アカウント情報取得
        const accountInfo: AccountInfo | undefined = accountInfos.find(
          (val) => val.account.publicKey === node.publicKey
        )
        if (!accountInfo) {
          continue
        }

        // Stateにセットするデータ作成
        const votingNodeInfoData: VotingNodeInfoData = {
          host: node.host,
          publicKey: node.publicKey,
          address: hexToBase32(accountInfo.account.address),
          votingPublicKeys: [],
          signatures: [],
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

            votingNodeInfoData.votingPublicKeys!.push({
              votingPublicKey: votingPublicKey.publicKey,
              startEpoch: votingPublicKey.startEpoch,
              endEpoch: votingPublicKey.endEpoch,
              progress: progress,
            })

            const stage1 = finalizationProof.messageGroups[0].signatures.find((val) => {
              return val.root.parentPublicKey === votingPublicKey.publicKey
            })
            if (stage1) {
              votingNodeInfoData.signatures!.push({
                height: finalizationProof.messageGroups[0].height,
                signature: stage1.root.signature,
              })
            }
            const stage0 = finalizationProof.messageGroups[1].signatures.find((val) => {
              return val.root.parentPublicKey === votingPublicKey.publicKey
            })
            if (stage0) {
              votingNodeInfoData.signatures!.push({
                height: finalizationProof.messageGroups[1].height,
                signature: stage0.root.signature,
              })
            }
          }
        }

        votingNodeInfoDatas.push(votingNodeInfoData)
      }

      for (const votingNodeInfoData of votingNodeInfoDatas) {
        console.log(votingNodeInfoData)
      }

      // Stateにセット
      setConnectedNode(selectedNode.url)
      setHeight(selectedNode.chainInfo.height)
      setFinalizedHeight(selectedNode.chainInfo.latestFinalizedBlock.height)
      setFinalizationEpoch(selectedNode.chainInfo.latestFinalizedBlock.finalizationEpoch.toString())
      const finalizationPoint = selectedNode.chainInfo.latestFinalizedBlock.finalizationPoint
      const finalizationEpochProgress = (finalizationPoint / 48) * 100
      setFinalizationPoint(finalizationPoint.toString() + ' / 48')
      setFinalizationEpochProgress(finalizationEpochProgress)
      setVotingNodeInfos(votingNodeInfoDatas)
    }

    retchData()
  }, [])

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
              <Typography component="div" sx={{ color: 'text.secondary', fontSize: 14 }}>
                Connected Node
              </Typography>
              <Typography
                variant="body1"
                component="div"
                gutterBottom
                style={{ whiteSpace: 'nowrap', overflowX: 'hidden', textOverflow: 'ellipsis' }}
              >
                {connectedNode}
              </Typography>
            </Grid2>

            <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography component="div" sx={{ color: 'text.secondary', fontSize: 14 }}>
                Block Height
              </Typography>
              <Typography
                variant="body1"
                component="div"
                gutterBottom
                style={{ whiteSpace: 'nowrap', overflowX: 'hidden', textOverflow: 'ellipsis' }}
              >
                {height}
              </Typography>
            </Grid2>

            <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography component="div" sx={{ color: 'text.secondary', fontSize: 14 }}>
                Finalized Height
              </Typography>
              <Typography
                variant="body1"
                component="div"
                gutterBottom
                style={{ whiteSpace: 'nowrap', overflowX: 'hidden', textOverflow: 'ellipsis' }}
              >
                {finalizedHeight}
              </Typography>
            </Grid2>

            <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography component="div" sx={{ color: 'text.secondary', fontSize: 14 }}>
                Finalization Epoch
              </Typography>
              <Typography
                variant="body1"
                component="div"
                gutterBottom
                style={{ whiteSpace: 'nowrap', overflowX: 'hidden', textOverflow: 'ellipsis' }}
              >
                {finalizationEpoch}
              </Typography>
            </Grid2>

            <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography component="div" sx={{ color: 'text.secondary', fontSize: 14 }}>
                Finalization Point
              </Typography>
              <Typography
                variant="body1"
                component="div"
                style={{ whiteSpace: 'nowrap', overflowX: 'hidden', textOverflow: 'ellipsis' }}
              >
                {finalizationPoint}
                <LinearProgress variant="determinate" value={finalizationEpochProgress} />
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
                <Typography component="div" sx={{ color: 'text.secondary', fontSize: 14 }}>
                  Host
                </Typography>
                <Typography
                  variant="body1"
                  component="div"
                  gutterBottom
                  style={{ whiteSpace: 'nowrap', overflowX: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {votingNodeInfo.host}
                </Typography>
              </Grid2>

              <Grid2 size={{ xs: 12, sm: 12, md: 5 }}>
                <Typography component="div" sx={{ color: 'text.secondary', fontSize: 14 }}>
                  Address
                </Typography>
                <Typography
                  variant="body1"
                  component="div"
                  gutterBottom
                  style={{ whiteSpace: 'nowrap', overflowX: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {votingNodeInfo.address}
                </Typography>
              </Grid2>

              <Grid2 size={{ xs: 12, sm: 12, md: 7 }}>
                <Typography component="div" sx={{ color: 'text.secondary', fontSize: 14 }}>
                  PublicKey
                </Typography>
                <Typography
                  variant="body1"
                  component="div"
                  gutterBottom
                  style={{ whiteSpace: 'nowrap', overflowX: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {votingNodeInfo.publicKey}
                </Typography>
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
                            Voting Key {index + 1}
                          </Typography>

                          <Grid2 container spacing={0.5}>
                            <Grid2 size={{ xs: 12, sm: 12, md: 12 }}>
                              <Typography
                                component="div"
                                sx={{ color: 'text.secondary', fontSize: 14 }}
                              >
                                Voting PublicKey
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
                                {val.votingPublicKey}
                              </Typography>
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
                                  <div style={{ float: 'left' }}>{val.startEpoch}</div>
                                  <div style={{ float: 'right' }}>{val.endEpoch}</div>
                                  <LinearProgress
                                    variant="determinate"
                                    style={{ clear: 'both' }}
                                    value={val.progress}
                                  />
                                </Typography>
                              </Grid2>
                            </Grid2>
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

      {votingNodeInfos.map((votingNodeInfo, index) => (
        <>
          <br />
          <Grid2 container spacing={0.5} key={index}>
            <Grid2 size={{ xs: 12, sm: 12, md: 12 }}>
              <Card variant="outlined">
                <Grid2 container spacing={0.5}>
                  <Grid2 size={{ xs: 12, sm: 3, md: 3 }}>
                    <Item>Host</Item>
                  </Grid2>
                  <Grid2 size={{ xs: 12, sm: 9, md: 9 }}>
                    <ItemDark>{votingNodeInfo.host}</ItemDark>
                  </Grid2>{' '}
                  <Grid2 size={{ xs: 12, sm: 3, md: 3 }}>
                    <Item>Address</Item>
                  </Grid2>
                  <Grid2 size={{ xs: 12, sm: 9, md: 9 }}>
                    <ItemDark>{votingNodeInfo.address}</ItemDark>
                  </Grid2>
                  <Grid2 size={{ xs: 12, sm: 3, md: 3 }}>
                    <Item>PublicKey</Item>
                  </Grid2>
                  <Grid2 size={{ xs: 12, sm: 9, md: 9 }}>
                    <ItemDark>{votingNodeInfo.publicKey}</ItemDark>
                  </Grid2>
                  <Grid2 size={{ xs: 12, sm: 12, md: 12 }}>
                    <Grid2 container spacing={0.5}>
                      {votingNodeInfo.votingPublicKeys?.map((val) => (
                        <>
                          <Grid2 size={{ xs: 12, sm: 3, md: 3 }}>
                            <Item>Voting PublicKey</Item>
                          </Grid2>
                          <Grid2 size={{ xs: 12, sm: 9, md: 9 }}>
                            <ItemDark>{val.votingPublicKey}</ItemDark>
                          </Grid2>
                          <Grid2 size={{ xs: 12, sm: 3, md: 3 }}>
                            <Item>
                              Voting Key
                              <br />
                              Period
                            </Item>
                          </Grid2>
                          <Grid2 size={{ xs: 12, sm: 9, md: 9 }}>
                            <ItemDark>
                              {val.startEpoch}{' '}
                              <LinearProgress variant="determinate" value={val.progress} />{' '}
                              {val.endEpoch}
                            </ItemDark>
                          </Grid2>
                        </>
                      ))}
                    </Grid2>
                  </Grid2>
                  <Grid2 size={{ xs: 12, sm: 12, md: 12 }}>
                    <Grid2 container spacing={0.5}>
                      {votingNodeInfo.signatures?.map((val) => (
                        <>
                          <Grid2 size={{ xs: 12, sm: 3, md: 3 }}>
                            <Item>Height</Item>
                          </Grid2>
                          <Grid2 size={{ xs: 12, sm: 9, md: 9 }}>
                            <ItemDark>{val.height}</ItemDark>
                          </Grid2>{' '}
                          <Grid2 size={{ xs: 12, sm: 3, md: 3 }}>
                            <Item>Signature</Item>
                          </Grid2>
                          <Grid2 size={{ xs: 12, sm: 9, md: 9 }}>
                            <ItemDark>{val.signature}</ItemDark>
                          </Grid2>
                        </>
                      ))}
                    </Grid2>
                  </Grid2>
                </Grid2>
              </Card>
            </Grid2>
          </Grid2>
        </>
      ))}
    </>
  )
}

export default App
