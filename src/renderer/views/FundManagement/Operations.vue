<template>
  <div class="fund-operations">
    <el-card class="main-card">
      <!-- Tab切换 -->
      <el-tabs v-model="activeManageTab" class="manage-tabs">
        <!-- 基金管理Tab -->
        <el-tab-pane label="基金管理" name="fund">
          <div class="tab-toolbar">
            <el-button type="primary" :icon="Plus" @click="handleCreate">新建基金</el-button>
            <el-button :icon="Refresh" @click="loadFundList">刷新</el-button>
          </div>
          
          <!-- 搜索筛选 -->
          <div class="search-bar">
            <el-input
              v-model="searchForm.fund_name"
              placeholder="搜索基金名称"
              :prefix-icon="Search"
              clearable
              style="width: 300px;"
              @clear="loadFundList"
              @keyup.enter="loadFundList"
            />
            
            <el-select
              v-model="searchForm.custodian"
              placeholder="托管人"
              clearable
              style="width: 200px;"
              @change="loadFundList"
            >
              <el-option
                v-for="item in custodians"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </el-select>
            
            <el-select
              v-model="searchForm.broker"
              placeholder="经纪服务商"
              clearable
              style="width: 200px;"
              @change="loadFundList"
            >
              <el-option
                v-for="item in brokers"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </el-select>
            
            <el-select
              v-model="searchForm.status"
              placeholder="状态"
              clearable
              style="width: 150px;"
              @change="loadFundList"
            >
              <el-option label="正常" value="active" />
              <el-option label="已删除" value="deleted" />
            </el-select>
            
            <el-button type="primary" :icon="Search" @click="loadFundList">搜索</el-button>
            <el-button :icon="RefreshRight" @click="handleReset">重置</el-button>
          </div>

          <!-- 基金列表表格 -->
          <el-table
            :data="fundList"
            v-loading="loading"
            stripe
            border
            style="width: 100%; margin-top: 20px;"
            height="calc(100vh - 360px)"
          >
            <el-table-column prop="fund_code" label="基金代码" width="120" fixed />
            <el-table-column prop="fund_name" label="基金名称" width="250" show-overflow-tooltip />
            <el-table-column label="托管人" width="150">
              <template #default="{ row }">
                {{ row.custodian?.name || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="经纪商" width="200">
              <template #default="{ row }">
                <span v-if="row.brokers && row.brokers.length > 0">
                  {{ row.brokers.join(', ') }}
                </span>
                <span v-else style="color: #c0c4cc;">-</span>
              </template>
            </el-table-column>
            <el-table-column prop="fund_manager" label="基金经理" width="120" />
            <el-table-column prop="fund_type" label="基金类型" width="120" />
            <el-table-column prop="establish_date" label="成立日期" width="120" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === '运作中' ? 'success' : 'info'" size="small">
                  {{ row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="180" />
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button size="small" type="primary" link @click="handleView(row)">查看</el-button>
                <el-button size="small" type="warning" link @click="handleEdit(row)">编辑</el-button>
                <el-button 
                  v-if="row.status === '运作中'"
                  size="small" 
                  type="danger" 
                  link 
                  @click="handleLiquidate(row)"
                >
                  清盘
                </el-button>
                <el-button 
                  v-else
                  size="small" 
                  type="success" 
                  link 
                  @click="handleRestore(row)"
                >
                  恢复运作
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <!-- 分页 -->
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.size"
            :total="pagination.total"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="loadFundList"
            @current-change="loadFundList"
            style="margin-top: 20px; justify-content: flex-end;"
          />
        </el-tab-pane>

        <!-- 基础信息维护Tab -->
        <el-tab-pane label="基础信息维护" name="basicinfo">
          <div class="manage-section">
            <el-tabs type="border-card">
              <!-- 托管人子Tab -->
              <el-tab-pane label="托管人">
                <div class="tab-toolbar">
                  <el-button type="primary" :icon="Plus" @click="handleAddCustodian">新增托管人</el-button>
                </div>
                
                <el-table :data="custodians" stripe border style="margin-top: 20px;">
                  <el-table-column prop="id" label="ID" width="100" />
                  <el-table-column prop="name" label="名称" />
                  <el-table-column prop="short_name" label="简称" width="150" />
                  <el-table-column label="操作" width="150">
                    <template #default="{ row }">
                      <el-button size="small" type="warning" link disabled>编辑</el-button>
                      <el-button size="small" type="danger" link disabled>删除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>
              
              <!-- 经纪商子Tab -->
              <el-tab-pane label="经纪商">
                <div class="tab-toolbar">
                  <el-button type="primary" :icon="Plus" @click="handleAddBroker">新增经纪商</el-button>
                </div>
                
                <el-table :data="brokers" stripe border style="margin-top: 20px;">
                  <el-table-column prop="id" label="ID" width="100" />
                  <el-table-column prop="name" label="名称" />
                  <el-table-column prop="short_name" label="简称" width="150" />
                  <el-table-column label="操作" width="150">
                    <template #default="{ row }">
                      <el-button size="small" type="warning" link disabled>编辑</el-button>
                      <el-button size="small" type="danger" link disabled>删除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>
            </el-tabs>
          </div>
        </el-tab-pane>
        
        <!-- 申购赎回Tab -->
        <el-tab-pane label="申购赎回" name="transaction">
          <div class="manage-section">
            <div class="tab-toolbar">
              <el-button type="success" :icon="Plus" @click="showSubscribeDialog = true">申购</el-button>
              <el-button type="warning" :icon="Minus" @click="showRedeemDialog = true">赎回</el-button>
            </div>
            
            <el-table :data="transactionList" stripe border style="margin-top: 20px;">
              <el-table-column prop="date" label="交易日期" width="120" />
              <el-table-column prop="fund_name" label="基金名称" width="200" />
              <el-table-column prop="type" label="交易类型" width="100">
                <template #default="{ row }">
                  <el-tag :type="row.type === '申购' ? 'success' : 'warning'">{{ row.type }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="amount" label="金额(元)" width="150" align="right">
                <template #default="{ row }">
                  {{ row.amount?.toLocaleString() || '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="shares" label="份额" width="150" align="right">
                <template #default="{ row }">
                  {{ row.shares?.toFixed(2) || '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="net_value" label="净值" width="100" align="right">
                <template #default="{ row }">
                  {{ row.net_value?.toFixed(4) || '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="fee" label="手续费(元)" width="120" align="right">
                <template #default="{ row }">
                  {{ row.fee?.toFixed(2) || '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="operator" label="操作人" width="100" />
              <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
            </el-table>
          </div>
        </el-tab-pane>
        
        <!-- 净值管理Tab -->
        <el-tab-pane label="净值管理" name="netvalue">
          <div class="manage-section">
            <div class="tab-toolbar">
              <el-button type="primary" :icon="Plus" @click="showNetValueDialog = true">录入净值</el-button>
            </div>
            
            <el-table :data="netValueList" stripe border style="margin-top: 20px;">
              <el-table-column prop="date" label="日期" width="120" />
              <el-table-column prop="fund_name" label="基金名称" width="200" />
              <el-table-column prop="net_value" label="单位净值" width="120" align="right">
                <template #default="{ row }">
                  {{ row.net_value?.toFixed(4) || '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="accumulated_value" label="累计净值" width="120" align="right">
                <template #default="{ row }">
                  {{ row.accumulated_value?.toFixed(4) || '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="daily_return" label="日涨跌幅" width="120" align="right">
                <template #default="{ row }">
                  <span :class="row.daily_return >= 0 ? 'text-red' : 'text-green'">
                    {{ row.daily_return >= 0 ? '+' : '' }}{{ (row.daily_return * 100).toFixed(2) }}%
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="operator" label="操作人" width="100" />
              <el-table-column prop="created_at" label="录入时间" width="160" />
            </el-table>
          </div>
        </el-tab-pane>
        
        <!-- 报告管理Tab -->
        <el-tab-pane label="报告管理" name="report">
          <div class="manage-section">
            <el-tabs type="border-card">
              <!-- 日报子Tab -->
              <el-tab-pane label="日报">
                <div class="tab-toolbar">
                  <el-button type="primary" :icon="Upload" @click="showUploadReportDialog('daily')">上传日报</el-button>
                </div>
                
                <el-table :data="dailyReportList" stripe border style="margin-top: 20px;">
                  <el-table-column prop="report_date" label="报告日期" width="120" />
                  <el-table-column prop="fund_code" label="基金代码" width="120" />
                  <el-table-column prop="fund_name" label="基金名称" width="200" />
                  <el-table-column prop="report_title" label="报告标题" width="200" show-overflow-tooltip />
                  <el-table-column prop="file_name" label="文件名" width="200" show-overflow-tooltip />
                  <el-table-column prop="file_size" label="文件大小" width="120" align="right">
                    <template #default="{ row }">
                      {{ (row.file_size / 1024 / 1024).toFixed(2) }} MB
                    </template>
                  </el-table-column>
                  <el-table-column prop="download_count" label="下载次数" width="100" align="center" />
                  <el-table-column prop="created_at" label="上传时间" width="160" />
                  <el-table-column label="操作" width="200" fixed="right">
                    <template #default="{ row }">
                      <el-button size="small" type="primary" link @click="viewReport(row)">查看</el-button>
                      <el-button size="small" type="success" link @click="downloadReport(row)">下载</el-button>
                      <el-button size="small" type="danger" link @click="deleteReport(row)">删除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>
              
              <!-- 周报子Tab -->
              <el-tab-pane label="周报">
                <div class="tab-toolbar">
                  <el-button type="primary" :icon="Upload" @click="showUploadReportDialog('weekly')">上传周报</el-button>
                </div>
                
                <el-table :data="weeklyReportList" stripe border style="margin-top: 20px;">
                  <el-table-column prop="report_date" label="报告日期" width="120" />
                  <el-table-column prop="fund_code" label="基金代码" width="120" />
                  <el-table-column prop="fund_name" label="基金名称" width="200" />
                  <el-table-column prop="report_title" label="报告标题" width="200" show-overflow-tooltip />
                  <el-table-column prop="file_name" label="文件名" width="200" show-overflow-tooltip />
                  <el-table-column prop="file_size" label="文件大小" width="120" align="right">
                    <template #default="{ row }">
                      {{ (row.file_size / 1024 / 1024).toFixed(2) }} MB
                    </template>
                  </el-table-column>
                  <el-table-column prop="download_count" label="下载次数" width="100" align="center" />
                  <el-table-column prop="created_at" label="上传时间" width="160" />
                  <el-table-column label="操作" width="200" fixed="right">
                    <template #default="{ row }">
                      <el-button size="small" type="primary" link @click="viewReport(row)">查看</el-button>
                      <el-button size="small" type="success" link @click="downloadReport(row)">下载</el-button>
                      <el-button size="small" type="danger" link @click="deleteReport(row)">删除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>
            </el-tabs>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 新建/编辑基金对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '新建基金' : '编辑基金'"
      width="700px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="fundForm"
        :rules="formRules"
        label-width="120px"
      >
        <el-form-item label="基金代码" prop="fund_code">
          <el-input v-model="fundForm.fund_code" placeholder="请输入基金代码" :disabled="dialogMode === 'edit'" />
        </el-form-item>
        
        <el-form-item label="基金名称" prop="fund_name">
          <el-input v-model="fundForm.fund_name" placeholder="请输入基金名称" />
        </el-form-item>
        
        <el-form-item label="托管人" prop="custodian_id">
          <el-select v-model="fundForm.custodian_id" placeholder="请选择托管人" style="width: 100%;">
            <el-option
              v-for="item in custodians"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="经纪服务商" prop="broker_ids">
          <el-select 
            v-model="fundForm.broker_ids" 
            placeholder="请选择经纪服务商（可多选）" 
            multiple
            collapse-tags
            collapse-tags-tooltip
            style="width: 100%;"
          >
            <el-option
              v-for="item in brokers"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="成立日期" prop="establish_date">
          <el-date-picker
            v-model="fundForm.establish_date"
            type="date"
            placeholder="选择成立日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%;"
          />
        </el-form-item>
        
        <el-form-item label="基金经理" prop="fund_manager">
          <el-input v-model="fundForm.fund_manager" placeholder="请输入基金经理姓名" />
        </el-form-item>
        
        <el-form-item label="基金类型" prop="fund_type">
          <el-select v-model="fundForm.fund_type" placeholder="请选择基金类型" style="width: 100%;">
            <el-option label="股票型" value="stock" />
            <el-option label="债券型" value="bond" />
            <el-option label="混合型" value="mixed" />
            <el-option label="货币型" value="money" />
            <el-option label="指数型" value="index" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="描述">
          <el-input v-model="fundForm.description" type="textarea" :rows="3" placeholder="选填：基金描述信息" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          {{ dialogMode === 'create' ? '创建' : '保存' }}
        </el-button>
      </template>
    </el-dialog>
    
    <!-- 清盘对话框 -->
    <el-dialog v-model="showLiquidateDialog" title="清盘基金" width="500px">
      <el-form label-width="100px">
        <el-form-item label="基金代码">
          <el-input v-model="liquidateForm.fund_code" disabled />
        </el-form-item>
        <el-form-item label="基金名称">
          <el-input v-model="liquidateForm.fund_name" disabled />
        </el-form-item>
        <el-form-item label="清盘日期" required>
          <el-date-picker
            v-model="liquidateForm.liquidate_date"
            type="date"
            placeholder="选择清盘日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="清盘原因">
          <el-input
            v-model="liquidateForm.reason"
            type="textarea"
            :rows="3"
            placeholder="请输入清盘原因（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showLiquidateDialog = false">取消</el-button>
        <el-button type="danger" @click="submitLiquidate">确定清盘</el-button>
      </template>
    </el-dialog>
    
    <!-- 恢复运作对话框 -->
    <el-dialog v-model="showRestoreDialog" title="恢复基金运作" width="500px">
      <el-form label-width="100px">
        <el-form-item label="基金代码">
          <el-input v-model="restoreForm.fund_code" disabled />
        </el-form-item>
        <el-form-item label="基金名称">
          <el-input v-model="restoreForm.fund_name" disabled />
        </el-form-item>
        <el-form-item label="恢复日期" required>
          <el-date-picker
            v-model="restoreForm.restore_date"
            type="date"
            placeholder="选择恢复日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="恢复原因">
          <el-input
            v-model="restoreForm.reason"
            type="textarea"
            :rows="3"
            placeholder="请输入恢复原因（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRestoreDialog = false">取消</el-button>
        <el-button type="success" @click="submitRestore">确定恢复</el-button>
      </template>
    </el-dialog>
    
    <!-- 申购对话框 -->
    <el-dialog v-model="showSubscribeDialog" title="基金申购" width="500px">
      <el-form label-width="100px">
        <el-form-item label="选择基金" required>
          <el-select v-model="subscribeForm.fund_code" placeholder="请选择基金" style="width: 100%">
            <el-option
              v-for="fund in fundList.filter(f => f.status === '运作中')"
              :key="fund.fund_code"
              :label="`${fund.fund_name} (${fund.fund_code})`"
              :value="fund.fund_code"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="申购金额" required>
          <el-input-number v-model="subscribeForm.amount" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="申购日期" required>
          <el-date-picker
            v-model="subscribeForm.date"
            type="date"
            placeholder="选择申购日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="subscribeForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSubscribeDialog = false">取消</el-button>
        <el-button type="success" @click="submitSubscribe">确定申购</el-button>
      </template>
    </el-dialog>
    
    <!-- 赎回对话框 -->
    <el-dialog v-model="showRedeemDialog" title="基金赎回" width="500px">
      <el-form label-width="100px">
        <el-form-item label="选择基金" required>
          <el-select v-model="redeemForm.fund_code" placeholder="请选择基金" style="width: 100%">
            <el-option
              v-for="fund in fundList.filter(f => f.status === '运作中')"
              :key="fund.fund_code"
              :label="`${fund.fund_name} (${fund.fund_code})`"
              :value="fund.fund_code"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="赎回份额" required>
          <el-input-number v-model="redeemForm.shares" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="赎回日期" required>
          <el-date-picker
            v-model="redeemForm.date"
            type="date"
            placeholder="选择赎回日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="redeemForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRedeemDialog = false">取消</el-button>
        <el-button type="warning" @click="submitRedeem">确定赎回</el-button>
      </template>
    </el-dialog>
    
    <!-- 净值录入对话框 -->
    <el-dialog v-model="showNetValueDialog" title="录入基金净值" width="500px">
      <el-form label-width="100px">
        <el-form-item label="选择基金" required>
          <el-select v-model="netValueForm.fund_code" placeholder="请选择基金" style="width: 100%">
            <el-option
              v-for="fund in fundList.filter(f => f.status === '运作中')"
              :key="fund.fund_code"
              :label="`${fund.fund_name} (${fund.fund_code})`"
              :value="fund.fund_code"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="日期" required>
          <el-date-picker
            v-model="netValueForm.date"
            type="date"
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="单位净值" required>
          <el-input-number
            v-model="netValueForm.net_value"
            :min="0"
            :precision="4"
            :step="0.0001"
            placeholder="单位净值"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="累计净值" required>
          <el-input-number
            v-model="netValueForm.accumulated_value"
            :min="0"
            :precision="4"
            :step="0.0001"
            placeholder="累计净值"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="netValueForm.remark" type="textarea" :rows="3" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showNetValueDialog = false">取消</el-button>
        <el-button type="primary" @click="submitNetValue">确定录入</el-button>
      </template>
    </el-dialog>
    
    <!-- 上传报告对话框 -->
    <el-dialog 
      v-model="showUploadReportDialogVisible" 
      :title="`上传${uploadReportType === 'daily' ? '日报' : '周报'}`" 
      width="500px"
    >
      <el-form label-width="100px">
        <el-form-item label="选择基金" required>
          <el-select v-model="uploadReportForm.fund_code" placeholder="请选择基金" style="width: 100%">
            <el-option
              v-for="fund in fundList"
              :key="fund.fund_code"
              :label="`${fund.fund_name} (${fund.fund_code})`"
              :value="fund.fund_code"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="报告日期" required>
          <el-date-picker
            v-model="uploadReportForm.report_date"
            type="date"
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="报告标题" required>
          <el-input v-model="uploadReportForm.report_title" placeholder="请输入报告标题" />
        </el-form-item>
        <el-form-item label="选择文件" required>
          <el-button type="primary" @click="selectFile">选择文件</el-button>
          <div style="color: #909399; font-size: 12px; margin-top: 8px;">
            支持 PDF、Excel、Word 格式，大小不超过50MB
          </div>
          <div v-if="selectedFilePath" style="margin-top: 10px; color: #67c23a;">
            已选择: {{ selectedFilePath }}
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showUploadReportDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitUploadReport">上传</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, FormInstance } from 'element-plus'
import { 
  Plus,
  Minus,
  Refresh, 
  Search, 
  RefreshRight, 
  House, 
  OfficeBuilding,
  CircleClose,
  Edit,
  Download,
  Upload
} from '@element-plus/icons-vue'

// 数据
const activeManageTab = ref('fund')
const loading = ref(false)
const fundList = ref<any[]>([])
const custodians = ref<any[]>([])
const brokers = ref<any[]>([])

// 搜索表单
const searchForm = reactive({
  fund_name: '',
  custodian: '',
  broker: '',
  status: ''
})

// 分页
const pagination = reactive({
  page: 1,
  size: 20,
  total: 0
})

// 对话框
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const submitting = ref(false)
const formRef = ref<FormInstance>()

const showLiquidateDialog = ref(false)
const showRestoreDialog = ref(false)
const showSubscribeDialog = ref(false)
const showRedeemDialog = ref(false)
const showNetValueDialog = ref(false)
const showUploadReportDialogVisible = ref(false)
const uploadReportType = ref<'daily' | 'weekly'>('daily')
const currentFund = ref<any>(null)

const liquidateForm = reactive({
  fund_code: '',
  fund_name: '',
  liquidate_date: '',
  reason: ''
})

const restoreForm = reactive({
  fund_code: '',
  fund_name: '',
  restore_date: '',
  reason: ''
})

const subscribeForm = reactive({
  fund_code: '',
  amount: 0,
  date: '',
  remark: ''
})

const redeemForm = reactive({
  fund_code: '',
  shares: 0,
  date: '',
  remark: ''
})

const netValueForm = reactive({
  fund_code: '',
  date: '',
  net_value: 0,
  accumulated_value: 0,
  remark: ''
})

const uploadReportForm = reactive({
  fund_code: '',
  report_type: '',
  report_date: '',
  report_title: ''
})

const selectedFilePath = ref('')

// 交易记录
const transactionList = ref<any[]>([])

// 净值记录
const netValueList = ref<any[]>([])

// 日报记录
const dailyReportList = ref<any[]>([])

// 周报记录
const weeklyReportList = ref<any[]>([])

const fundForm = reactive({
  fund_code: '',
  fund_name: '',
  custodian_id: null as number | null,
  broker_ids: [] as number[],
  establish_date: '',
  fund_manager: '',
  fund_type: '',
  description: ''
})

// 表单验证规则
const formRules = {
  fund_code: [{ required: true, message: '请输入基金代码', trigger: 'blur' }],
  fund_name: [{ required: true, message: '请输入基金名称', trigger: 'blur' }],
  custodian_id: [{ required: true, message: '请选择托管人', trigger: 'change' }],
  broker_ids: [{ required: true, message: '请至少选择一个经纪服务商', trigger: 'change', type: 'array', min: 1 }],
  establish_date: [{ required: true, message: '请选择成立日期', trigger: 'change' }],
  fund_manager: [{ required: true, message: '请输入基金经理', trigger: 'blur' }],
  fund_type: [{ required: true, message: '请选择基金类型', trigger: 'change' }]
}

// 加载基金列表
const loadFundList = async () => {
  try {
    loading.value = true
    
    const params = {
      page: pagination.page,
      size: pagination.size,
      ...searchForm
    }
    
    // 调用后端接口
    const result = await window.electronAPI.fund.getFundList(params)
    
    if (result.success && result.data) {
      fundList.value = result.data.funds || []
      pagination.total = result.data.pagination?.total || 0
      console.log('✅ 加载基金列表成功:', fundList.value.length, '个基金')
    } else {
      ElMessage.error('加载失败')
    }
  } catch (error: any) {
    ElMessage.error('加载失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

// 加载托管人列表
const loadCustodians = async () => {
  try {
    const result = await window.electronAPI.fund.getCustodians()
    
    if (result.success) {
      custodians.value = result.data || []
      console.log('✅ 加载托管人列表成功:', custodians.value.length, '个')
    }
  } catch (error: any) {
    console.error('加载托管人失败:', error)
  }
}

// 加载经纪商列表
const loadBrokers = async () => {
  try {
    const result = await window.electronAPI.fund.getBrokers()
    
    if (result.success) {
      brokers.value = result.data || []
      console.log('✅ 加载经纪商列表成功:', brokers.value.length, '个')
    }
  } catch (error: any) {
    console.error('加载经纪商失败:', error)
  }
}

// 新建基金
const handleCreate = () => {
  dialogMode.value = 'create'
  dialogVisible.value = true
  
  // 重置表单
  Object.assign(fundForm, {
    fund_code: '',
    fund_name: '',
    custodian_id: null,
    broker_ids: [],
    establish_date: '',
    fund_manager: '',
    fund_type: '',
    description: ''
  })
  
  formRef.value?.clearValidate()
}

// 编辑基金
const handleEdit = (row: any) => {
  dialogMode.value = 'edit'
  dialogVisible.value = true
  
  // 填充表单（需要提取正确的字段）
  // brokers 是字符串数组 ["中信证券", "华泰证券"]
  // 需要匹配名称找到对应的ID
  let brokerIds: number[] = []
  if (row.brokers && row.brokers.length > 0) {
    brokerIds = row.brokers
      .map((brokerName: string) => {
        const broker = brokers.value.find(b => b.name === brokerName)
        return broker?.id
      })
      .filter((id: any) => id !== undefined)
  }
  
  Object.assign(fundForm, {
    fund_code: row.fund_code,
    fund_name: row.fund_name,
    custodian_id: row.custodian?.id || null,
    broker_ids: brokerIds,
    establish_date: row.establish_date,
    fund_manager: row.fund_manager,
    fund_type: row.fund_type,
    description: row.description || ''
  })
  
  formRef.value?.clearValidate()
}

// 查看基金
const handleView = (row: any) => {
  ElMessage.info('查看功能开发中')
}

// 清盘基金
const handleLiquidate = (row: any) => {
  currentFund.value = row
  liquidateForm.fund_code = row.fund_code
  liquidateForm.fund_name = row.fund_name
  liquidateForm.liquidate_date = new Date().toISOString().split('T')[0]
  liquidateForm.reason = ''
  showLiquidateDialog.value = true
}

const submitLiquidate = async () => {
  try {
    const result = await window.electronAPI.fund.liquidateFund(
      liquidateForm.fund_code,
      liquidateForm.liquidate_date,
      liquidateForm.reason
    )
    
    if (result.success) {
      ElMessage.success(result.message || '清盘成功')
      showLiquidateDialog.value = false
      loadFundList()
    } else {
      ElMessage.error(result.message || '清盘失败')
    }
  } catch (error: any) {
    ElMessage.error('清盘失败: ' + error.message)
  }
}

// 恢复基金运作
const handleRestore = (row: any) => {
  currentFund.value = row
  restoreForm.fund_code = row.fund_code
  restoreForm.fund_name = row.fund_name
  restoreForm.restore_date = new Date().toISOString().split('T')[0]
  restoreForm.reason = ''
  showRestoreDialog.value = true
}

const submitRestore = async () => {
  try {
    const result = await window.electronAPI.fund.restoreFund(
      restoreForm.fund_code,
      restoreForm.restore_date,
      restoreForm.reason
    )
    
    if (result.success) {
      ElMessage.success(result.message || '恢复成功')
      showRestoreDialog.value = false
      loadFundList()
    } else {
      ElMessage.error(result.message || '恢复失败')
    }
  } catch (error: any) {
    ElMessage.error('恢复失败: ' + error.message)
  }
}

// 提交表单
const handleSubmit = async () => {
  try {
    await formRef.value?.validate()
    
    submitting.value = true
    
    // 转换为纯JSON对象（避免IPC序列化错误）
    const submitData = {
      fund_code: fundForm.fund_code,
      fund_name: fundForm.fund_name,
      custodian_id: fundForm.custodian_id,
      broker_ids: [...fundForm.broker_ids],  // 复制数组
      establish_date: fundForm.establish_date,
      fund_manager: fundForm.fund_manager,
      fund_type: fundForm.fund_type,
      description: fundForm.description || ''
    }
    
    if (dialogMode.value === 'create') {
      // 调用后端接口 - 创建基金
      const result = await window.electronAPI.fund.createFund(submitData)
      
      if (result.success) {
        ElMessage.success('创建成功')
        dialogVisible.value = false
        loadFundList()
      } else {
        ElMessage.error('创建失败')
      }
    } else {
      // 调用后端接口 - 更新基金
      const result = await window.electronAPI.fund.updateFund(submitData.fund_code, submitData)
      
      if (result.success) {
        ElMessage.success('更新成功')
        dialogVisible.value = false
        loadFundList()
      } else {
        ElMessage.error('更新失败')
      }
    }
  } catch (error: any) {
    if (error !== false) {  // 表单验证失败返回false
      ElMessage.error('操作失败: ' + error.message)
    }
  } finally {
    submitting.value = false
  }
}

// 重置搜索
const handleReset = () => {
  Object.assign(searchForm, {
    fund_name: '',
    custodian: '',
    broker: '',
    status: ''
  })
  pagination.page = 1
  loadFundList()
}

// 托管人管理
const handleAddCustodian = () => {
  ElMessage.info('托管人管理功能开发中')
}

// 经纪商管理
const handleAddBroker = () => {
  ElMessage.info('经纪商管理功能开发中')
}

// 提交申购
const submitSubscribe = () => {
  if (!subscribeForm.fund_code || !subscribeForm.amount || !subscribeForm.date) {
    ElMessage.warning('请填写完整信息')
    return
  }
  
  // TODO: 调用后端接口
  ElMessage.success('申购功能开发中')
  showSubscribeDialog.value = false
}

// 提交赎回
const submitRedeem = () => {
  if (!redeemForm.fund_code || !redeemForm.shares || !redeemForm.date) {
    ElMessage.warning('请填写完整信息')
    return
  }
  
  // TODO: 调用后端接口
  ElMessage.success('赎回功能开发中')
  showRedeemDialog.value = false
}

// 提交净值
const submitNetValue = () => {
  if (!netValueForm.fund_code || !netValueForm.date || !netValueForm.net_value) {
    ElMessage.warning('请填写完整信息')
    return
  }
  
  // TODO: 调用后端接口
  ElMessage.success('净值录入功能开发中')
  showNetValueDialog.value = false
}

// 显示上传报告对话框
const showUploadReportDialog = (type: 'daily' | 'weekly') => {
  uploadReportType.value = type
  uploadReportForm.report_type = type
  uploadReportForm.fund_code = ''
  uploadReportForm.report_date = new Date().toISOString().split('T')[0]
  uploadReportForm.report_title = ''
  selectedFilePath.value = ''
  showUploadReportDialogVisible.value = true
}

// 选择文件（使用 Electron 对话框）
const selectFile = async () => {
  try {
    const result = await window.electronAPI.dialog.showOpenDialog({
      properties: ['openFile']
    })
    
    if (!result.canceled && result.filePaths.length > 0) {
      selectedFilePath.value = result.filePaths[0]
    }
  } catch (error: any) {
    ElMessage.error('选择文件失败')
  }
}

// 上传报告
const submitUploadReport = async () => {
  if (!uploadReportForm.fund_code || !uploadReportForm.report_date || !uploadReportForm.report_title || !selectedFilePath.value) {
    ElMessage.warning('请填写完整信息并选择文件')
    return
  }
  
  try {
    const reportData = {
      fund_code: uploadReportForm.fund_code,
      report_type: uploadReportForm.report_type,
      report_date: uploadReportForm.report_date,
      report_title: uploadReportForm.report_title,
      filePath: selectedFilePath.value
    }
    
    const result = await window.electronAPI.fund.uploadReport(reportData)
    
    if (result.success) {
      ElMessage.success(result.message || '上传成功')
      showUploadReportDialogVisible.value = false
      // 刷新对应类型的报告列表
      loadReports(uploadReportForm.report_type as 'daily' | 'weekly')
    } else {
      ElMessage.error(result.message || '上传失败')
    }
  } catch (error: any) {
    ElMessage.error('上传失败: ' + error.message)
  }
}

// 查看报告（预览）
const viewReport = async (row: any) => {
  try {
    const result = await window.electronAPI.fund.getReportDownloadUrl(row.id)
    
    if (result.success && result.data.download_url) {
      window.open(result.data.download_url)
      ElMessage.success('正在打开报告')
    } else {
      ElMessage.error('获取报告链接失败')
    }
  } catch (error: any) {
    ElMessage.error('打开失败: ' + error.message)
  }
}

// 下载报告（保存到本地）
const downloadReport = async (row: any) => {
  try {
    const result = await window.electronAPI.fund.getReportDownloadUrl(row.id)
    
    if (result.success && result.data.download_url) {
      // 创建隐藏的a标签强制下载
      const a = document.createElement('a')
      a.href = result.data.download_url
      a.download = result.data.file_name || row.file_name
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      
      ElMessage.success('开始下载')
    } else {
      ElMessage.error('获取下载链接失败')
    }
  } catch (error: any) {
    ElMessage.error('下载失败: ' + error.message)
  }
}

// 删除报告
const deleteReport = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确定要删除该报告吗？`, '删除确认', { type: 'warning' })
    
    const result = await window.electronAPI.fund.deleteReport(row.id)
    
    if (result.success) {
      ElMessage.success('删除成功')
      // 刷新日报和周报
      loadReports('daily')
      loadReports('weekly')
    } else {
      ElMessage.error('删除失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败: ' + error.message)
    }
  }
}

// 加载报告列表
const loadReports = async (reportType: 'daily' | 'weekly') => {
  try {
    const params = {
      report_type: reportType,
      page: 1,
      page_size: 100
    }
    
    const result = await window.electronAPI.fund.getReportList(params)
    
    if (result.success && result.data) {
      if (reportType === 'daily') {
        dailyReportList.value = result.data.reports || []
      } else {
        weeklyReportList.value = result.data.reports || []
      }
    }
  } catch (error: any) {
    console.error('加载报告列表失败:', error)
  }
}

// 监听Tab切换，加载对应数据
const handleTabChange = (tabName: string) => {
  if (tabName === 'report') {
    // 切换到报告管理时，加载日报和周报
    loadReports('daily')
    loadReports('weekly')
  }
}

// 设置API Key
const setupApiKey = async () => {
  try {
    const keys = await window.electronAPI.config.getApiKeys()
    const defaultKey = keys.find((k: any) => k.isDefault)
    
    if (defaultKey) {
      const fullKey = await window.electronAPI.config.getFullApiKey(defaultKey.id)
      if (fullKey) {
        await window.electronAPI.fund.setApiKey(fullKey)
        console.log('✅ 基金API Key已设置')
        return true
      }
    }
    
    ElMessage.warning('未找到API Key，请先配置')
    return false
  } catch (error: any) {
    console.error('设置API Key失败:', error)
    ElMessage.error('API Key设置失败')
    return false
  }
}

// 初始化
onMounted(async () => {
  const hasKey = await setupApiKey()
  
  if (hasKey) {
    await loadCustodians()
    await loadBrokers()
    await loadFundList()
    // 加载报告列表
    await loadReports('daily')
    await loadReports('weekly')
  }
})
</script>

<style lang="scss" scoped>
.fund-operations {
  height: 100%;
  width: 100%;
  padding: 0;
  display: flex;
  flex-direction: column;
  
  .main-card {
    flex: 1;
    height: 100%;
    margin: 0;
    border-radius: 0;
    
    :deep(.el-card__body) {
      height: calc(100vh - 120px);
      overflow: auto;
      padding: 20px;
    }
    
    .manage-tabs {
      height: 100%;
      
      :deep(.el-tabs__content) {
        height: calc(100% - 55px);
        overflow: auto;
      }
    }
    
    .tab-toolbar {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    
    .search-bar {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      padding: 20px;
      background: #f5f7fa;
      border-radius: 8px;
    }
    
    .manage-section {
      padding: 20px;
    }
    
    .text-red {
      color: #f56c6c;
      font-weight: 500;
    }
    
    .text-green {
      color: #67c23a;
      font-weight: 500;
    }
  }
}
</style>
