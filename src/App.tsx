import { useEffect, useState } from 'react'
import './App.css'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import { StatisticsService } from './StatisticsService'
import { AccountInfo } from './types/Account'
import { FinalizationProofEpoch } from './types/FinalizationProofEpoch'
import { hexToBase32 } from './utils/hexToBase32'

type VotingNodeInfoData = {
  host: string
  publicKey: string
  address?: string
  votingPublicKeys?: {
    votingPublicKey?: string
    startEpoch?: number
    endEpoch?: number
  }[]
  signatures?: { height: string; signature: string }[]
}

function App() {
  const [count, setCount] = useState(0)
  const [connectedNode, setConnectedNode] = useState('')
  const [height, setHeight] = useState('')
  const [finalizedHeight, setFinalizedHeight] = useState('')
  const [finalizationPoint, setFinalizationPoint] = useState('')
  const [finalizationEpoch, setFinalizationEpoch] = useState('')
  const [votingNodeInfos, setVotingNodeInfos] = useState<VotingNodeInfoData[]>([])

  useEffect(() => {
    const retchData = async () => {
      // Rest用APIノード取得
      const ss = new StatisticsService('testnet')
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
            votingNodeInfoData.votingPublicKeys!.push({
              votingPublicKey: votingPublicKey.publicKey,
              startEpoch: votingPublicKey.startEpoch,
              endEpoch: votingPublicKey.endEpoch,
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
      setFinalizationPoint(selectedNode.chainInfo.latestFinalizedBlock.finalizationPoint.toString())
      setVotingNodeInfos(votingNodeInfoDatas)
    }

    retchData()
  }, [])

  return (
    <>
      <div className="card">
        <p>
          Connected Node: {connectedNode}
          <br />
          Height: {height}
          <br />
          Finalized Height: {finalizedHeight}
          <br />
          Finalization Epoch: {finalizationEpoch}
          <br />
          Finalization Point: {finalizationPoint} / 48
        </p>
      </div>
      <div className="card">
        {votingNodeInfos.map((votingNodeInfo, index) => (
          <p>
            №{index} host: {votingNodeInfo.host}
            <br />
            address: {votingNodeInfo.address}
            <br />
            publicKey: {votingNodeInfo.publicKey}
            <br />
            {votingNodeInfo.votingPublicKeys?.map((val) => (
              <>
                votingPublicKey: {val.votingPublicKey} startEpoch: {val.startEpoch} endEpoch:{' '}
                {val.endEpoch}
                <br />
              </>
            ))}
            {votingNodeInfo.signatures?.map((val) => (
              <>
                height: {val.height}
                <br />
                signature: {val.signature}
                <br />
              </>
            ))}
          </p>
        ))}
      </div>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>count is {count}</button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">Click on the Vite and React logos to learn more</p>
    </>
  )
}

export default App
