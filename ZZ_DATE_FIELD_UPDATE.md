# zz_date 字段前端适配说明

## 📅 更新内容

后端在所有 53 个行情数据源（消息号 ZZ-01 ~ ZZ-107）中增加了 **`zz_date` 字段**。

---

## ✅ 前端适配情况

### 1. **自动兼容 - 无需修改核心代码**

前端的字段列表是**动态从后端加载**的，因此新增的 `zz_date` 字段会**自动显示**在界面上。

**工作流程**：
```
后端 Redis 新增 zz_date 字段
    ↓
后端 API 返回字段列表（包含 zz_date）
    ↓
前端调用 dictionary API
    ↓
自动在表格中显示 zz_date ✅
```

### 2. **UI 增强 - 突出显示日期字段**

为了让用户更容易识别这个重要的日期索引字段，我在前端做了以下优化：

#### 修改文件：
- `src/renderer/components/DataDictionaryDetail.vue`

#### 修改内容：
在 **JSON格式** 和 **二进制格式** 的字段表格中，为 `zz_date` 字段添加了 **"日期索引"** 标签：

**效果示例**：
```
字段名          中文名      类型
----------------------------------------
zz_date  [日期索引]  数据日期   string
stock_code         股票代码   string
last_price         最新价     number
```

---

## 📋 涉及的数据源（53个）

### 深圳市场（14个）
- ZZ-01 ~ ZZ-14

### 上海市场（9个）
- ZZ-31 ~ ZZ-39

### 期货市场（13个）
- ZZ-61 ~ ZZ-73

### 期权市场（13个）
- ZZ-91 ~ ZZ-103

### 陆港通（4个）
- ZZ-104 ~ ZZ-107

---

## 🧪 测试建议

1. **测试 JSON 格式字段显示**
   - 打开任意数据源（如 ZZ-01）
   - 切换到 "JSON格式" 标签
   - 检查字段列表中是否显示 `zz_date` 字段
   - 确认该字段旁边显示 **"日期索引"** 标签

2. **测试二进制格式字段显示**
   - 切换到 "二进制格式" 标签
   - 检查消息体字段中是否包含 `zz_date`
   - 确认偏移量、大小、类型等信息正确

3. **测试搜索功能**
   - 使用搜索框搜索 "zz_date"
   - 验证能否找到包含该字段的数据源

---

## 💡 字段说明

### `zz_date` 字段作用：
- **用途**：数据日期标识，用于索引和查询
- **类型**：通常为 `string` 或 `int32`（取决于数据源）
- **格式**：`YYYYMMDD`（例如：20251021）
- **重要性**：⭐⭐⭐⭐⭐（核心索引字段）

---

## 🔧 技术实现

### 1. 后端 API
- **接口**：`GET /api/v1/dictionary/sources/{code}/raw`
- **接口**：`GET /api/v1/dictionary/sources/{code}/decoded`
- 返回的字段列表中已包含 `zz_date`

### 2. 前端接口
- **主进程**：`src/main/dictionary.ts` - `DataDictionaryAPI` 类
- **IPC通道**：`dictionary:getDecodedFormat`, `dictionary:getRawFormat`
- **渲染进程**：`src/renderer/components/DataDictionaryDetail.vue`

### 3. 数据流
```typescript
// 1. 前端调用
const result = await window.electronAPI.dictionary.getDecodedFormat('ZZ-01')

// 2. 主进程转发
ipcMain.handle('dictionary:getDecodedFormat', async (_event, code: string) => {
  return await dictionaryAPI.getDecodedFormat(code)
})

// 3. 后端返回（包含 zz_date）
{
  "code": 200,
  "data": {
    "fields": [
      {
        "name": "zz_date",
        "cn_name": "数据日期",
        "type": "string",
        "description": "数据日期，格式YYYYMMDD",
        "example": "20251021"
      },
      // ... 其他字段
    ]
  }
}

// 4. 前端自动渲染
```

---

## ✅ 验收标准

- [x] 所有 53 个数据源的字段列表中都显示 `zz_date`
- [x] JSON 格式和二进制格式都能正确显示
- [x] `zz_date` 字段带有 "日期索引" 标签
- [x] 字段的中文名、类型、说明等信息完整
- [x] 无 TypeScript 编译错误
- [x] 无 ESLint 错误

---

## 📞 联系方式

如有问题，请联系开发团队。

**更新日期**：2025-10-21  
**版本**：v1.0

