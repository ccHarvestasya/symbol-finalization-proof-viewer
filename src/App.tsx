import { useEffect, useState } from 'react'
import './App.css'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import { StatisticsService } from './StatisticsService'

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

  const hexToBase32 = (unresolvedAddress: string) => {
    // hex to bytes
    const bytesArray = []
    for (let i = 0; i < unresolvedAddress.length; i += 2) {
      bytesArray.push(parseInt(unresolvedAddress.slice(i, i + 2), 16))
    }
    const uint8Array = new Uint8Array(bytesArray)

    // base32 encode
    const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

    let bits = 0
    let value = 0
    let base32 = ''

    for (let i = 0; i < uint8Array.length; i++) {
      value = (value << 8) | uint8Array[i]
      bits += 8

      while (bits >= 5) {
        base32 += base32Chars[(value >>> (bits - 5)) & 0x1f]
        bits -= 5
      }
    }

    if (bits > 0) {
      base32 += base32Chars[(value << (5 - bits)) & 0x1f]
    }

    return base32
  }

  useEffect(() => {
    const retchData = async () => {
      const ss = new StatisticsService('testnet')
      await ss.init()
      const selectedNode = await ss.fetchOne()

      const restUrl = selectedNode.url
      const epoch = selectedNode.chainInfo.latestFinalizedBlock.finalizationEpoch
      const finalizationProofResponse = await fetch(`${restUrl}/finalization/proof/epoch/${epoch}`)
      const finalizationProof = await finalizationProofResponse.json()

      const votingNodes = ss.getVotingNodes()

      const votingNodeInfoDatas: VotingNodeInfoData[] = []
      for (const node of votingNodes) {
        const accountInfoResponse = await fetch(`${restUrl}/accounts/${node.publicKey}`)
        const accountInfo = await accountInfoResponse.json()

        const votingNodeInfoData: VotingNodeInfoData = {
          host: node.host,
          publicKey: node.publicKey,
          address: hexToBase32(accountInfo.account.address),
          votingPublicKeys: [],
          signatures: [],
        }

        const votingPublicKeys = accountInfo.account.supplementalPublicKeys?.voting?.publicKeys
        if (votingPublicKeys) {
          for (const votingPublicKey of votingPublicKeys) {
            votingNodeInfoData.votingPublicKeys!.push({
              votingPublicKey: votingPublicKey.publicKey,
              startEpoch: votingPublicKey.startEpoch,
              endEpoch: votingPublicKey.endEpoch,
            })

            const stage1 = finalizationProof.messageGroups[0].signatures.find(
              (val: { root: { parentPublicKey: string } }) => {
                return val.root.parentPublicKey === votingPublicKey.publicKey
              }
            )
            if (stage1) {
              votingNodeInfoData.signatures!.push({
                height: finalizationProof.messageGroups[0].height,
                signature: stage1.root.signature,
              })
            }
            const stage0 = finalizationProof.messageGroups[1].signatures.find(
              (val: { root: { parentPublicKey: string } }) => {
                return val.root.parentPublicKey === votingPublicKey.publicKey
              }
            )
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
