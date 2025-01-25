import { AccountInfo } from '../types/Account'

const TESTNET_XYM_MOSAIC_ID = '72C0212E67A08BCE'
const MAINNET_XYM_MOSAIC_ID = '6BED913FA20223F8'

export const seachAccountsByPublicKeysFromRest = async (
  publicKeys: string[],
  restUrl: string
): Promise<AccountInfo[]> => {
  console.debug('request publicKeys count:', publicKeys.length)

  const accountsUrl = `${restUrl}/accounts`
  console.debug('accounts url:', accountsUrl)

  const accountInfoResponse = await fetch(accountsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: `{"publicKeys":${JSON.stringify(publicKeys)}}`,
  })

  if (accountInfoResponse.status !== 200) {
    throw new Error(`Failed to fetch accountInfos: ${accountInfoResponse.status}`)
  }

  const accountInfos: AccountInfo[] = await accountInfoResponse.json()

  console.debug('response accountInfos count:', accountInfos.length)

  return accountInfos
}

export const findAccountNativeCurrencyByPublicKey = (
  networkType: string | 'testnet' | 'mainnet',
  accountInfos: AccountInfo[],
  publicKey: string
): AccountInfo | null => {
  // アカウント検索
  const accountInfo: AccountInfo | undefined = accountInfos.find(
    (accountInfo) => accountInfo.account.publicKey === publicKey
  )

  // アカウントが見つからない場合はnullを返す
  if (!accountInfo) {
    console.debug('account not found:', publicKey)
    return null
  }

  // ネイティブ通貨のモザイクを取得
  const nativeCurrency = accountInfo.account.mosaics?.find((mosaic) => {
    return networkType === 'testnet'
      ? mosaic.id === TESTNET_XYM_MOSAIC_ID
      : mosaic.id === MAINNET_XYM_MOSAIC_ID
  })

  // ネイティブ通貨がない場合は空の配列を設定
  accountInfo.account.mosaics = nativeCurrency ? [nativeCurrency] : []

  return accountInfo
}
