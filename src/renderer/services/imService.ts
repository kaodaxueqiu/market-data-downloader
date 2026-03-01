import { getSDK, CbEvents } from '@openim/client-sdk'
import { IM_CONFIG } from '../config/imConfig'

let sdkInstance: ReturnType<typeof getSDK> | null = null

export function getOpenIM() {
  if (!sdkInstance) {
    sdkInstance = getSDK()
  }
  return sdkInstance
}

export async function loginIM(userID: string, token: string) {
  const sdk = getOpenIM()
  await sdk.login({
    userID,
    token,
    platformID: IM_CONFIG.platformID,
    apiAddr: IM_CONFIG.apiAddr,
    wsAddr: IM_CONFIG.wsAddr,
  })
}

export async function logoutIM() {
  const sdk = getOpenIM()
  try {
    await sdk.logout()
  } catch (e) {
    console.warn('IM logout error:', e)
  }
}

export function onIMEvent(event: CbEvents, callback: (data: any) => void) {
  const sdk = getOpenIM()
  sdk.on(event, callback as any)
}

export function offIMEvent(event: CbEvents, callback?: (data: any) => void) {
  const sdk = getOpenIM()
  if (callback) sdk.off(event, callback as any)
}

export { CbEvents }
