import { defineStore } from 'pinia'
import { ref, toRaw } from 'vue'
import { getOpenIM, loginIM, logoutIM, onIMEvent, CbEvents } from '../services/imService'

export const useIMStore = defineStore('im', () => {
  const conversations = ref<any[]>([])
  const currentConversation = ref<any>(null)
  const messages = ref<any[]>([])
  const isConnected = ref(false)
  const isLoggingIn = ref(false)
  const isSyncFinished = ref(false)
  const typingMap = ref<Map<string, Set<string>>>(new Map())
  const unreadTotal = ref(0)
  const imUserID = ref('')
  const imToken = ref('')
  const imPhoneNumber = ref('')
  const imEmail = ref('')
  const imCompany = ref('')

  const friends = ref<any[]>([])
  const friendApplicationsRecv = ref<any[]>([])
  const friendApplicationsSent = ref<any[]>([])
  const selfInfo = ref<any>(null)
  const pendingFriendCount = ref(0)
  const friendEventUnread = ref(0)
  const friendEventTab = ref<'received' | 'sent'>('received')

  function setupListeners() {
    onIMEvent(CbEvents.OnConnectSuccess, () => {
      isConnected.value = true
      console.log('✅ IM 连接成功')
    })

    onIMEvent(CbEvents.OnConnectFailed, (data: any) => {
      isConnected.value = false
      console.error('❌ IM 连接失败:', data)
    })

    onIMEvent(CbEvents.OnKickedOffline, () => {
      isConnected.value = false
      console.warn('⚠️ IM 被踢下线')
    })

    onIMEvent(CbEvents.OnConversationChanged, (data: any) => {
      try {
        const raw = data.data
        const list = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : [raw])
        let friendNotificationType = 0
        list.forEach((conv: any) => {
          if (currentConversation.value && conv.conversationID === currentConversation.value.conversationID) {
            conv.unreadCount = 0
          }
          const idx = conversations.value.findIndex(c => c.conversationID === conv.conversationID)
          if (idx >= 0) {
            conversations.value[idx] = conv
          } else {
            conversations.value.unshift(conv)
          }
          try {
            const latestMsg = typeof conv.latestMsg === 'string' ? JSON.parse(conv.latestMsg) : conv.latestMsg
            const ct = latestMsg?.contentType || 0
            if (ct >= 1200 && ct < 1400) {
              friendNotificationType = ct
            }
          } catch { /* ignore */ }
        })
        calcUnread()
        if (friendNotificationType > 0) {
          console.log('🔔 [OnConversationChanged] 好友通知 contentType:', friendNotificationType)
          loadFriends()
          loadFriendApplications()
        }
      } catch (e) { /* ignore */ }
    })

    onIMEvent(CbEvents.OnNewConversation, (data: any) => {
      try {
        const raw = data.data
        const list = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : [raw])
        conversations.value.unshift(...list)
        calcUnread()
      } catch (e) { /* ignore */ }
    })

    onIMEvent(CbEvents.OnRecvNewMessages, async (data: any) => {
      try {
        const raw = data.data
        const msgs = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : [raw])
        let hasFriendNotification = false
        msgs.forEach((msg: any) => {
          if (msg.contentType >= 1000) {
            console.log('🔔 [系统消息] contentType:', msg.contentType, 'sendID:', msg.sendID, 'recvID:', msg.recvID, msg)
          }
          if (msg.contentType >= 1200 && msg.contentType < 1300) {
            hasFriendNotification = true
          }
          if (msg.contentType === 110 && isTypingCustomMsg(msg)) {
            handleTyping(msg)
          } else if (currentConversation.value) {
            const conv = currentConversation.value
            const isCurrentChat =
              (conv.groupID && msg.groupID === conv.groupID) ||
              (!conv.groupID && (msg.sendID === conv.userID || msg.recvID === conv.userID))
            if (isCurrentChat) {
              pushMessageDedup(msg)
            }
          }
        })
        if (hasFriendNotification) {
          console.log('🔔 检测到好友相关通知，刷新好友数据...')
          const beforeCount = friendApplicationsRecv.value.filter((a: any) => a.handleResult === 0).length
          await loadFriends()
          await loadFriendApplications()
          loadConversations()
          const afterCount = friendApplicationsRecv.value.filter((a: any) => a.handleResult === 0).length
          if (afterCount > beforeCount) {
            const { ElNotification } = await import('element-plus')
            ElNotification({ title: '好友申请', message: '你收到了新的好友申请', type: 'info', duration: 5000 })
          }
        }
      } catch (e) { /* ignore */ }
    })

    onIMEvent(CbEvents.OnSyncServerFinish, () => {
      console.log('✅ SDK 数据同步完成，开始加载业务数据')
      isSyncFinished.value = true
      loadAllData()
    })

    onIMEvent(CbEvents.OnFriendApplicationAdded, async (data: any) => {
      try {
        const raw = data.data
        const app = typeof raw === 'string' ? JSON.parse(raw) : raw
        console.log('🔔 [事件] OnFriendApplicationAdded:', app)
        if (app.fromUserID !== imUserID.value) {
          friendEventUnread.value++
          friendEventTab.value = 'received'
          const { ElNotification } = await import('element-plus')
          ElNotification({ title: '好友申请', message: `${app.fromNickname || app.fromUserID} 请求添加你为好友`, type: 'info', duration: 5000 })
        }
      } catch (e) {
        console.warn('⚠️ [OnFriendApplicationAdded] 事件解析失败:', e)
      }
      await loadFriendApplications()
    })

    onIMEvent(CbEvents.OnFriendApplicationAccepted, async (data: any) => {
      console.log('🔔 [事件] OnFriendApplicationAccepted:', data.data)
      updateApplicationStatus(data, 1)
      friendEventUnread.value++
      friendEventTab.value = 'sent'
      loadFriends()
      loadFriendApplications()
      loadConversations()
      try {
        const raw = data.data
        const app = typeof raw === 'string' ? JSON.parse(raw) : raw
        const name = app.toNickname || app.fromNickname || ''
        const { ElNotification } = await import('element-plus')
        ElNotification({ title: '好友申请已通过', message: `${name} 已通过你的好友申请`, type: 'success', duration: 5000 })
      } catch { /* ignore */ }
    })

    onIMEvent(CbEvents.OnFriendApplicationRejected, async (data: any) => {
      console.log('🔔 [事件] OnFriendApplicationRejected:', data.data)
      updateApplicationStatus(data, -1)
      friendEventUnread.value++
      friendEventTab.value = 'sent'
      loadFriendApplications()
      try {
        const raw = data.data
        const app = typeof raw === 'string' ? JSON.parse(raw) : raw
        const name = app.toNickname || app.fromNickname || ''
        const handleMsg = app.handleMsg ? `：${app.handleMsg}` : ''
        const { ElNotification } = await import('element-plus')
        ElNotification({ title: '好友申请被拒绝', message: `${name} 拒绝了你的好友申请${handleMsg}`, type: 'warning', duration: 5000 })
      } catch { /* ignore */ }
    })

    onIMEvent(CbEvents.OnNewRecvMessageRevoked, (data: any) => {
      try {
        const raw = data.data
        const info = typeof raw === 'string' ? JSON.parse(raw) : raw
        const msgID = info?.clientMsgID || info
        const idx = messages.value.findIndex((m: any) => m.clientMsgID === msgID)
        if (idx >= 0) {
          messages.value[idx] = {
            ...messages.value[idx],
            contentType: 2101,
            notificationElem: { detail: JSON.stringify({ revokerNickname: info.revokerNickname || '' }) },
          }
        }
      } catch { /* ignore */ }
    })

    onIMEvent(CbEvents.OnFriendAdded, async (data: any) => {
      console.log('🔔 [事件] OnFriendAdded:', data.data)
      friendEventUnread.value++
      await loadFriends()
      loadFriendApplications()
      loadConversations()
      try {
        const raw = data.data
        const friend = typeof raw === 'string' ? JSON.parse(raw) : raw
        const name = friend.nickname || friend.userID || ''
        const { ElNotification } = await import('element-plus')
        ElNotification({ title: '新好友', message: `你和 ${name} 已成为好友`, type: 'success', duration: 5000 })
      } catch { /* ignore */ }
    })

    onIMEvent(CbEvents.OnFriendDeleted, async (data: any) => {
      friendEventUnread.value++
      loadFriends()
      loadConversations()
      try {
        const raw = data.data
        const friend = typeof raw === 'string' ? JSON.parse(raw) : raw
        const name = friend.nickname || friend.userID || ''
        const { ElNotification } = await import('element-plus')
        ElNotification({ title: '好友已删除', message: `${name} 已从你的好友列表中移除`, type: 'info', duration: 5000 })
      } catch { /* ignore */ }
    })
  }

  function updateApplicationStatus(data: any, result: number) {
    try {
      const raw = data.data
      const app = typeof raw === 'string' ? JSON.parse(raw) : raw
      console.log('🔄 [状态更新] 解析事件数据:', JSON.stringify(app))
      for (const sent of friendApplicationsSent.value) {
        if (sent.toUserID === app.toUserID || sent.toUserID === app.fromUserID) {
          sent.handleResult = result
          console.log('✅ [状态更新] 发出的申请已更新:', sent.toUserID, '→', result)
        }
      }
      for (const recv of friendApplicationsRecv.value) {
        if (recv.fromUserID === app.fromUserID || recv.fromUserID === app.toUserID) {
          recv.handleResult = result
          console.log('✅ [状态更新] 收到的申请已更新:', recv.fromUserID, '→', result)
        }
      }
      pendingFriendCount.value = friendApplicationsRecv.value.filter((a: any) => a.handleResult === 0).length
    } catch (e) {
      console.warn('⚠️ [状态更新] 解析失败:', e)
      loadFriendApplications()
    }
  }

  async function loadAllData() {
    await Promise.all([
      loadSelfInfo(),
      loadConversations(),
      loadFriends(),
      loadFriendApplications(),
    ])
    console.log('✅ 业务数据加载完成')
  }

  function isTypingCustomMsg(msg: any): boolean {
    try {
      const custom = JSON.parse(msg.content)
      const data = JSON.parse(custom.data)
      return data.type === 'typing'
    } catch { return false }
  }

  function handleTyping(msg: any) {
    try {
      const custom = JSON.parse(msg.content)
      const typingData = JSON.parse(custom.data)
      if (typingData.type === 'typing') {
        const convID = msg.groupID || msg.sendID
        if (!typingMap.value.has(convID)) {
          typingMap.value.set(convID, new Set())
        }
        const set = typingMap.value.get(convID)!
        if (typingData.status === 'start') {
          set.add(msg.sendID)
          setTimeout(() => {
            set.delete(msg.sendID)
          }, 5000)
        } else {
          set.delete(msg.sendID)
        }
      }
    } catch (e) { /* ignore */ }
  }

  function calcUnread() {
    unreadTotal.value = conversations.value.reduce(
      (sum: number, c: any) => sum + (c.unreadCount || 0), 0
    )
  }

  async function connect(userID: string, token: string, phoneNumber = '', email = '', company = '') {
    imUserID.value = userID
    imToken.value = token
    imPhoneNumber.value = phoneNumber
    imEmail.value = email
    imCompany.value = company
    isLoggingIn.value = true
    isSyncFinished.value = false
    try {
      setupListeners()
      console.log('🚀 IM 开始登录, userID:', userID)
      await loginIM(userID, token)
      isConnected.value = true
      console.log('🚀 IM 登录成功，等待 OnSyncServerFinish 后加载数据...')
    } catch (e: any) {
      console.error('🚀 IM 连接流程异常:', e)
      isConnected.value = false
      throw e
    } finally {
      isLoggingIn.value = false
    }
  }

  async function disconnect() {
    await logoutIM()
    isConnected.value = false
    isSyncFinished.value = false
    conversations.value = []
    currentConversation.value = null
    messages.value = []
    friends.value = []
    friendApplicationsRecv.value = []
    friendApplicationsSent.value = []
    selfInfo.value = null
    unreadTotal.value = 0
    pendingFriendCount.value = 0
  }

  async function loadConversations() {
    const sdk = getOpenIM()
    const { data } = await sdk.getConversationListSplit({
      offset: 0,
      count: 100,
    })
    conversations.value = data ?? []
    calcUnread()
  }

  async function loadMessages(conversationID: string, startClientMsgID = '') {
    const sdk = getOpenIM()
    const { data } = await sdk.getAdvancedHistoryMessageList({
      conversationID,
      startClientMsgID,
      count: 20,
    })
    if (startClientMsgID) {
      messages.value = [...(data?.messageList ?? []), ...messages.value]
    } else {
      messages.value = data?.messageList ?? []
    }
    return data?.isEnd ?? true
  }

  function pushMessageDedup(msg: any) {
    if (!msg?.clientMsgID) return
    const exists = messages.value.some((m: any) => m.clientMsgID === msg.clientMsgID)
    if (!exists) messages.value.push(msg)
  }

  async function sendTextMessage(recvID: string, groupID: string, text: string) {
    const sdk = getOpenIM()
    const msgData = await sdk.createTextMessage(text)
    const res = await sdk.sendMessage({
      message: msgData.data!,
      recvID,
      groupID,
      offlinePushInfo: {
        title: '新消息',
        desc: text.slice(0, 50),
        ex: '',
        iOSPushSound: '',
        iOSBadgeCount: true,
        signalInfo: '',
      },
    })
    if (res.data) pushMessageDedup(res.data)
    return res.data
  }

  async function markConversationRead(conversationID: string) {
    const sdk = getOpenIM()
    try {
      await sdk.markConversationMessageAsRead(conversationID)
    } catch (e: any) {
      if (e?.errCode !== 10002) console.warn('标记已读失败:', e)
    }
    const conv = conversations.value.find(c => c.conversationID === conversationID)
    if (conv) {
      conv.unreadCount = 0
      calcUnread()
    }
  }

  function selectConversation(conv: any) {
    currentConversation.value = conv
  }

  function isTyping(conversationID: string): boolean {
    const set = typingMap.value.get(conversationID)
    return !!set && set.size > 0
  }

  // ========== 好友相关 ==========

  async function loadFriends() {
    const sdk = getOpenIM()
    try {
      const fn = (sdk as any).getFriendListPage || (sdk as any).getFriendList
      const res = await fn({ offset: 0, count: 1000 })
      const list = res.data ?? []
      friends.value = list.map((item: any) => item.friendInfo ?? item)
      console.log('📋 好友列表已加载，数量:', friends.value.length)
    } catch (e) {
      console.error('❌ 加载好友列表失败:', e)
    }
  }

  async function loadFriendApplications() {
    const sdk = getOpenIM()
    try {
      const pageParams = { offset: 0, count: 100 }
      const [recv, sent] = await Promise.all([
        sdk.getFriendApplicationListAsRecipient(pageParams as any),
        sdk.getFriendApplicationListAsApplicant(pageParams as any),
      ])
      const friendIDs = new Set(friends.value.map((f: any) => f.userID || f.friendUserID))
      friendApplicationsRecv.value = (recv.data ?? []).map((app: any) => {
        if (app.handleResult === 0 && friendIDs.has(app.fromUserID)) return { ...app, handleResult: 1 }
        return app
      })
      friendApplicationsSent.value = (sent.data ?? []).map((app: any) => {
        if (app.handleResult === 0 && friendIDs.has(app.toUserID)) return { ...app, handleResult: 1 }
        return app
      })
      pendingFriendCount.value = friendApplicationsRecv.value.filter(
        (app: any) => app.handleResult === 0
      ).length
    } catch (e) {
      console.warn('加载好友申请失败:', e)
    }
  }

  async function searchUsers(keyword: string) {
    const res = await window.electronAPI.im.searchUsers(keyword, imToken.value)
    if (res.success && res.users) {
      return res.users
    }
    console.warn('搜索用户失败:', res.error, res.raw)
    throw new Error(res.error || '搜索失败')
  }

  async function addFriend(userID: string, reqMsg: string = '') {
    const sdk = getOpenIM()
    await sdk.addFriend({
      toUserID: userID,
      reqMsg,
    })
  }

  async function acceptFriendApplication(fromUserID: string, handleMsg: string = '') {
    const sdk = getOpenIM()
    await sdk.acceptFriendApplication({
      toUserID: fromUserID,
      handleMsg,
    })
    await loadFriends()
    await loadFriendApplications()
    await loadConversations()
  }

  async function refuseFriendApplication(fromUserID: string, handleMsg: string = '') {
    const sdk = getOpenIM()
    await sdk.refuseFriendApplication({
      toUserID: fromUserID,
      handleMsg,
    })
    await loadFriendApplications()
  }

  async function deleteFriend(userID: string) {
    const sdk = getOpenIM()
    await sdk.deleteFriend(userID)
    await loadFriends()
    await loadFriendApplications()
  }

  function isFriend(userID: string): boolean {
    return friends.value.some((f: any) => (f.userID || f.friendUserID) === userID)
  }

  function clearFriendEventUnread() {
    friendEventUnread.value = 0
  }

  async function loadSelfInfo() {
    const sdk = getOpenIM()
    try {
      const { data } = await sdk.getSelfUserInfo()
      selfInfo.value = data
    } catch (e) {
      console.warn('❌ 加载个人信息失败:', e)
    }
  }

  async function updateSelfInfo(info: { nickname?: string; faceURL?: string; phoneNumber?: string; ex?: string }) {
    const sdk = getOpenIM()
    await sdk.setSelfInfo(info)
    await loadSelfInfo()
  }

  // ========== 文件上传 ==========

  async function uploadFileToServer(file: File): Promise<string> {
    const sdk = getOpenIM()
    const uuid = crypto.randomUUID()
    const ext = file.name?.split('.').pop() || file.type.split('/')[1] || 'bin'
    const name = `${uuid}.${ext}`

    console.log(`📤 开始上传文件: ${name} (原名: ${file.name}, ${(file.size / 1024).toFixed(1)}KB, ${file.type})`)

    const res = await sdk.uploadFile({
      name,
      contentType: file.type,
      uuid,
      file,
    })

    const url = res.data?.url
    if (!url) {
      console.error('❌ 上传返回空URL:', res)
      throw new Error('文件上传失败：服务器未返回URL')
    }

    console.log(`✅ 上传成功: ${url}`)
    return url
  }

  // ========== 多媒体消息发送 ==========

  async function sendImageMessage(recvID: string, groupID: string, file: File) {
    const sdk = getOpenIM()
    const url = await uploadFileToServer(file)
    const { width, height } = await getImageDimensions(file)
    const uuid = crypto.randomUUID()

    const picInfo = {
      uuid,
      type: file.type,
      size: file.size,
      width,
      height,
      url,
    }
    const msgData = await sdk.createImageMessageByURL({
      sourcePicture: picInfo,
      bigPicture: picInfo,
      snapshotPicture: picInfo,
      sourcePath: '',
    })
    const res = await sdk.sendMessageNotOss({
      message: msgData.data!,
      recvID,
      groupID,
      offlinePushInfo: { title: '新消息', desc: '[图片]', ex: '', iOSPushSound: '', iOSBadgeCount: true, signalInfo: '' },
    })
    if (res.data) {
      console.log('🖼️ 图片消息发送成功, pictureElem:', JSON.stringify(res.data.pictureElem || null).slice(0, 500))
      pushMessageDedup(res.data)
    }
    return res.data
  }

  async function sendFileMessage(recvID: string, groupID: string, file: File) {
    const sdk = getOpenIM()
    const url = await uploadFileToServer(file)

    const msgData = await sdk.createFileMessageByURL({
      filePath: '',
      fileName: file.name,
      uuid: crypto.randomUUID(),
      sourceUrl: url,
      fileSize: file.size,
      fileType: file.type,
    })
    const res = await sdk.sendMessageNotOss({
      message: msgData.data!,
      recvID,
      groupID,
      offlinePushInfo: { title: '新消息', desc: '[文件]', ex: '', iOSPushSound: '', iOSBadgeCount: true, signalInfo: '' },
    })
    if (res.data) pushMessageDedup(res.data)
    return res.data
  }

  async function sendSoundMessage(recvID: string, groupID: string, file: File, duration: number) {
    const sdk = getOpenIM()
    const url = await uploadFileToServer(file)

    const msgData = await sdk.createSoundMessageByURL({
      uuid: crypto.randomUUID(),
      soundPath: '',
      sourceUrl: url,
      dataSize: file.size,
      duration,
      soundType: file.type || 'audio/webm',
    })
    const res = await sdk.sendMessageNotOss({
      message: msgData.data!,
      recvID,
      groupID,
      offlinePushInfo: { title: '新消息', desc: '[语音]', ex: '', iOSPushSound: '', iOSBadgeCount: true, signalInfo: '' },
    })
    if (res.data) pushMessageDedup(res.data)
    return res.data
  }

  async function sendQuoteMessage(recvID: string, groupID: string, text: string, quotedMsg: any) {
    const sdk = getOpenIM()
    const rawMsg = JSON.parse(JSON.stringify(toRaw(quotedMsg)))
    const msgData = await sdk.createQuoteMessage({
      text,
      message: rawMsg,
    })
    const res = await sdk.sendMessage({
      message: msgData.data!,
      recvID,
      groupID,
      offlinePushInfo: { title: '新消息', desc: text.slice(0, 50), ex: '', iOSPushSound: '', iOSBadgeCount: true, signalInfo: '' },
    })
    if (res.data) pushMessageDedup(res.data)
    return res.data
  }

  async function sendImageTextMessage(
    recvID: string,
    groupID: string,
    files: File[],
    text: string
  ) {
    const sdk = getOpenIM()

    const fileSnapshots: { buffer: ArrayBuffer; name: string; type: string; size: number }[] = []
    for (const file of files) {
      fileSnapshots.push({
        buffer: await file.arrayBuffer(),
        name: file.name,
        type: file.type,
        size: file.size,
      })
    }

    const images = []
    for (let i = 0; i < fileSnapshots.length; i++) {
      const snap = fileSnapshots[i]
      const clonedFile = new File([snap.buffer], `upload_${i}_${Date.now()}.${snap.name.split('.').pop() || 'png'}`, { type: snap.type })
      console.log(`[ImageText] 上传第 ${i + 1}/${fileSnapshots.length} 张: size=${clonedFile.size}`)
      const url = await uploadFileToServer(clonedFile)
      console.log(`[ImageText] 第 ${i + 1} 张上传完成, URL: ${url}`)
      const { width, height } = await getImageDimensions(new File([snap.buffer], snap.name, { type: snap.type }))
      images.push({ url, width, height, name: snap.name, size: snap.size, type: snap.type })
    }

    console.log(`[ImageText] 共 ${images.length} 张图, URLs:`, images.map(i => i.url))

    const customData = JSON.stringify({
      contentType: 'imageText',
      images,
      text,
    })

    const msgData = await sdk.createCustomMessage({
      data: customData,
      extension: 'imageText',
      description: text || '[图文消息]',
    })

    const res = await sdk.sendMessage({
      message: msgData.data!,
      recvID,
      groupID,
      offlinePushInfo: {
        title: '新消息',
        desc: text ? text.slice(0, 50) : '[图文消息]',
        ex: '',
        iOSPushSound: '',
        iOSBadgeCount: true,
        signalInfo: '',
      },
    })
    if (res.data) pushMessageDedup(res.data)
    return res.data
  }

  async function sendAtMessage(groupID: string, text: string, atUserIDList: string[], atUsersInfo: { atUserID: string; groupNickname: string }[]) {
    const sdk = getOpenIM()
    const msgData = await sdk.createTextAtMessage({
      text,
      atUserIDList,
      atUsersInfo,
    })
    const res = await sdk.sendMessage({
      message: msgData.data!,
      recvID: '',
      groupID,
      offlinePushInfo: { title: '新消息', desc: text.slice(0, 50), ex: '', iOSPushSound: '', iOSBadgeCount: true, signalInfo: '' },
    })
    if (res.data) pushMessageDedup(res.data)
    return res.data
  }

  async function loadGroupMembers(groupID: string) {
    const sdk = getOpenIM()
    const { data } = await sdk.getGroupMemberList({
      groupID,
      filter: 0,
      offset: 0,
      count: 200,
    })
    return data ?? []
  }

  function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
        URL.revokeObjectURL(img.src)
      }
      img.onerror = () => {
        resolve({ width: 0, height: 0 })
        URL.revokeObjectURL(img.src)
      }
      img.src = URL.createObjectURL(file)
    })
  }

  async function revokeMessage(conversationID: string, clientMsgID: string) {
    const sdk = getOpenIM()
    await sdk.revokeMessage({ conversationID, clientMsgID })
    const idx = messages.value.findIndex((m: any) => m.clientMsgID === clientMsgID)
    if (idx >= 0) {
      messages.value[idx] = { ...messages.value[idx], contentType: 2101 }
    }
  }

  function deleteLocalMessage(clientMsgID: string) {
    const idx = messages.value.findIndex((m: any) => m.clientMsgID === clientMsgID)
    if (idx >= 0) messages.value.splice(idx, 1)
  }

  async function forwardSingleMessage(msg: any, recvID: string, groupID: string) {
    const sdk = getOpenIM()
    const rawMsg = JSON.parse(JSON.stringify(toRaw(msg)))
    const res = await sdk.sendMessage({
      message: rawMsg,
      recvID,
      groupID,
      offlinePushInfo: { title: '新消息', desc: '[转发消息]', ex: '', iOSPushSound: '', iOSBadgeCount: true, signalInfo: '' },
    })
    if (res.data) pushMessageDedup(res.data)
    return res.data
  }

  async function forwardMergeMessages(msgList: any[], recvID: string, groupID: string, title: string, summaryList: string[]) {
    const sdk = getOpenIM()
    const rawMsgList = JSON.parse(JSON.stringify(msgList.map(m => toRaw(m))))
    const msgData = await sdk.createMergerMessage({
      messageList: rawMsgList,
      title,
      summaryList,
    })
    const res = await sdk.sendMessage({
      message: msgData.data!,
      recvID,
      groupID,
      offlinePushInfo: { title: '新消息', desc: '[聊天记录]', ex: '', iOSPushSound: '', iOSBadgeCount: true, signalInfo: '' },
    })
    if (res.data) pushMessageDedup(res.data)
    return res.data
  }

  async function startChat(userID: string) {
    const sdk = getOpenIM()
    const { data } = await sdk.getOneConversation({
      sourceID: userID,
      sessionType: 1,
    })
    if (data) {
      currentConversation.value = data
      const idx = conversations.value.findIndex(c => c.conversationID === data.conversationID)
      if (idx < 0) {
        conversations.value.unshift(data)
      }
    }
    return data
  }

  return {
    conversations, currentConversation, messages,
    isConnected, isLoggingIn, isSyncFinished, unreadTotal,
    imUserID, imToken, imPhoneNumber, imEmail, imCompany, typingMap,
    friends, friendApplicationsRecv, friendApplicationsSent,
    selfInfo, pendingFriendCount, friendEventUnread, friendEventTab, clearFriendEventUnread,
    connect, disconnect, loadAllData,
    loadConversations, loadMessages,
    sendTextMessage, sendImageMessage, sendFileMessage,
    sendSoundMessage, sendQuoteMessage, sendAtMessage, sendImageTextMessage,
    loadGroupMembers, markConversationRead,
    selectConversation, isTyping,
    revokeMessage, deleteLocalMessage, forwardSingleMessage, forwardMergeMessages,
    loadFriends, loadFriendApplications,
    searchUsers, addFriend,
    acceptFriendApplication, refuseFriendApplication, deleteFriend, isFriend,
    loadSelfInfo, updateSelfInfo, startChat,
  }
})
