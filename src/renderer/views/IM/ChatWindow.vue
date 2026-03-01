<template>
  <div class="chat-window" @click="closeContextMenu">
    <div class="chat-header">
      <span class="chat-title">{{ conversation?.showName || '聊天' }}</span>
      <el-tag v-if="conversation?.groupID" size="small" type="info">群聊</el-tag>
    </div>

    <div class="chat-body" :class="{ 'multi-select-active': multiSelectMode }" ref="chatBodyRef" @scroll="handleScroll">
      <div v-if="loadingMore" class="load-more-tip">
        <el-icon class="is-loading"><Loading /></el-icon>
        加载中...
      </div>

      <template v-for="(msg, idx) in displayMessages" :key="msg.clientMsgID">
        <div v-if="shouldShowTime(msg, idx)" class="msg-time-divider">
          <span>{{ formatMsgTime(msg.sendTime) }}</span>
        </div>

        <!-- 撤回消息 -->
        <div v-if="msg.contentType === 2101" class="msg-notification">
          <span>{{ getRevokeText(msg) }}</span>
        </div>

        <!-- 系统通知 -->
        <div v-else-if="isNotification(msg)" class="msg-notification">
          <span>{{ getNotificationText(msg) }}</span>
        </div>

        <!-- 系统提示 -->
        <div v-else-if="msg.contentType === 9999" class="msg-system-tip">
          <span>{{ msg.tipText }}</span>
        </div>

        <!-- 普通消息 -->
        <div
          v-else
          class="msg-item"
          :class="{ 'msg-item-self': isSelf(msg), 'msg-item-selected': multiSelectMode && isSelected(msg), 'msg-item-failed': msg.status === 3 }"
          @contextmenu.prevent="onMsgContextMenu($event, msg)"
          @click="multiSelectMode && toggleSelect(msg)"
        >
          <!-- 多选复选框 -->
          <div v-if="multiSelectMode" class="msg-checkbox" @click.stop="toggleSelect(msg)">
            <div class="checkbox-inner" :class="{ checked: isSelected(msg) }">
              <el-icon v-if="isSelected(msg)" :size="14"><Check /></el-icon>
            </div>
          </div>

          <Bubble
            :content="isTextLike(msg) ? getMsgContent(msg) : undefined"
            :placement="isSelf(msg) ? 'end' : 'start'"
            shape="corner"
            :is-markdown="isMarkdownMsg(msg)"
          >
            <template #avatar>
              <el-avatar
                :size="36"
                :src="msg.senderFaceURL || undefined"
                :style="{ background: isSelf(msg) ? '#4a90d9' : '#7c4dff' }"
              >
                {{ getAvatarChar(msg) }}
              </el-avatar>
            </template>
            <template #header v-if="!isSelf(msg)">
              <span class="msg-sender-name">{{ msg.senderNickname || msg.sendID }}</span>
            </template>

            <template #content v-if="!isTextLike(msg)">
              <!-- 图片消息 -->
              <div v-if="msg.contentType === 102" class="msg-image">
                <el-image
                  v-if="getImageUrl(msg)"
                  :src="getImageUrl(msg)"
                  :preview-src-list="[getImageBigUrl(msg)]"
                  fit="cover"
                  :style="getImageStyle(msg)"
                  preview-teleported
                >
                  <template #error>
                    <div class="msg-image-fail">
                      <el-icon :size="24"><Picture /></el-icon>
                      <span>图片加载失败</span>
                    </div>
                  </template>
                </el-image>
                <div v-else class="msg-image-fail">
                  <el-icon :size="24"><Picture /></el-icon>
                  <span>图片无法显示</span>
                </div>
              </div>

              <!-- 语音消息 -->
              <div v-else-if="msg.contentType === 103" class="msg-voice" @click="toggleAudio(msg)">
                <el-icon v-if="playingMsgId === msg.clientMsgID" class="voice-icon playing"><VideoPlay /></el-icon>
                <el-icon v-else class="voice-icon"><Microphone /></el-icon>
                <div class="voice-bar">
                  <div class="voice-progress" :style="{ width: playingMsgId === msg.clientMsgID ? audioProgress + '%' : '0%' }"></div>
                </div>
                <span class="voice-duration">{{ msg.soundElem?.duration || 0 }}″</span>
              </div>

              <!-- 文件消息 -->
              <div v-else-if="msg.contentType === 105" class="msg-file" @click="previewFile(msg)">
                <span class="file-type-svg" v-html="getFileSvgIcon(msg.fileElem?.fileName)"></span>
                <div class="file-info">
                  <span class="file-name">{{ msg.fileElem?.fileName || '未知文件' }}</span>
                  <span class="file-size">{{ formatFileSize(msg.fileElem?.fileSize || 0) }}</span>
                </div>
                <el-button link type="primary" @click.stop="downloadFile(msg)" title="下载">
                  <el-icon><Download /></el-icon>
                </el-button>
              </div>

              <!-- 引用消息 -->
              <div v-else-if="msg.contentType === 114" class="msg-quote">
                <div class="quote-block" v-if="msg.quoteElem?.quoteMessage">
                  <span class="quote-sender">{{ msg.quoteElem.quoteMessage.senderNickname }}:</span>
                  <template v-if="msg.quoteElem.quoteMessage.contentType === 102">
                    <el-image
                      class="quote-thumb"
                      :src="getImageUrl(msg.quoteElem.quoteMessage)"
                      :preview-src-list="[getImageBigUrl(msg.quoteElem.quoteMessage)]"
                      fit="cover"
                      preview-teleported
                    />
                  </template>
                  <template v-else-if="msg.quoteElem.quoteMessage.contentType === 110 && isImageTextMsg(msg.quoteElem.quoteMessage)">
                    <div class="quote-imagetext">
                      <el-image
                        v-for="(img, qi) in getImageTextImages(msg.quoteElem.quoteMessage)"
                        :key="qi"
                        class="quote-thumb"
                        :src="rewriteMediaUrl(img.url)"
                        :preview-src-list="getImageTextImages(msg.quoteElem.quoteMessage).map(i => rewriteMediaUrl(i.url))"
                        :initial-index="qi"
                        fit="cover"
                        preview-teleported
                      />
                      <span class="quote-text" v-if="getImageTextContent(msg.quoteElem.quoteMessage)">{{ getImageTextContent(msg.quoteElem.quoteMessage) }}</span>
                    </div>
                  </template>
                  <template v-else-if="msg.quoteElem.quoteMessage.contentType === 105">
                    <span class="quote-file">
                      <el-icon :size="14"><Document /></el-icon>
                      {{ msg.quoteElem.quoteMessage.fileElem?.fileName || '文件' }}
                    </span>
                  </template>
                  <template v-else-if="msg.quoteElem.quoteMessage.contentType === 103">
                    <span class="quote-voice">
                      <el-icon :size="14"><Microphone /></el-icon>
                      语音 {{ msg.quoteElem.quoteMessage.soundElem?.duration || 0 }}s
                    </span>
                  </template>
                  <template v-else>
                    <span class="quote-text">{{ getQuotedText(msg.quoteElem.quoteMessage) }}</span>
                  </template>
                </div>
                <div class="quote-reply">{{ msg.quoteElem?.text || '' }}</div>
              </div>

              <!-- @消息 -->
              <div v-else-if="msg.contentType === 106" class="msg-at" v-html="renderAtText(msg)"></div>

              <!-- 合并转发消息 -->
              <div v-else-if="msg.contentType === 107" class="msg-merge" @click="openMergeDetail(msg)">
                <div class="merge-title">{{ msg.mergeElem?.title || '聊天记录' }}</div>
                <div class="merge-summary">
                  <div v-for="(line, i) in (msg.mergeElem?.abstractList || []).slice(0, 4)" :key="i" class="merge-line">{{ line }}</div>
                </div>
                <div class="merge-footer">聊天记录</div>
              </div>

              <!-- 图文组合消息 -->
              <div v-else-if="msg.contentType === 110 && isImageTextMsg(msg)" class="msg-image-text">
                <div v-for="(img, imgIdx) in getImageTextImages(msg)" :key="imgIdx" class="msg-image">
                  <el-image
                    :src="rewriteMediaUrl(img.url)"
                    :preview-src-list="[rewriteMediaUrl(img.url)]"
                    fit="cover"
                    :style="getInlineImageStyle(img)"
                    preview-teleported
                  >
                    <template #error>
                      <div class="msg-image-fail">
                        <el-icon :size="24"><Picture /></el-icon>
                        <span>图片加载失败</span>
                      </div>
                    </template>
                  </el-image>
                </div>
                <div class="image-text-content" v-if="getImageTextContent(msg)">{{ getImageTextContent(msg) }}</div>
              </div>

              <!-- 兜底 -->
              <span v-else>{{ getMsgContent(msg) }}</span>
            </template>
          </Bubble>
        </div>
        <div v-if="msg.status === 3" class="msg-fail-row">
          <div class="msg-fail-icon">
            <el-icon color="#f56c6c" :size="14"><WarningFilled /></el-icon>
          </div>
          <span class="msg-fail-text">{{ msg.failReason || '发送失败' }}</span>
        </div>
      </template>

      <div v-if="showTyping" class="typing-row">
        <Thinking text="正在输入" />
      </div>
    </div>

    <!-- 多选操作栏 -->
    <div v-if="multiSelectMode" class="multi-select-bar">
      <span class="multi-select-count">已选 {{ selectedMsgIds.size }} 条</span>
      <el-button @click="exitMultiSelect">取消</el-button>
      <el-button type="primary" plain :disabled="selectedMsgIds.size === 0" @click="forwardOneByOne">逐条转发</el-button>
      <el-button type="primary" :disabled="selectedMsgIds.size === 0" @click="forwardMerge">合并转发</el-button>
    </div>

    <!-- 正常输入区（微信风格） -->
    <div v-else class="chat-footer" :style="{ height: footerHeight + 'px' }">
      <div class="resize-handle" @mousedown="onResizeStart"></div>

      <div v-if="quotedMsg" class="quote-preview">
        <div class="quote-preview-content">
          <span class="quote-preview-name">{{ quotedMsg.senderNickname }}:</span>
          <template v-if="quotedMsg.contentType === 102">
            <el-image class="quote-preview-thumb" :src="getImageUrl(quotedMsg)" fit="cover" />
          </template>
          <template v-else-if="quotedMsg.contentType === 110 && isImageTextMsg(quotedMsg)">
            <el-image
              v-if="getImageTextImages(quotedMsg).length"
              class="quote-preview-thumb"
              :src="rewriteMediaUrl(getImageTextImages(quotedMsg)[0].url)"
              fit="cover"
            />
            <span class="quote-preview-text" v-if="getImageTextContent(quotedMsg)">{{ getImageTextContent(quotedMsg) }}</span>
          </template>
          <template v-else-if="quotedMsg.contentType === 105">
            <span class="quote-preview-file">
              <el-icon :size="14"><Document /></el-icon>
              {{ quotedMsg.fileElem?.fileName || '文件' }}
            </span>
          </template>
          <template v-else-if="quotedMsg.contentType === 103">
            <span class="quote-preview-voice">
              <el-icon :size="14"><Microphone /></el-icon>
              语音 {{ quotedMsg.soundElem?.duration || 0 }}s
            </span>
          </template>
          <template v-else>
            <span class="quote-preview-text">{{ getQuotedText(quotedMsg) }}</span>
          </template>
        </div>
        <el-icon class="quote-preview-close" @click="clearQuote"><Close /></el-icon>
      </div>

      <div v-if="isRecording" class="recording-bar">
        <div class="recording-dot"></div>
        <span class="recording-text">录音中 {{ recordingDuration }}s</span>
        <el-button size="small" type="danger" plain @click="cancelRecording">取消</el-button>
        <el-button size="small" type="primary" @click="stopAndSendRecording">发送</el-button>
      </div>

      <div class="wechat-toolbar">
        <el-popover
          v-model:visible="emojiPopoverVisible"
          trigger="click"
          placement="top-start"
          :width="340"
          :teleported="true"
          :popper-options="{ modifiers: [{ name: 'offset', options: { offset: [0, 8] } }] }"
        >
          <template #reference>
            <span class="toolbar-btn" title="表情"><svg viewBox="0 0 1024 1024" width="1em" height="1em"><circle cx="512" cy="512" r="436" fill="none" stroke="currentColor" stroke-width="56"/><circle cx="368" cy="420" r="44" fill="currentColor"/><circle cx="656" cy="420" r="44" fill="currentColor"/><path d="M352 600c0 88 72 160 160 160s160-72 160-160" fill="none" stroke="currentColor" stroke-width="56" stroke-linecap="round"/></svg></span>
          </template>
          <div class="emoji-panel">
            <span v-for="emoji in emojiList" :key="emoji" class="emoji-item" @click="insertEmoji(emoji)">{{ emoji }}</span>
          </div>
        </el-popover>

        <el-icon class="toolbar-btn" title="文件" @click="triggerFilePicker"><FolderOpened /></el-icon>
        <el-icon class="toolbar-btn" title="语音" @click="toggleRecording"><Microphone /></el-icon>
        <span v-if="isGroup" class="toolbar-btn toolbar-btn-at" title="@提及" @click="insertAtSymbol">@</span>
      </div>

      <div class="pending-files-bar" v-if="pendingFiles.length">
        <div v-for="(pf, pfIdx) in pendingFiles" :key="pfIdx" class="pending-file-item">
          <div class="pending-file-info">
            <el-icon :size="20"><Document /></el-icon>
            <span class="pending-file-name">{{ pf.file.name }}</span>
          </div>
          <span class="pending-remove" @click="removePendingFile(pfIdx)">
            <el-icon :size="14"><Close /></el-icon>
          </span>
        </div>
      </div>

      <EditorSender
        v-show="!isRecording"
        ref="editorRef"
        :placeholder="''"
        :loading="sending"
        :disabled="sending"
        variant="updown"
        submit-type="enter"
        :user-list="editorUserList"
        @submit="handleEditorSubmit"
        @paste-file="handlePasteFile"
        @change="handleEditorChange"
      >
        <template #action-list><span></span></template>
        <template #footer>
          <div class="wechat-footer">
            <span
              class="wechat-send-btn"
              :class="{ disabled: cannotSend }"
              @click="handleSendClick"
            >发送(S)</span>
          </div>
        </template>
      </EditorSender>

      <input ref="fileInputRef" type="file" style="display:none" @change="handleFileSelected" />
    </div>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div v-if="ctxMenu.visible" class="msg-context-menu" :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }" @click.stop>
        <div class="ctx-menu-item" @click="ctxCopy">
          <el-icon><CopyDocument /></el-icon><span>复制</span>
        </div>
        <div class="ctx-menu-item" @click="ctxReply">
          <el-icon><ChatLineSquare /></el-icon><span>引用</span>
        </div>
        <div class="ctx-menu-item" @click="ctxForward">
          <el-icon><Promotion /></el-icon><span>转发</span>
        </div>
        <div class="ctx-menu-item" @click="ctxMultiSelect">
          <el-icon><Finished /></el-icon><span>多选</span>
        </div>
        <div v-if="ctxMenu.msg && isSelf(ctxMenu.msg)" class="ctx-menu-item" @click="ctxRevoke">
          <el-icon><RefreshLeft /></el-icon><span>撤回</span>
        </div>
        <div class="ctx-menu-item ctx-danger" @click="ctxDelete">
          <el-icon><Delete /></el-icon><span>删除</span>
        </div>
      </div>
    </Teleport>

    <!-- 转发目标选择 -->
    <el-dialog v-model="fwdDialogVisible" title="选择转发目标" width="420px" :append-to-body="true">
      <div class="forward-conv-list">
        <div
          v-for="conv in imStore.conversations"
          :key="conv.conversationID"
          class="forward-conv-item"
          @click="doForward(conv)"
        >
          <el-avatar :size="36" :src="conv.faceURL || undefined" :style="{ background: '#7c4dff' }">
            {{ (conv.showName || '?').slice(0, 1) }}
          </el-avatar>
          <span class="forward-conv-name">{{ conv.showName || conv.conversationID }}</span>
        </div>
        <div v-if="imStore.conversations.length === 0" class="forward-empty">暂无可转发的会话</div>
      </div>
    </el-dialog>

    <!-- 合并消息详情 -->
    <el-dialog v-model="mergeDetailVisible" :title="mergeDetailTitle" width="500px" :append-to-body="true">
      <div class="merge-detail-list">
        <div v-for="m in mergeDetailMessages" :key="m.clientMsgID" class="merge-detail-item">
          <el-avatar :size="28" :src="m.senderFaceUrl || undefined" :style="{ background: '#7c4dff', flexShrink: 0 }">
            {{ (m.senderNickname || '?').slice(0, 1) }}
          </el-avatar>
          <div class="merge-detail-body">
            <div class="merge-detail-header">
              <span class="merge-detail-name">{{ m.senderNickname || m.sendID }}</span>
              <span class="merge-detail-time">{{ formatMsgTime(m.sendTime) }}</span>
            </div>
            <div class="merge-detail-content">
              <template v-if="m.contentType === 101">{{ extractTextContent(m) }}</template>
              <template v-else-if="m.contentType === 102">
                <el-image
                  class="merge-detail-img"
                  :src="getImageUrl(m)"
                  :preview-src-list="[getImageBigUrl(m)]"
                  fit="cover"
                  preview-teleported
                />
              </template>
              <template v-else-if="m.contentType === 105">
                <span class="merge-detail-file"><el-icon :size="14"><Document /></el-icon> {{ m.fileElem?.fileName || '文件' }}</span>
              </template>
              <template v-else-if="m.contentType === 110 && isImageTextMsg(m)">
                <div class="merge-detail-imagetext">
                  <el-image
                    v-for="(img, ii) in getImageTextImages(m)"
                    :key="ii"
                    class="merge-detail-img"
                    :src="rewriteMediaUrl(img.url)"
                    :preview-src-list="getImageTextImages(m).map((x: any) => rewriteMediaUrl(x.url))"
                    :initial-index="ii"
                    fit="cover"
                    preview-teleported
                  />
                  <div v-if="getImageTextContent(m)">{{ getImageTextContent(m) }}</div>
                </div>
              </template>
              <template v-else>{{ getMsgContent(m) }}</template>
            </div>
          </div>
        </div>
        <div v-if="mergeDetailMessages.length === 0" class="merge-detail-empty">无消息记录</div>
      </div>
    </el-dialog>

    <!-- 文件预览弹窗 -->
    <Teleport to="body">
      <div v-if="previewVisible" class="fp-overlay" @click.self="onPreviewClose">
        <div
          class="fp-panel"
          ref="fpPanelRef"
          :style="{ width: fpW + 'px', height: fpH + 'px' }"
        >
          <div class="fp-header" @mousedown="onFpDragStart">
            <span class="fp-title" :title="previewMsg?.fileElem?.fileName">{{ previewMsg?.fileElem?.fileName || '文件预览' }}</span>
            <span class="fp-size">{{ formatFileSize(previewMsg?.fileElem?.fileSize || 0) }}</span>
            <el-button size="small" type="primary" plain @click="downloadFile(previewMsg)" style="margin-left:auto">
              <el-icon><Download /></el-icon> 下载
            </el-button>
            <el-button size="small" text @click="onPreviewClose" style="margin-left:4px;font-size:18px;">
              <el-icon><Close /></el-icon>
            </el-button>
          </div>

          <div class="fp-body">
            <div v-if="previewLoading" class="preview-loading-wrap">
              <el-icon class="is-loading" :size="36"><Loading /></el-icon>
              <span style="margin-top:12px;color:#999">文件加载中...</span>
            </div>
            <div v-else-if="previewType === 'image'" class="preview-image-wrap">
              <el-image :src="previewUrl" fit="contain" :preview-src-list="[previewUrl]" preview-teleported />
            </div>
            <iframe v-else-if="previewType === 'pdf' && previewUrl" :src="previewUrl" class="preview-iframe" />
            <video v-else-if="previewType === 'video' && previewUrl" :src="previewUrl" controls autoplay class="preview-video" />
            <div v-else-if="previewType === 'audio'" class="preview-audio-wrap">
              <div class="preview-audio-icon">🎵</div>
              <div class="preview-audio-name">{{ previewMsg?.fileElem?.fileName }}</div>
              <audio :src="previewUrl" controls autoplay class="preview-audio" />
            </div>
            <div v-else-if="previewType === 'text'" class="preview-text-wrap">
              <div v-if="previewTextLoading" class="preview-text-loading">
                <el-icon class="is-loading" :size="28"><Loading /></el-icon>
                <span>加载中...</span>
              </div>
              <pre v-else class="preview-text-content">{{ previewTextContent }}</pre>
            </div>
            <div v-else-if="previewType === 'word' || previewType === 'excel'" class="preview-office-render">
              <div v-html="previewOfficeHtml"></div>
            </div>
            <div v-else-if="previewType === 'office'" class="preview-unsupported">
              <span v-html="getFileSvgIcon(previewMsg?.fileElem?.fileName, 72)" style="margin-bottom:16px"></span>
              <p>暂不支持该格式的在线预览</p>
              <el-button type="primary" @click="downloadFile(previewMsg)">
                <el-icon><Download /></el-icon> 下载文件
              </el-button>
            </div>
          </div>

          <div class="fp-resize-handle" @mousedown.stop="onFpResizeStart"></div>
        </div>
      </div>
    </Teleport>

    <audio ref="audioRef" @ended="onAudioEnded" @timeupdate="onAudioTimeUpdate"></audio>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Loading, Microphone, Picture, Document, Download,
  ChatLineSquare, Close, VideoPlay, Promotion,
  CopyDocument, RefreshLeft, Delete, Finished, Check, FolderOpened, WarningFilled,
} from '@element-plus/icons-vue'
import { Bubble, EditorSender, Thinking } from 'vue-element-plus-x'
import { useIMStore } from '../../stores/imStore'
import { IM_CONFIG } from '../../config/imConfig'

const imStore = useIMStore()

// ========== 基础状态 ==========
const chatBodyRef = ref<HTMLElement | null>(null)
const editorRef = ref<any>(null)
const editorIsEmpty = ref(true)
const inlineFileMap = ref(new Map<string, File>())
const sending = ref(false)
const loadingMore = ref(false)
const isEnd = ref(false)

// ========== 输入区拖拽调高 ==========
const footerHeight = ref(160)
const isResizing = ref(false)
const resizeStartY = ref(0)
const resizeStartH = ref(0)
function onResizeStart(e: MouseEvent) {
  isResizing.value = true
  resizeStartY.value = e.clientY
  resizeStartH.value = footerHeight.value
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
}
function onResizeMove(e: MouseEvent) {
  if (!isResizing.value) return
  const delta = resizeStartY.value - e.clientY
  footerHeight.value = Math.min(400, Math.max(100, resizeStartH.value + delta))
}
function onResizeEnd() {
  isResizing.value = false
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
}

const conversation = computed(() => imStore.currentConversation)
const isGroup = computed(() => !!conversation.value?.groupID)

const pendingFiles = ref<{ file: File; type: 'file' }[]>([])

const showTyping = computed(() => {
  if (!conversation.value) return false
  return imStore.isTyping(conversation.value.conversationID)
})

const displayMessages = computed(() =>
  imStore.messages.filter((msg: any) => msg.contentType < 1000 || isNotification(msg) || msg.contentType === 2101)
)

// ========== 消息辅助函数 ==========
function isSelf(msg: any): boolean {
  return msg.sendID === imStore.imUserID
}

function getAvatarChar(msg: any): string {
  return (msg.senderNickname || '?').slice(0, 1)
}

function isNotification(msg: any): boolean {
  return msg.contentType >= 1000 && msg.contentType !== 2101
}

function isTextLike(msg: any): boolean {
  return msg.contentType === 101
}

function getNotificationText(msg: any): string {
  if (msg.contentType === 1201) return '已成为好友，可以开始聊天了'
  if (msg.contentType === 1200) return '好友申请已发送'
  if (msg.contentType === 1202) return '好友已删除'
  if (msg.contentType === 1500) return '群聊已创建'
  return '系统通知'
}

function extractTextContent(msg: any): string {
  if (msg.textElem?.content) return msg.textElem.content
  try {
    const parsed = JSON.parse(msg.content)
    return parsed.content || ''
  } catch {
    return msg.content || ''
  }
}

function getMsgContent(msg: any): string {
  if (msg.contentType === 101) return extractTextContent(msg)
  if (msg.contentType === 102) return '[图片]'
  if (msg.contentType === 103) return '[语音]'
  if (msg.contentType === 104) return '[视频]'
  if (msg.contentType === 105) return '[文件]'
  if (msg.contentType === 106) return msg.atTextElem?.text || '[提及消息]'
  if (msg.contentType === 107) return '[聊天记录]'
  if (msg.contentType === 110) return isImageTextMsg(msg) ? '[图文消息]' : '[自定义消息]'
  if (msg.contentType === 114) return '[引用消息]'
  return '[未知消息]'
}

function getMsgCopyText(msg: any): string {
  if (msg.contentType === 101) return extractTextContent(msg)
  if (msg.contentType === 106) return msg.atTextElem?.text || extractTextContent(msg)
  if (msg.contentType === 114) return msg.quoteElem?.text || ''
  if (msg.contentType === 110 && isImageTextMsg(msg)) return getImageTextContent(msg)
  return getMsgContent(msg)
}

function isMarkdownMsg(msg: any): boolean {
  if (msg.contentType !== 101) return false
  if (isSelf(msg)) return false
  const text = extractTextContent(msg)
  return /[#*`\[\]|>-]/.test(text)
}

// ========== 消息时间显示 ==========
const TIME_GAP_THRESHOLD = 5 * 60 * 1000

function shouldShowTime(msg: any, index: number): boolean {
  if (index === 0) return true
  const prevMsg = displayMessages.value[index - 1]
  if (!prevMsg?.sendTime || !msg.sendTime) return false
  return msg.sendTime - prevMsg.sendTime > TIME_GAP_THRESHOLD
}

function formatMsgTime(timestamp: number): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const Y = date.getFullYear()
  const M = String(date.getMonth() + 1).padStart(2, '0')
  const D = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${Y}-${M}-${D} ${h}:${m}:${s}`
}

// ========== 图文组合消息 ==========
function parseCustomData(msg: any): any {
  let result: any = {}
  try { if (msg.customElem?.data) { result = JSON.parse(msg.customElem.data); console.log('[parseCustomData] from customElem.data, images count:', result.images?.length, 'urls:', result.images?.map((i: any) => i.url?.slice(-30))); return result } } catch { /* */ }
  try { const w = JSON.parse(msg.content || '{}'); if (w.data) { result = JSON.parse(w.data); console.log('[parseCustomData] from content.data, images count:', result.images?.length); return result } } catch { /* */ }
  console.log('[parseCustomData] fallback empty, customElem:', !!msg.customElem, 'content:', msg.content?.slice(0, 100))
  return result
}
function isImageTextMsg(msg: any): boolean { return parseCustomData(msg).contentType === 'imageText' }
function getImageTextImages(msg: any): any[] { return parseCustomData(msg).images || [] }
function getImageTextContent(msg: any): string { return parseCustomData(msg).text || '' }

function getInlineImageStyle(img: any): Record<string, string> {
  if (!img.width || !img.height) return { maxWidth: '72px', maxHeight: '72px' }
  const maxW = 72, maxH = 72
  let w = img.width, h = img.height
  if (w > maxW) { h = h * maxW / w; w = maxW }
  if (h > maxH) { w = w * maxH / h; h = maxH }
  return { width: Math.round(w) + 'px', height: Math.round(h) + 'px', borderRadius: '8px' }
}

// ========== 撤回消息 ==========
function getRevokeText(msg: any): string {
  if (isSelf(msg)) return '你撤回了一条消息'
  try {
    const detail = JSON.parse(msg.notificationElem?.detail || '{}')
    return `${detail.revokerNickname || msg.senderNickname || '对方'}撤回了一条消息`
  } catch { return `${msg.senderNickname || '对方'}撤回了一条消息` }
}

// ========== 媒体 URL 重写 ==========
function rewriteMediaUrl(url: string): string {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    const apiUrl = new URL(IM_CONFIG.apiAddr)
    if (parsed.hostname === apiUrl.hostname && parsed.port === (apiUrl.port || '80')) return url
    return `${apiUrl.origin}${apiUrl.pathname}${parsed.pathname}${parsed.search}`
  } catch { return url }
}

// ========== 图片消息 ==========
function getImageUrl(msg: any): string {
  const pe = msg.pictureElem
  if (!pe) return ''
  return rewriteMediaUrl(pe.snapshotPicture?.url || pe.sourcePicture?.url || pe.bigPicture?.url || '')
}
function getImageBigUrl(msg: any): string {
  const pe = msg.pictureElem
  if (!pe) return ''
  return rewriteMediaUrl(pe.bigPicture?.url || pe.sourcePicture?.url || pe.snapshotPicture?.url || '')
}
function getImageStyle(msg: any): Record<string, string> {
  const pe = msg.pictureElem
  const pic = pe?.sourcePicture || pe?.snapshotPicture || pe?.bigPicture
  if (!pic?.width || !pic?.height) return { maxWidth: '72px', maxHeight: '72px' }
  const maxW = 72, maxH = 72
  let w = pic.width, h = pic.height
  if (w > maxW) { h = h * maxW / w; w = maxW }
  if (h > maxH) { w = w * maxH / h; h = maxH }
  return { width: Math.round(w) + 'px', height: Math.round(h) + 'px', borderRadius: '8px' }
}

// ========== 语音/文件 ==========
const audioRef = ref<HTMLAudioElement | null>(null)
const playingMsgId = ref<string | null>(null)
const audioProgress = ref(0)

function toggleAudio(msg: any) {
  const url = rewriteMediaUrl(msg.soundElem?.sourceUrl)
  if (!url || !audioRef.value) return
  if (playingMsgId.value === msg.clientMsgID) { audioRef.value.pause(); playingMsgId.value = null; audioProgress.value = 0; return }
  audioRef.value.src = url; audioRef.value.play(); playingMsgId.value = msg.clientMsgID; audioProgress.value = 0
}
function onAudioEnded() { playingMsgId.value = null; audioProgress.value = 0 }
function onAudioTimeUpdate() { if (audioRef.value?.duration) audioProgress.value = (audioRef.value.currentTime / audioRef.value.duration) * 100 }

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}
function downloadFile(msg: any) {
  const url = rewriteMediaUrl(msg.fileElem?.sourceUrl)
  if (!url) return
  const a = document.createElement('a'); a.href = url; a.download = msg.fileElem?.fileName || 'download'; a.target = '_blank'; a.click()
}

// ========== 文件预览 ==========
type FileCategory = 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'word' | 'excel' | 'office' | 'unknown'

const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico']
const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv']
const audioExts = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'wma', 'm4a']
const textExts = ['txt', 'json', 'csv', 'md', 'xml', 'yaml', 'yml', 'js', 'ts', 'py', 'sql', 'log', 'ini', 'conf', 'cfg', 'sh', 'bat', 'css', 'html', 'htm', 'java', 'c', 'cpp', 'h', 'go', 'rs', 'rb', 'php', 'vue', 'jsx', 'tsx', 'toml', 'env', 'gitignore', 'dockerfile']
const wordExts = ['doc', 'docx']
const excelExts = ['xls', 'xlsx']
const pptExts = ['ppt', 'pptx']

function getFileCategory(fileName: string): FileCategory {
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || ''
  if (imageExts.includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (videoExts.includes(ext)) return 'video'
  if (audioExts.includes(ext)) return 'audio'
  if (textExts.includes(ext)) return 'text'
  if (wordExts.includes(ext)) return 'word'
  if (excelExts.includes(ext)) return 'excel'
  if (pptExts.includes(ext)) return 'office'
  return 'unknown'
}

const _svgCache: Record<string, string> = {}
function getFileSvgIcon(fileName: string, size = 36): string {
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || ''
  const key = ext + size
  if (_svgCache[key]) return _svgCache[key]

  const pdf = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 56 56"><rect x="6" y="2" width="44" height="52" rx="4" fill="#E53935"/><path d="M16 36h24v2H16zm0 5h18v2H16z" fill="#fff" opacity=".5"/><path d="M21.5 16.5c-1.1 0-2 .7-2.4 1.7l-4.6 12.3h3l1.2-3.5h5.6l1.2 3.5h3l-4.6-12.3c-.4-1-1.3-1.7-2.4-1.7zm0 3.2l2 5.8h-4l2-5.8z" fill="#fff"/><path d="M33.5 16.5c-3.6 0-6.5 2.7-6.5 6s2.9 6 6.5 6h2.5v-2.5h-2.5c-2.2 0-4-1.6-4-3.5s1.8-3.5 4-3.5h2.5v-2.5h-2.5z" fill="#fff"/></svg>`
  const word = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 56 56"><rect x="6" y="2" width="44" height="52" rx="4" fill="#2B5797"/><path d="M17 18h4.2l3.3 13.5L28 18h3.5l3.5 13.5L38.3 18H42L36.5 38H33l-3.5-13L26 38h-3.5z" fill="#fff"/></svg>`
  const excel = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 56 56"><rect x="6" y="2" width="44" height="52" rx="4" fill="#1E7145"/><path d="M20 18l5.5 9L20 36h4.5l3.5-6 3.5 6H36l-5.5-9L36 18h-4.5L28 24l-3.5-6z" fill="#fff"/></svg>`
  const ppt = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 56 56"><rect x="6" y="2" width="44" height="52" rx="4" fill="#D24625"/><path d="M22 18v20h4v-7h4c3.3 0 6-2.7 6-6.5S33.3 18 30 18zm4 3.5h4c1.4 0 2.5 1.1 2.5 3s-1.1 3-2.5 3h-4z" fill="#fff"/></svg>`
  const video = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 56 56"><rect x="6" y="2" width="44" height="52" rx="4" fill="#7B1FA2"/><path d="M23 18v20l16-10z" fill="#fff"/></svg>`
  const audio = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 56 56"><rect x="6" y="2" width="44" height="52" rx="4" fill="#00897B"/><circle cx="24" cy="34" r="5" fill="#fff"/><path d="M29 34V17h8v4h-5v13" fill="#fff"/></svg>`
  const image = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 56 56"><rect x="6" y="2" width="44" height="52" rx="4" fill="#43A047"/><circle cx="22" cy="22" r="4" fill="#fff" opacity=".7"/><path d="M14 40l8-12 6 8 4-4 10 8z" fill="#fff" opacity=".8"/></svg>`
  const zip = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 56 56"><rect x="6" y="2" width="44" height="52" rx="4" fill="#F9A825"/><rect x="25" y="6" width="6" height="4" rx="1" fill="#fff" opacity=".6"/><rect x="25" y="14" width="6" height="4" rx="1" fill="#fff" opacity=".6"/><rect x="25" y="22" width="6" height="4" rx="1" fill="#fff" opacity=".6"/><rect x="23" y="30" width="10" height="14" rx="2" fill="#fff" opacity=".8"/><rect x="26" y="30" width="4" height="4" rx="1" fill="#F9A825"/></svg>`
  const text = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 56 56"><rect x="6" y="2" width="44" height="52" rx="4" fill="#757575"/><path d="M16 16h24v2H16zm0 6h24v2H16zm0 6h24v2H16zm0 6h18v2H16zm0 6h12v2H16z" fill="#fff" opacity=".6"/></svg>`
  const generic = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 56 56"><rect x="6" y="2" width="44" height="52" rx="4" fill="#B0BEC5"/><path d="M36 2l14 14H40a4 4 0 01-4-4z" fill="#90A4AE"/><path d="M16 28h24v2H16zm0 6h24v2H16zm0 6h18v2H16z" fill="#fff" opacity=".5"/></svg>`

  const map: Record<string, string> = {
    pdf, doc: word, docx: word,
    xls: excel, xlsx: excel, csv: excel,
    ppt, pptx: ppt,
    mp4: video, webm: video, mov: video, avi: video, mkv: video,
    mp3: audio, wav: audio, ogg: audio, aac: audio, flac: audio, wma: audio, m4a: audio,
    jpg: image, jpeg: image, png: image, gif: image, webp: image, bmp: image, svg: image, ico: image,
    zip, rar: zip, '7z': zip, tar: zip, gz: zip,
    txt: text, md: text, log: text, json: text, xml: text, yaml: text, yml: text,
    js: text, ts: text, py: text, java: text, go: text, rs: text, rb: text, php: text,
    vue: text, html: text, htm: text, css: text, sql: text, sh: text, bat: text,
    c: text, cpp: text, h: text, jsx: text, tsx: text, toml: text,
  }
  const svg = map[ext] || generic
  _svgCache[key] = svg
  return svg
}

const previewVisible = ref(false)
const previewMsg = ref<any>(null)
const previewType = ref<FileCategory>('unknown')
const previewUrl = ref('')
const previewTextContent = ref('')
const previewTextLoading = ref(false)
const previewLoading = ref(false)
const previewOfficeHtml = ref('')

async function previewFile(msg: any) {
  const fileName = msg.fileElem?.fileName || ''
  const category = getFileCategory(fileName)
  const url = rewriteMediaUrl(msg.fileElem?.sourceUrl)
  if (!url) return

  if (category === 'unknown') {
    downloadFile(msg)
    return
  }

  previewMsg.value = msg
  previewType.value = category
  previewTextContent.value = ''
  previewOfficeHtml.value = ''
  previewLoading.value = false

  if (['pdf', 'video', 'audio'].includes(category)) {
    previewLoading.value = true
    previewVisible.value = true
    try {
      const resp = await fetch(url)
      const blob = await resp.blob()
      if (previewUrl.value && previewUrl.value.startsWith('blob:')) URL.revokeObjectURL(previewUrl.value)
      previewUrl.value = URL.createObjectURL(blob)
    } catch {
      ElMessage.error('文件加载失败，请尝试下载')
      previewVisible.value = false
      return
    } finally {
      previewLoading.value = false
    }
  } else if (category === 'word') {
    previewLoading.value = true
    previewVisible.value = true
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (ext === 'doc') {
      try {
        const result = await window.electronAPI.shell.extractDoc(url)
        if (result.success && result.text) {
          const escaped = result.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          previewOfficeHtml.value = `<div style="white-space:pre-wrap;line-height:1.8;font-size:14px;color:#303133;">${escaped}</div>`
        } else {
          previewOfficeHtml.value = `<p style="color:#f56c6c;text-align:center;padding:40px;">文档解析失败：${result.error || '未知错误'}<br/>请尝试下载后查看</p>`
        }
      } catch (e: any) {
        previewOfficeHtml.value = `<p style="color:#f56c6c;text-align:center;padding:40px;">文档解析失败：${e.message || '未知错误'}<br/>请尝试下载后查看</p>`
      } finally {
        previewLoading.value = false
      }
    } else {
      try {
        const resp = await fetch(url)
        const arrayBuf = await resp.arrayBuffer()
        const mammoth = await import('mammoth')
        const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuf })
        previewOfficeHtml.value = result.value
      } catch (e: any) {
        previewOfficeHtml.value = `<p style="color:#f56c6c;text-align:center;padding:40px;">文档解析失败：${e.message || '未知错误'}<br/>请尝试下载后查看</p>`
      } finally {
        previewLoading.value = false
      }
    }
  } else if (category === 'excel') {
    previewLoading.value = true
    previewVisible.value = true
    try {
      const resp = await fetch(url)
      const arrayBuf = await resp.arrayBuffer()
      const XLSX = await import('xlsx')
      const wb = XLSX.read(arrayBuf, { type: 'array' })
      let html = ''
      for (const name of wb.SheetNames) {
        const ws = wb.Sheets[name]
        html += `<div class="sheet-tab">${name}</div>`
        html += XLSX.utils.sheet_to_html(ws, { editable: false })
      }
      previewOfficeHtml.value = html
    } catch (e: any) {
      previewOfficeHtml.value = `<p style="color:#f56c6c;text-align:center;padding:40px;">表格解析失败：${e.message || '未知错误'}<br/>请尝试下载后查看</p>`
    } finally {
      previewLoading.value = false
    }
  } else {
    previewUrl.value = url
    previewVisible.value = true
  }

  if (category === 'text') {
    loadTextContent(url)
  }
}

async function loadTextContent(url: string) {
  previewTextLoading.value = true
  try {
    const resp = await fetch(url)
    const size = Number(resp.headers.get('content-length') || 0)
    if (size > 1024 * 1024) {
      previewTextContent.value = '[ 文件超过 1MB，无法在线预览，请下载查看 ]'
      return
    }
    previewTextContent.value = await resp.text()
    if (previewTextContent.value.length > 500000) {
      previewTextContent.value = previewTextContent.value.slice(0, 500000) + '\n\n... [ 内容过长，已截断 ] ...'
    }
  } catch {
    previewTextContent.value = '[ 加载失败 ]'
  } finally {
    previewTextLoading.value = false
  }
}

function onPreviewClose() {
  if (previewUrl.value && previewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(previewUrl.value)
  }
  previewVisible.value = false
  previewMsg.value = null
  previewUrl.value = ''
  previewTextContent.value = ''
}

// ========== 预览面板拖拽 & 缩放 ==========
const fpPanelRef = ref<HTMLElement | null>(null)
const fpW = ref(Math.round(window.innerWidth * 0.7))
const fpH = ref(Math.round(window.innerHeight * 0.8))

function onFpDragStart(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('button')) return
  const panel = fpPanelRef.value
  if (!panel) return
  const rect = panel.getBoundingClientRect()
  const offX = e.clientX - rect.left
  const offY = e.clientY - rect.top
  const onMove = (ev: MouseEvent) => {
    let x = ev.clientX - offX
    let y = ev.clientY - offY
    x = Math.max(0, Math.min(x, window.innerWidth - rect.width))
    y = Math.max(0, Math.min(y, window.innerHeight - 40))
    panel.style.left = x + 'px'
    panel.style.top = y + 'px'
    panel.style.transform = 'none'
    panel.style.margin = '0'
  }
  const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function onFpResizeStart(e: MouseEvent) {
  const startX = e.clientX, startY = e.clientY
  const startW = fpW.value, startH = fpH.value
  const onMove = (ev: MouseEvent) => {
    fpW.value = Math.max(400, startW + ev.clientX - startX)
    fpH.value = Math.max(300, startH + ev.clientY - startY)
  }
  const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// ========== 引用消息 ==========
function getQuotedText(msg: any): string {
  if (!msg) return ''
  if (msg.contentType === 101) return extractTextContent(msg)
  if (msg.contentType === 106) return msg.atTextElem?.text || extractTextContent(msg)
  if (msg.contentType === 110 && isImageTextMsg(msg)) return getImageTextContent(msg) || '[图文消息]'
  if (msg.contentType === 114) return msg.quoteElem?.text || ''
  return getMsgContent(msg)
}
function renderAtText(msg: any): string {
  const text = msg.atTextElem?.text || extractTextContent(msg)
  const atList = msg.atTextElem?.atUsersInfo || []
  let html = escapeHtml(text)
  for (const u of atList) { const name = '@' + u.groupNickname; html = html.replace(escapeHtml(name), `<span class="at-highlight">${escapeHtml(name)}</span>`) }
  return html
}
function escapeHtml(str: string): string { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

const quotedMsg = ref<any>(null)
function setQuoteMsg(msg: any) { quotedMsg.value = msg; nextTick(() => editorRef.value?.focusToEnd()) }
function clearQuote() { quotedMsg.value = null }

// ========== 右键菜单 ==========
const ctxMenu = reactive({ visible: false, x: 0, y: 0, msg: null as any })

function onMsgContextMenu(e: MouseEvent, msg: any) {
  if (multiSelectMode.value) return
  ctxMenu.x = e.clientX
  ctxMenu.y = e.clientY
  ctxMenu.msg = msg
  ctxMenu.visible = true
}
function closeContextMenu() { ctxMenu.visible = false }

function ctxCopy() {
  navigator.clipboard.writeText(getMsgCopyText(ctxMenu.msg))
  ElMessage.success('已复制')
  closeContextMenu()
}
function ctxReply() { setQuoteMsg(ctxMenu.msg); closeContextMenu() }
function ctxForward() {
  fwdMsgs.value = [ctxMenu.msg]
  fwdMode.value = 'single'
  fwdDialogVisible.value = true
  closeContextMenu()
}
function ctxMultiSelect() {
  multiSelectMode.value = true
  selectedMsgIds.value.add(ctxMenu.msg.clientMsgID)
  closeContextMenu()
}
async function ctxRevoke() {
  if (!conversation.value || !ctxMenu.msg) return
  try {
    await imStore.revokeMessage(conversation.value.conversationID, ctxMenu.msg.clientMsgID)
    ElMessage.success('已撤回')
  } catch (e: any) { ElMessage.error('撤回失败: ' + (e.message || '')) }
  closeContextMenu()
}
function ctxDelete() {
  if (!ctxMenu.msg) return
  ElMessageBox.confirm('确定删除这条消息？', '删除消息', { type: 'warning' }).then(() => {
    imStore.deleteLocalMessage(ctxMenu.msg.clientMsgID)
    ElMessage.success('已删除')
  }).catch(() => {})
  closeContextMenu()
}

// ========== 多选模式 ==========
const multiSelectMode = ref(false)
const selectedMsgIds = ref(new Set<string>())

function isSelected(msg: any): boolean { return selectedMsgIds.value.has(msg.clientMsgID) }
function toggleSelect(msg: any) {
  if (selectedMsgIds.value.has(msg.clientMsgID)) selectedMsgIds.value.delete(msg.clientMsgID)
  else selectedMsgIds.value.add(msg.clientMsgID)
}
function exitMultiSelect() { multiSelectMode.value = false; selectedMsgIds.value.clear() }
function getSelectedMessages(): any[] {
  return displayMessages.value.filter((m: any) => selectedMsgIds.value.has(m.clientMsgID))
}

function forwardOneByOne() {
  const msgs = getSelectedMessages()
  if (msgs.length === 0) return
  fwdMsgs.value = msgs; fwdMode.value = 'oneByOne'; fwdDialogVisible.value = true
}
function forwardMerge() {
  const msgs = getSelectedMessages()
  if (msgs.length === 0) return
  fwdMsgs.value = msgs; fwdMode.value = 'merge'; fwdDialogVisible.value = true
}

// ========== 转发 ==========
const fwdDialogVisible = ref(false)
const fwdMsgs = ref<any[]>([])
const fwdMode = ref<'single' | 'oneByOne' | 'merge'>('single')

async function doForward(targetConv: any) {
  const recvID = targetConv.conversationType === 1 ? targetConv.userID : ''
  const groupID = targetConv.groupID || ''
  try {
    if (fwdMode.value === 'merge') {
      const title = `${conversation.value?.showName || ''} 的聊天记录`
      const summaryList = fwdMsgs.value.slice(0, 4).map((m: any) => `${m.senderNickname}: ${getMsgContent(m)}`)
      await imStore.forwardMergeMessages(fwdMsgs.value, recvID, groupID, title, summaryList)
    } else {
      for (const msg of fwdMsgs.value) {
        await imStore.forwardSingleMessage(msg, recvID, groupID)
      }
    }
    ElMessage.success('转发成功')
  } catch (e: any) { ElMessage.error('转发失败: ' + (e.message || '')) }
  fwdDialogVisible.value = false
  exitMultiSelect()
}

// ========== 合并消息详情 ==========
const mergeDetailVisible = ref(false)
const mergeDetailTitle = ref('')
const mergeDetailMessages = ref<any[]>([])
function openMergeDetail(msg: any) {
  mergeDetailTitle.value = msg.mergeElem?.title || '聊天记录'
  mergeDetailMessages.value = msg.mergeElem?.multiMessage || []
  mergeDetailVisible.value = true
}

// ========== EditorSender ==========
const groupMembers = ref<any[]>([])
const editorUserList = computed(() => {
  if (!isGroup.value) return []
  return groupMembers.value.filter((m: any) => m.userID !== imStore.imUserID).map((m: any) => ({ id: m.userID, name: m.nickname || m.userID }))
})
const cannotSend = computed(() => editorIsEmpty.value && pendingFiles.value.length === 0 && inlineFileMap.value.size === 0)
function handleEditorChange() { editorIsEmpty.value = editorRef.value?.chatState?.isEmpty ?? true }

function insertInlineImage(file: File) {
  const blobUrl = URL.createObjectURL(file)
  inlineFileMap.value.set(blobUrl, file)
  editorRef.value?.setHtml(`<img src="${blobUrl}" style="max-width:200px;max-height:150px;border-radius:6px;vertical-align:bottom;margin:2px 4px;" />`)
}
function cleanupInlineFiles() { for (const [url] of inlineFileMap.value) URL.revokeObjectURL(url); inlineFileMap.value.clear() }
function insertAtSymbol() { editorRef.value?.setText('@') }

const fileInputRef = ref<HTMLInputElement | null>(null)
function triggerFilePicker() { fileInputRef.value?.click() }
function addPendingFile(file: File) { pendingFiles.value.push({ file, type: 'file' }) }
function removePendingFile(index: number) { pendingFiles.value.splice(index, 1) }
function clearPendingFiles() { pendingFiles.value = [] }

function handleFileSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !conversation.value) return
  file.type.startsWith('image/') ? insertInlineImage(file) : addPendingFile(file)
  if (fileInputRef.value) fileInputRef.value.value = ''
}
function handlePasteFile(firstFile: File) {
  if (!firstFile || !conversation.value) return
  firstFile.type.startsWith('image/') ? insertInlineImage(firstFile) : addPendingFile(firstFile)
}

async function sendMedia(type: 'image' | 'file', file: File) {
  if (!conversation.value) return
  const recvID = conversation.value.conversationType === 1 ? conversation.value.userID : ''
  const groupID = conversation.value.groupID || ''
  type === 'image' ? await imStore.sendImageMessage(recvID, groupID, file) : await imStore.sendFileMessage(recvID, groupID, file)
}

// ========== 语音录制 ==========
const isRecording = ref(false)
const recordingDuration = ref(0)
let mediaRecorder: MediaRecorder | null = null
let recordedChunks: Blob[] = []
let recordingTimer: ReturnType<typeof setInterval> | null = null
let mediaStream: MediaStream | null = null

async function toggleRecording() { isRecording.value ? stopAndSendRecording() : await startRecording() }
async function startRecording() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder = new MediaRecorder(mediaStream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm',
    })
    recordedChunks = []; recordingDuration.value = 0
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data) }
    mediaRecorder.start(100)
    isRecording.value = true
    recordingTimer = setInterval(() => { recordingDuration.value++; if (recordingDuration.value >= 120) stopAndSendRecording() }, 1000)
  } catch (e: any) { ElMessage.error('无法访问麦克风: ' + (e.message || '')) }
}
function stopRecorderCleanup() {
  if (recordingTimer) { clearInterval(recordingTimer); recordingTimer = null }
  if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null }
  isRecording.value = false
}
async function stopAndSendRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return
  const duration = recordingDuration.value
  return new Promise<void>((resolve) => {
    mediaRecorder!.onstop = async () => {
      stopRecorderCleanup()
      if (recordedChunks.length === 0 || duration < 1) { ElMessage.warning('录音时间太短'); resolve(); return }
      const blob = new Blob(recordedChunks, { type: 'audio/webm' })
      const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' })
      sending.value = true
      try {
        const recvID = conversation.value?.conversationType === 1 ? conversation.value.userID : ''
        const groupID = conversation.value?.groupID || ''
        await imStore.sendSoundMessage(recvID, groupID, file, duration)
        await nextTick(); scrollToBottom()
      } catch (e: any) { ElMessage.error('语音发送失败: ' + (e.message || '')) }
      finally { sending.value = false }
      resolve()
    }
    mediaRecorder!.stop()
  })
}
function cancelRecording() { if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop(); stopRecorderCleanup(); recordedChunks = [] }

// ========== 表情 ==========
const emojiPopoverVisible = ref(false)
const emojiList = [
  '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😉','😊','😇','🥰','😍','🤩','😘',
  '😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏',
  '😒','🙄','😬','😮','😯','😲','😳','🥺','😢','😭','😤','😡','🤬','😈','👿','💀',
  '👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆',
  '👍','👎','✊','👊','🤛','🤜','👏','🙌','❤️','🧡','💛','💚','💙','💜','🖤','🤍',
  '💯','💢','💥','💫','💦','💨','🕊️','✨','🎉','🎊','🎈','🎁','🏆','🥇','🥈','🥉',
]
function insertEmoji(emoji: string) { editorRef.value?.setText(emoji); emojiPopoverVisible.value = false }

// ========== 发送消息 ==========
function handleSendClick() {
  const isEmpty = editorRef.value?.chatState?.isEmpty ?? true
  if (isEmpty && pendingFiles.value.length === 0 && inlineFileMap.value.size === 0) return
  handleEditorSubmit(editorRef.value?.getCurrentValue() || { text: '', html: '' })
}

async function handleEditorSubmit(result: any) {
  const { text, html, userTags } = result
  const imageFiles: File[] = []
  if (html) {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const allImgs = doc.querySelectorAll('img')
    console.log(`[Submit] HTML中找到 ${allImgs.length} 个img标签, inlineFileMap size: ${inlineFileMap.value.size}`)
    allImgs.forEach((img, idx) => {
      const src = img.getAttribute('src')
      const found = src ? inlineFileMap.value.has(src) : false
      console.log(`[Submit] img[${idx}] src=${src?.slice(0, 50)}, 在map中: ${found}`)
      if (src && inlineFileMap.value.has(src)) imageFiles.push(inlineFileMap.value.get(src)!)
    })
  }
  console.log(`[Submit] 最终提取到 ${imageFiles.length} 个图片文件, sizes:`, imageFiles.map(f => f.size))
  const hasImages = imageFiles.length > 0
  const hasPendingFiles = pendingFiles.value.length > 0
  const cleanText = (text || '').trim()
  const hasText = cleanText.length > 0
  if (!hasImages && !hasPendingFiles && !hasText) return
  if (!conversation.value) return

  sending.value = true

  const recvID = conversation.value.conversationType === 1 ? conversation.value.userID : ''
  const groupID = conversation.value.groupID || ''

  if (conversation.value.conversationType === 1 && recvID && !imStore.isFriend(recvID)) {
    const failedMsg = {
      clientMsgID: 'fail_' + Date.now(),
      sendID: imStore.imUserID,
      contentType: 101,
      textElem: { content: cleanText },
      sendTime: Date.now(),
      status: 3,
      failReason: '对方不是你的好友，无法发送消息',
      senderNickname: imStore.selfInfo?.nickname || '',
      senderFaceURL: imStore.selfInfo?.faceURL || '',
    }
    imStore.messages.push(failedMsg)
    editorRef.value?.clear(); cleanupInlineFiles(); await nextTick(); scrollToBottom()
    sending.value = false
    return
  }

  try {
    if (hasImages && hasText) {
      await imStore.sendImageTextMessage(recvID, groupID, imageFiles, cleanText)
      if (quotedMsg.value) clearQuote()
    } else if (hasImages) {
      for (const file of imageFiles) await sendMedia('image', file)
    } else if (hasText) {
      if (quotedMsg.value) { await imStore.sendQuoteMessage(recvID, groupID, cleanText, quotedMsg.value); clearQuote() }
      else if (userTags?.length > 0 && isGroup.value) {
        await imStore.sendAtMessage(groupID, cleanText, userTags.map((u: any) => u.id), userTags.map((u: any) => ({ atUserID: u.id, groupNickname: u.name })))
      } else { await imStore.sendTextMessage(recvID, groupID, cleanText) }
    }
    if (hasPendingFiles) { for (const pf of pendingFiles.value) await sendMedia(pf.type, pf.file); clearPendingFiles() }
    editorRef.value?.clear(); cleanupInlineFiles(); await nextTick(); scrollToBottom()
  } catch (e: any) {
    const errMsg = e.message || e.errMsg || '未知错误'
    const errCode = e.errCode ?? ''
    console.log('❌ [发送失败] errCode:', errCode, 'errMsg:', errMsg, '完整错误:', JSON.stringify(e))
    let failReason = '发送失败：' + errMsg
    if (/NotPeersFriend|not friend|friend is not exist/i.test(errMsg) || [1301, 1302, 1303].includes(errCode)) {
      failReason = '对方已将你删除，无法发送消息'
    } else if (/block|blacklist/i.test(errMsg) || [1304, 1305].includes(errCode)) {
      failReason = '你已被对方拉黑，无法发送消息'
    } else if (/timeout|network/i.test(errMsg)) {
      failReason = '网络异常，发送失败'
    }
    const failedMsg = {
      clientMsgID: 'fail_' + Date.now(),
      sendID: imStore.imUserID,
      contentType: 101,
      textElem: { content: cleanText },
      sendTime: Date.now(),
      status: 3,
      failReason,
      senderNickname: imStore.selfInfo?.nickname || '',
      senderFaceURL: imStore.selfInfo?.faceURL || '',
    }
    imStore.messages.push(failedMsg)
    editorRef.value?.clear(); cleanupInlineFiles(); await nextTick(); scrollToBottom()
  }
  finally { sending.value = false }
}

// ========== 滚动与历史 ==========
function scrollToBottom() { if (chatBodyRef.value) chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight }
async function handleScroll() { if (!chatBodyRef.value || loadingMore.value || isEnd.value) return; if (chatBodyRef.value.scrollTop < 50) await loadMoreMessages() }
async function loadMoreMessages() {
  if (!conversation.value || imStore.messages.length === 0) return
  loadingMore.value = true
  const prevHeight = chatBodyRef.value?.scrollHeight || 0
  try {
    const end = await imStore.loadMessages(conversation.value.conversationID, imStore.messages[0]?.clientMsgID || '')
    isEnd.value = end; await nextTick()
    if (chatBodyRef.value) chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight - prevHeight
  } finally { loadingMore.value = false }
}
async function loadInitialMessages() {
  if (!conversation.value) return
  isEnd.value = false
  isEnd.value = await imStore.loadMessages(conversation.value.conversationID)
  await imStore.markConversationRead(conversation.value.conversationID)
  await nextTick(); scrollToBottom()
}

watch(() => imStore.messages.length, () => {
  nextTick(() => { if (chatBodyRef.value) { const { scrollTop, scrollHeight, clientHeight } = chatBodyRef.value; if (scrollHeight - scrollTop - clientHeight < 150) scrollToBottom() } })
})
watch(conversation, async (newConv) => {
  if (newConv) {
    clearQuote(); exitMultiSelect()
    if (newConv.groupID) { try { groupMembers.value = await imStore.loadGroupMembers(newConv.groupID) } catch { /* */ } }
    else groupMembers.value = []
    loadInitialMessages()
  }
})
onMounted(() => { if (conversation.value) loadInitialMessages() })
onUnmounted(() => { if (isRecording.value) cancelRecording(); if (audioRef.value) { audioRef.value.pause(); audioRef.value.src = '' }; cleanupInlineFiles(); clearPendingFiles() })
</script>

<style scoped lang="scss">
.chat-window { display: flex; flex-direction: column; height: 100%; background: #fff; }
.chat-header {
  display: flex; align-items: center; gap: 8px; padding: 14px 20px; border-bottom: 1px solid #e8e8e8;
  .chat-title { font-size: 16px; font-weight: 600; color: #1d1d1f; }
}
.chat-body { flex: 1; overflow-y: auto; padding: 20px 24px; background: #f5f5f5; transition: padding-left 0.2s; &.multi-select-active { padding-left: 56px; } }
.load-more-tip { text-align: center; color: #999; font-size: 12px; padding: 8px; display: flex; align-items: center; justify-content: center; gap: 4px; }
.msg-time-divider {
  text-align: center; padding: 8px 0; margin-bottom: 4px;
  span { color: #b0b0b0; font-size: 12px; background: rgba(0,0,0,0.04); padding: 3px 12px; border-radius: 10px; }
}
.msg-notification {
  text-align: center; padding: 8px 0; margin-bottom: 12px;
  span { color: #999; background: rgba(0,0,0,0.05); padding: 4px 16px; border-radius: 12px; font-size: 12px; }
}
.msg-system-tip {
  text-align: center; padding: 6px 0; margin-bottom: 8px;
  span { color: #f56c6c; background: #fef0f0; padding: 4px 16px; border-radius: 12px; font-size: 12px; }
}
.msg-item-failed {
  :deep(.message-bubble-content) { opacity: 0.75; }
}
.msg-fail-row {
  display: flex; align-items: center; justify-content: flex-end; gap: 4px; padding: 2px 52px 4px 0; margin-top: -4px;
  .msg-fail-icon { display: flex; align-items: center; cursor: pointer; }
  .msg-fail-text { font-size: 12px; color: #f56c6c; }
}

.msg-item {
  margin-bottom: 16px; position: relative;
  .msg-sender-name { font-size: 12px; color: #999; }
  :deep(.el-avatar) { color: #fff; font-weight: 600; font-size: 14px; }
  :deep(.el-bubble-content) { background: #fff !important; color: #303133; }
  &.msg-item-self { :deep(.el-bubble-content) { background: #95ec69 !important; color: #1d1d1f; } }
  &.msg-item-selected { background: rgba(64, 158, 255, 0.06); border-radius: 8px; padding: 4px 8px; }
}

.msg-checkbox {
  position: absolute; left: -32px; top: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 1;
  .checkbox-inner {
    width: 20px; height: 20px; border-radius: 50%; border: 2px solid #c0c4cc; display: flex; align-items: center; justify-content: center; transition: all 0.15s;
    &.checked { background: #409eff; border-color: #409eff; color: #fff; }
  }
}

.msg-image {
  min-width: 80px;
  :deep(.el-image) { border-radius: 8px; cursor: pointer; display: block; min-height: 40px; }
  .msg-image-fail { display: flex; align-items: center; gap: 6px; padding: 12px 20px; font-size: 13px; color: #909399; background: rgba(0,0,0,0.04); border-radius: 8px; white-space: nowrap; }
}
.msg-image-text {
  .msg-image { margin-bottom: 6px; :deep(.el-image) { border-radius: 8px; cursor: pointer; display: block; min-height: 40px; } }
  .image-text-content { font-size: 14px; color: #303133; line-height: 1.5; word-break: break-word; margin-top: 4px; }
}
.msg-voice {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px; min-width: 120px; cursor: pointer; user-select: none;
  .voice-icon { font-size: 20px; color: #409eff; flex-shrink: 0; &.playing { animation: pulse 1s infinite; } }
  .voice-bar { flex: 1; height: 4px; background: #e4e7ed; border-radius: 2px; overflow: hidden; min-width: 60px; .voice-progress { height: 100%; background: #409eff; border-radius: 2px; transition: width 0.1s; } }
  .voice-duration { font-size: 12px; color: #909399; white-space: nowrap; }
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.msg-file {
  display: flex; align-items: center; gap: 10px; padding: 10px 14px; cursor: pointer; border-radius: 8px; transition: background 0.15s;
  &:hover { background: rgba(0,0,0,0.03); }
  .file-type-svg { flex-shrink: 0; line-height: 0; display: flex; align-items: center; }
  .file-info { display: flex; flex-direction: column; min-width: 0; flex: 1;
    .file-name { font-size: 14px; color: #303133; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }
    .file-size { font-size: 12px; color: #909399; }
  }
}

.fp-overlay {
  position: fixed; inset: 0; z-index: 3000; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center;
}
.fp-panel {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  background: #fff; border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.25);
  display: flex; flex-direction: column; overflow: hidden;
  min-width: 400px; min-height: 300px;
}
.fp-header {
  display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid #ebeef5;
  flex-shrink: 0; cursor: move; user-select: none; background: #fafafa;
  .fp-title { font-size: 14px; font-weight: 600; color: #303133; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }
  .fp-size { font-size: 12px; color: #909399; white-space: nowrap; }
}
.fp-body {
  flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative;
}
.fp-resize-handle {
  position: absolute; right: 0; bottom: 0; width: 18px; height: 18px; cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, #c0c4cc 50%, #c0c4cc 60%, transparent 60%, transparent 72%, #c0c4cc 72%, #c0c4cc 82%, transparent 82%);
  border-radius: 0 0 8px 0; z-index: 1;
}
.preview-loading-wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 200px; }
.preview-image-wrap {
  display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; padding: 16px;
  .el-image { max-width: 100%; max-height: 100%; }
}
.preview-iframe { width: 100%; height: 100%; border: none; }
.preview-video { max-width: 100%; max-height: 100%; outline: none; }
.preview-audio-wrap {
  display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 40px;
  .preview-audio-icon { font-size: 64px; }
  .preview-audio-name { font-size: 16px; color: #303133; text-align: center; word-break: break-all; max-width: 400px; }
  .preview-audio { width: 400px; max-width: 90%; }
}
.preview-text-wrap {
  width: 100%; height: 100%; overflow: auto;
  .preview-text-loading { display: flex; flex-direction: column; align-items: center; gap: 8px; color: #909399; padding: 60px; }
  .preview-text-content {
    margin: 0; padding: 20px 24px; font-size: 13px; line-height: 1.7; font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    background: #fafafa; color: #303133; white-space: pre-wrap; word-break: break-all; min-height: 100%;
  }
}
.preview-office-render {
  width: 100%; height: 100%; overflow: auto; padding: 24px 32px; background: #fff;
  :deep(table) { border-collapse: collapse; width: 100%; margin: 8px 0;
    td, th { border: 1px solid #dcdfe6; padding: 6px 10px; font-size: 13px; text-align: left; }
    th { background: #f5f7fa; font-weight: 600; }
  }
  :deep(img) { max-width: 100%; }
  :deep(p) { margin: 0.5em 0; line-height: 1.7; }
  .sheet-tab { font-size: 14px; font-weight: 600; color: #1e7145; padding: 12px 0 6px; border-bottom: 2px solid #1e7145; margin-bottom: 8px; }
}
.preview-unsupported {
  display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 12px; color: #909399; font-size: 14px;
}
.preview-office-wrap {
  width: 100%; height: 100%; display: flex; flex-direction: column;
  .preview-iframe { flex: 1; }
  .preview-office-hint { padding: 8px 16px; font-size: 12px; color: #909399; text-align: center; background: #fafafa; border-top: 1px solid #eee; }
}
.msg-quote {
  .quote-block {
    background: rgba(0,0,0,0.04); border-left: 2px solid #409eff; padding: 4px 8px; border-radius: 0 4px 4px 0; margin-bottom: 4px; font-size: 11px; color: #909399;
    .quote-sender { font-weight: 500; margin-right: 4px; }
    .quote-text { display: inline; }
    .quote-thumb { width: 36px; height: 36px; border-radius: 4px; display: block; margin-top: 2px; cursor: pointer; object-fit: cover; }
    .quote-imagetext { display: flex; align-items: center; gap: 4px; margin-top: 2px; .quote-text { font-size: 11px; color: #909399; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px; } }
    .quote-file { display: inline-flex; align-items: center; gap: 3px; color: #606266; font-size: 11px; }
    .quote-voice { display: inline-flex; align-items: center; gap: 3px; color: #606266; font-size: 11px; }
  }
  .quote-reply { font-size: 13px; color: #303133; }
}
.msg-merge {
  padding: 6px 10px; min-width: 140px; max-width: 220px; cursor: pointer;
  &:hover { background: rgba(0,0,0,0.02); }
  .merge-title { font-size: 12px; font-weight: 500; color: #303133; margin-bottom: 4px; }
  .merge-summary { border-top: 1px solid #ebeef5; padding-top: 4px; .merge-line { font-size: 11px; color: #909399; line-height: 1.5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } }
  .merge-footer { font-size: 10px; color: #c0c4cc; margin-top: 4px; border-top: 1px solid #ebeef5; padding-top: 4px; }
}
.merge-detail-list {
  max-height: 60vh; overflow-y: auto; padding: 4px 0;
  .merge-detail-item {
    display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f0f0f0;
    &:last-child { border-bottom: none; }
  }
  .merge-detail-body { flex: 1; min-width: 0; }
  .merge-detail-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .merge-detail-name { font-size: 12px; color: #909399; }
  .merge-detail-time { font-size: 11px; color: #c0c4cc; }
  .merge-detail-content { font-size: 14px; color: #303133; line-height: 1.5; word-break: break-word; }
  .merge-detail-img { width: 72px; height: 72px; border-radius: 6px; cursor: pointer; display: block; margin: 4px 0; }
  .merge-detail-file { display: inline-flex; align-items: center; gap: 4px; color: #409eff; }
  .merge-detail-imagetext { display: flex; flex-wrap: wrap; gap: 6px; align-items: flex-start; }
  .merge-detail-empty { text-align: center; color: #c0c4cc; padding: 30px 0; font-size: 14px; }
}
.msg-at { font-size: 14px; }
:deep(.at-highlight) { color: #409eff; font-weight: 500; }
.typing-row { padding: 8px 0; }

// 多选操作栏
.multi-select-bar {
  display: flex; align-items: center; gap: 10px; padding: 12px 20px; border-top: 1px solid #e8e8e8; background: #fff;
  .multi-select-count { font-size: 14px; color: #606266; flex: 1; }
}

// 输入区域（微信风格）
.chat-footer {
  border-top: 1px solid #e0e0e0; background: #f5f5f5; display: flex; flex-direction: column; position: relative;
}
.resize-handle {
  height: 4px; cursor: ns-resize; background: transparent; flex-shrink: 0;
  &:hover { background: #d0d0d0; }
}
.quote-preview {
  display: flex; align-items: center; padding: 6px 14px; background: #ebebeb; border-bottom: 1px solid #e0e0e0;
  .quote-preview-content {
    flex: 1; font-size: 12px; color: #909399; display: flex; align-items: center; gap: 6px; overflow: hidden;
    .quote-preview-name { font-weight: 500; color: #606266; flex-shrink: 0; }
    .quote-preview-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .quote-preview-thumb { width: 36px; height: 36px; border-radius: 4px; flex-shrink: 0; object-fit: cover; }
    .quote-preview-file { display: inline-flex; align-items: center; gap: 4px; color: #606266; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .quote-preview-voice { display: inline-flex; align-items: center; gap: 4px; color: #606266; }
  }
  .quote-preview-close { cursor: pointer; color: #999; font-size: 14px; margin-left: 8px; flex-shrink: 0; &:hover { color: #333; } }
}
.recording-bar {
  display: flex; align-items: center; gap: 10px; padding: 10px 14px; margin: 0 14px; background: #fef0f0; border: 1px solid #fde2e2; border-radius: 6px;
  .recording-dot { width: 10px; height: 10px; border-radius: 50%; background: #f56c6c; animation: pulse 1s infinite; }
  .recording-text { font-size: 13px; color: #f56c6c; flex: 1; }
}

// 微信风格工具栏（独立于 EditorSender）
.wechat-toolbar {
  display: flex; align-items: center; gap: 12px; padding: 7px 16px; flex-shrink: 0;
}
.toolbar-btn {
  display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 4px; cursor: pointer; color: #7c7c7c; font-size: 22px; transition: all 0.15s; user-select: none;
  &:hover { color: #333; }
}
.toolbar-btn-at { font-size: 16px; font-weight: 600; font-family: -apple-system, system-ui, sans-serif; }

// 发送按钮
.wechat-footer {
  display: flex; justify-content: flex-end; padding: 2px 14px 6px;
}
.wechat-send-btn {
  display: inline-flex; align-items: center; justify-content: center; padding: 4px 20px; font-size: 13px; color: #07c160; border: 1px solid #07c160; border-radius: 4px; cursor: pointer; user-select: none; transition: all 0.15s;
  &:hover { background: #07c160; color: #fff; }
  &.disabled { color: #bababa; border-color: #d0d0d0; cursor: default; &:hover { background: transparent; color: #bababa; } }
}

// EditorSender 覆写
:deep(.el-editor-sender-wrap) {
  border: none !important; border-radius: 0 !important; box-shadow: none !important; background: transparent !important;
  flex: 1; display: flex; flex-direction: column; min-height: 0;
}
:deep(.el-editor-sender-content) {
  flex: 1; display: flex; flex-direction: column; min-height: 0;
}
:deep(.content-variant-updown) {
  flex: 1; display: flex; flex-direction: column; min-height: 0;
}
:deep(.el-editor-sender-chat-room) {
  flex: 1; min-height: 0;
}
:deep(.el-editor-sender-chat) {
  padding: 6px 14px; height: 100%; overflow-y: auto; font-size: 14px; line-height: 1.6; background: #f5f5f5; border: none; outline: none;
  img { max-width: 120px; max-height: 90px; border-radius: 4px; vertical-align: bottom; margin: 2px 4px; cursor: default; }
}
:deep(.el-editor-sender-updown-action-list) {
  display: none !important;
}
:deep(.el-editor-sender-footer) {
  background: #f5f5f5; border: none !important; padding: 0 !important; margin: 0 !important;
}

.emoji-panel {
  display: flex; flex-wrap: wrap; gap: 2px; max-height: 240px; overflow-y: auto;
  .emoji-item { font-size: 22px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 6px; transition: background 0.15s; &:hover { background: #f2f3f5; } }
}
.pending-files-bar { display: flex; gap: 8px; padding: 6px 14px; flex-wrap: wrap; background: #ebebeb; }
.pending-file-item {
  position: relative; border-radius: 4px; overflow: hidden; border: 1px solid #d0d0d0; background: #fff;
  .pending-file-info { display: flex; align-items: center; gap: 4px; padding: 6px 8px; font-size: 12px; color: #606266; max-width: 160px; .pending-file-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } }
  .pending-remove { position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.5); color: #fff; border-radius: 50%; cursor: pointer; opacity: 0; transition: opacity 0.15s; }
  &:hover .pending-remove { opacity: 1; }
}

// 转发会话选择
.forward-conv-list { max-height: 400px; overflow-y: auto; }
.forward-conv-item {
  display: flex; align-items: center; gap: 12px; padding: 10px 12px; cursor: pointer; border-radius: 8px; transition: background 0.15s;
  &:hover { background: #f2f3f5; }
  .forward-conv-name { font-size: 14px; color: #303133; }
}
.forward-empty { text-align: center; padding: 20px; color: #909399; font-size: 14px; }
</style>

<style>
/* 右键菜单（非 scoped，因为 Teleport 到 body） */
.msg-context-menu {
  position: fixed;
  z-index: 9999;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 6px 0;
  min-width: 140px;
  animation: ctx-fade-in 0.12s ease;
}
@keyframes ctx-fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
.ctx-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  font-size: 14px;
  color: #303133;
  cursor: pointer;
  transition: background 0.12s;
  white-space: nowrap;
}
.ctx-menu-item:hover { background: #f2f3f5; }
.ctx-menu-item .el-icon { font-size: 16px; color: #909399; }
.ctx-menu-item.ctx-danger { color: #f56c6c; }
.ctx-menu-item.ctx-danger .el-icon { color: #f56c6c; }
</style>
