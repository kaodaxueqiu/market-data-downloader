<template>
  <div class="fund-operations">
    <el-card class="main-card">
      <!-- Tab切换 -->
      <el-tabs v-model="activeManageTab" class="manage-tabs" @tab-change="handleTabChange">
        <!-- 基金信息管理Tab -->
        <el-tab-pane 
          v-if="visibleTabs.some(t => t.name === 'fund')" 
          label="基金信息管理" 
          name="fund"
        >
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
        <el-tab-pane 
          v-if="visibleTabs.some(t => t.name === 'basicinfo')" 
          label="基础信息维护" 
          name="basicinfo"
        >
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
                  <el-table-column prop="created_at" label="创建时间" width="160" />
                  <el-table-column label="操作" width="150">
                    <template #default="{ row }">
                      <el-button size="small" type="warning" link @click="editCustodian(row)">编辑</el-button>
                      <el-button size="small" type="danger" link @click="deleteCustodian(row)">删除</el-button>
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
                  <el-table-column prop="created_at" label="创建时间" width="160" />
                  <el-table-column label="操作" width="150">
                    <template #default="{ row }">
                      <el-button size="small" type="warning" link @click="editBroker(row)">编辑</el-button>
                      <el-button size="small" type="danger" link @click="deleteBroker(row)">删除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>
            </el-tabs>
          </div>
        </el-tab-pane>
        
        <!-- 申购赎回Tab -->
        <el-tab-pane 
          v-if="visibleTabs.some(t => t.name === 'transaction')" 
          label="申购赎回" 
          name="transaction"
        >
          <div class="manage-section">
            <div class="tab-toolbar">
              <el-button type="success" :icon="Plus" @click="handleSubscribe">申购</el-button>
              <el-button type="warning" :icon="Minus" @click="handleRedeem">赎回</el-button>
            </div>
            
            <el-table :data="transactionList" stripe border style="margin-top: 20px;">
              <el-table-column prop="transaction_date" label="交易日期" width="120" />
              <el-table-column prop="fund_code" label="基金代码" width="120" />
              <el-table-column prop="fund_name" label="基金名称" width="180" />
              <el-table-column prop="transaction_type" label="交易类型" width="100">
                <template #default="{ row }">
                  <el-tag :type="row.transaction_type === '申购' ? 'success' : 'warning'">
                    {{ row.transaction_type }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="investor_name" label="投资者" width="100" />
              <el-table-column prop="amount" label="金额(元)" width="130" align="right">
                <template #default="{ row }">
                  {{ row.amount?.toLocaleString() || '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="shares" label="份额" width="130" align="right">
                <template #default="{ row }">
                  {{ row.shares?.toFixed(2) || '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="nav" label="净值" width="100" align="right">
                <template #default="{ row }">
                  {{ row.nav?.toFixed(4) || '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="fee" label="手续费(元)" width="100" align="right">
                <template #default="{ row }">
                  {{ row.fee?.toFixed(2) || '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="status" label="状态" width="100">
                <template #default="{ row }">
                  <el-tag :type="row.status === '已确认' ? 'success' : row.status === '已撤销' ? 'info' : 'warning'">
                    {{ row.status }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="created_at" label="创建时间" width="160" />
              <el-table-column label="操作" width="180" fixed="right">
                <template #default="{ row }">
                  <el-button 
                    v-if="row.status === '待确认'" 
                    size="small" 
                    type="success" 
                    link 
                    @click="confirmTrans(row)"
                  >
                    确认
                  </el-button>
                  <el-button 
                    v-if="row.status === '待确认'" 
                    size="small" 
                    type="danger" 
                    link 
                    @click="cancelTrans(row)"
                  >
                    撤销
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
        
        <!-- 净值管理Tab -->
        <el-tab-pane 
          v-if="visibleTabs.some(t => t.name === 'netvalue')" 
          label="净值管理" 
          name="netvalue"
        >
          <div class="manage-section">
            <div class="tab-toolbar">
              <el-button type="primary" :icon="Plus" @click="showNetValueDialog = true">录入净值</el-button>
            </div>
            
            <el-table :data="netValueList" stripe border style="margin-top: 20px;">
              <el-table-column prop="nav_date" label="净值日期" width="120" />
              <el-table-column prop="fund_code" label="基金代码" width="120" />
              <el-table-column prop="fund_name" label="基金名称" width="200" />
              <el-table-column prop="unit_nav" label="单位净值" width="120" align="right">
                <template #default="{ row }">
                  {{ row.unit_nav?.toFixed(4) || '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="accumulated_nav" label="累计净值" width="120" align="right">
                <template #default="{ row }">
                  {{ row.accumulated_nav?.toFixed(4) || '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="daily_return" label="日收益率(%)" width="120" align="right">
                <template #default="{ row }">
                  <span v-if="row.daily_return != null" :class="row.daily_return >= 0 ? 'text-red' : 'text-green'">
                    {{ row.daily_return >= 0 ? '+' : '' }}{{ row.daily_return.toFixed(2) }}%
                  </span>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column prop="total_assets" label="总资产(万)" width="130" align="right">
                <template #default="{ row }">
                  {{ row.total_assets ? (row.total_assets / 10000).toFixed(2) : '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="total_shares" label="总份额(万)" width="130" align="right">
                <template #default="{ row }">
                  {{ row.total_shares ? (row.total_shares / 10000).toFixed(2) : '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="created_at" label="录入时间" width="160" />
              <el-table-column label="操作" width="150" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" type="warning" link @click="editNav(row)">编辑</el-button>
                  <el-button size="small" type="danger" link @click="deleteNav(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
        
        <!-- 报告管理Tab -->
        <el-tab-pane 
          v-if="visibleTabs.some(t => t.name === 'report')" 
          label="报告管理" 
          name="report"
        >
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
        
        <!-- 投资者管理Tab -->
        <el-tab-pane 
          v-if="visibleTabs.some(t => t.name === 'investor')" 
          label="投资者管理" 
          name="investor"
        >
          <div class="manage-section">
            <div class="tab-toolbar">
              <el-button type="primary" :icon="Plus" @click="handleAddInvestor">新增投资者</el-button>
              <el-button :icon="Refresh" @click="loadInvestorList">刷新</el-button>
            </div>
            
            <!-- 搜索栏 -->
            <div class="search-bar" style="margin-top: 20px;">
              <el-select v-model="investorSearch.investor_type" placeholder="投资者类型" clearable style="width: 150px">
                <el-option label="个人" value="个人" />
                <el-option label="机构" value="机构" />
              </el-select>
              <el-select v-model="investorSearch.is_qualified" placeholder="合格状态" clearable style="width: 150px">
                <el-option label="是" value="true" />
                <el-option label="否" value="false" />
              </el-select>
              <el-input v-model="investorSearch.keyword" placeholder="姓名/公司名/手机号" clearable style="width: 250px" />
              <el-button type="primary" :icon="Search" @click="loadInvestorList">搜索</el-button>
            </div>
            
            <el-table :data="investorList" stripe border style="margin-top: 20px;" v-loading="loading">
              <el-table-column prop="investor_code" label="投资者编号" width="150" />
              <el-table-column prop="investor_type" label="类型" width="80">
                <template #default="{ row }">
                  <el-tag :type="row.investor_type === '个人' ? 'primary' : 'success'">
                    {{ row.investor_type }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="name" label="姓名/公司名" width="180">
                <template #default="{ row }">
                  {{ row.name || row.company_name }}
                </template>
              </el-table-column>
              <el-table-column prop="mobile" label="手机号" width="120" />
              <el-table-column prop="is_qualified" label="合格投资者" width="110">
                <template #default="{ row }">
                  <el-tag v-if="row.is_qualified" type="success">是</el-tag>
                  <el-tag v-else type="info">否</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="qualified_type" label="认定依据" width="120" />
              <el-table-column prop="risk_level" label="风险等级" width="100" />
              <el-table-column prop="status" label="状态" width="80">
                <template #default="{ row }">
                  <el-tag v-if="row.status === '正常'" type="success">正常</el-tag>
                  <el-tag v-else type="info">{{ row.status }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="open_date" label="开户日期" width="120" />
              <el-table-column label="操作" width="250" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" type="primary" link @click="viewInvestor(row)">详情</el-button>
                  <el-button size="small" type="warning" link @click="editInvestor(row)">编辑</el-button>
                  <el-button 
                    v-if="!row.is_qualified" 
                    size="small" 
                    type="success" 
                    link 
                    @click="qualifyInvestor(row)"
                  >
                    认定
                  </el-button>
                  <el-button size="small" link @click="riskAssessInvestor(row)">风险评估</el-button>
                  <el-button size="small" type="danger" link @click="deleteInvestor(row)">销户</el-button>
                </template>
              </el-table-column>
            </el-table>
            
            <!-- 分页 -->
            <el-pagination
              v-model:current-page="investorPagination.page"
              v-model:page-size="investorPagination.size"
              :total="investorPagination.total"
              :page-sizes="[10, 20, 50]"
              layout="total, sizes, prev, pager, next"
              @size-change="loadInvestorList"
              @current-change="loadInvestorList"
              style="margin-top: 20px; justify-content: flex-end;"
            />
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
    <el-dialog v-model="showSubscribeDialog" title="基金申购" width="600px">
      <el-form label-width="120px">
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
        <el-form-item label="交易日期" required>
          <el-date-picker
            v-model="subscribeForm.transaction_date"
            type="date"
            placeholder="选择交易日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="投资者姓名" required>
          <el-input v-model="subscribeForm.investor_name" placeholder="请输入投资者姓名" />
        </el-form-item>
        <el-form-item label="投资者账号">
          <el-input v-model="subscribeForm.investor_account" placeholder="可选" />
        </el-form-item>
        <el-form-item label="申购金额(元)" required>
          <el-input-number v-model="subscribeForm.amount" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="净值">
          <el-input-number v-model="subscribeForm.nav" :min="0" :precision="4" placeholder="可选" style="width: 100%" />
        </el-form-item>
        <el-form-item label="份额">
          <el-input-number v-model="subscribeForm.shares" :min="0" :precision="2" placeholder="可选" style="width: 100%" />
        </el-form-item>
        <el-form-item label="手续费(元)">
          <el-input-number v-model="subscribeForm.fee" :min="0" :precision="2" placeholder="可选" style="width: 100%" />
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
    <el-dialog v-model="showRedeemDialog" title="基金赎回" width="600px">
      <el-form label-width="120px">
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
        <el-form-item label="交易日期" required>
          <el-date-picker
            v-model="redeemForm.transaction_date"
            type="date"
            placeholder="选择交易日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="投资者姓名" required>
          <el-input v-model="redeemForm.investor_name" placeholder="请输入投资者姓名" />
        </el-form-item>
        <el-form-item label="投资者账号">
          <el-input v-model="redeemForm.investor_account" placeholder="可选" />
        </el-form-item>
        <el-form-item label="赎回金额(元)" required>
          <el-input-number v-model="redeemForm.amount" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="净值">
          <el-input-number v-model="redeemForm.nav" :min="0" :precision="4" placeholder="可选" style="width: 100%" />
        </el-form-item>
        <el-form-item label="份额">
          <el-input-number v-model="redeemForm.shares" :min="0" :precision="2" placeholder="可选" style="width: 100%" />
        </el-form-item>
        <el-form-item label="手续费(元)">
          <el-input-number v-model="redeemForm.fee" :min="0" :precision="2" placeholder="可选" style="width: 100%" />
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
    
    <!-- 托管人对话框 -->
    <el-dialog 
      v-model="showCustodianDialog" 
      :title="editingCustodian ? '编辑托管人' : '新增托管人'" 
      width="500px"
    >
      <el-form label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="custodianForm.name" placeholder="请输入托管人名称" />
        </el-form-item>
        <el-form-item label="简称" required>
          <el-input v-model="custodianForm.short_name" placeholder="请输入简称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCustodianDialog = false">取消</el-button>
        <el-button type="primary" @click="submitCustodian">
          {{ editingCustodian ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
    
    <!-- 经纪商对话框 -->
    <el-dialog 
      v-model="showBrokerDialog" 
      :title="editingBroker ? '编辑经纪商' : '新增经纪商'" 
      width="500px"
    >
      <el-form label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="brokerForm.name" placeholder="请输入经纪商名称" />
        </el-form-item>
        <el-form-item label="简称" required>
          <el-input v-model="brokerForm.short_name" placeholder="请输入简称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showBrokerDialog = false">取消</el-button>
        <el-button type="primary" @click="submitBroker">
          {{ editingBroker ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
    
    <!-- 净值录入对话框 -->
    <el-dialog 
      v-model="showNetValueDialog" 
      :title="editingNav ? '编辑净值' : '录入净值'" 
      width="600px"
      @close="editingNav = null"
    >
      <el-form label-width="120px">
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
        <el-form-item label="净值日期" required>
          <el-date-picker
            v-model="netValueForm.nav_date"
            type="date"
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="单位净值" required>
          <el-input-number
            v-model="netValueForm.unit_nav"
            :min="0"
            :precision="4"
            :step="0.0001"
            placeholder="单位净值"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="累计净值">
          <el-input-number
            v-model="netValueForm.accumulated_nav"
            :min="0"
            :precision="4"
            :step="0.0001"
            placeholder="累计净值"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="日收益率(%)">
          <el-input-number
            v-model="netValueForm.daily_return"
            :precision="2"
            :step="0.01"
            placeholder="可选"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="总资产(元)">
          <el-input-number
            v-model="netValueForm.total_assets"
            :min="0"
            :precision="2"
            :step="10000"
            placeholder="可选"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="总份额">
          <el-input-number
            v-model="netValueForm.total_shares"
            :min="0"
            :precision="2"
            :step="1000"
            placeholder="可选"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="netValueForm.remark" type="textarea" :rows="3" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showNetValueDialog = false">取消</el-button>
        <el-button type="primary" @click="submitNetValue">
          {{ editingNav ? '保存' : '确定录入' }}
        </el-button>
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
    
    <!-- 新增/编辑投资者对话框 -->
    <el-dialog
      v-model="showInvestorDialog"
      :title="editingInvestor ? '编辑投资者' : '新增投资者'"
      width="700px"
    >
      <el-form :model="investorForm" label-width="120px">
        <el-form-item label="投资者类型" required>
          <el-radio-group v-model="investorForm.investor_type">
            <el-radio label="个人">个人</el-radio>
            <el-radio label="机构">机构</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item label="投资者编号" required>
          <el-input v-model="investorForm.investor_code" placeholder="如: INV20251122001" />
        </el-form-item>
        
        <template v-if="investorForm.investor_type === '个人'">
          <el-form-item label="姓名" required>
            <el-input v-model="investorForm.name" />
          </el-form-item>
          <el-form-item label="性别">
            <el-radio-group v-model="investorForm.gender">
              <el-radio label="男">男</el-radio>
              <el-radio label="女">女</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="身份证号">
            <el-input v-model="investorForm.id_card" />
          </el-form-item>
          <el-form-item label="出生日期">
            <el-date-picker v-model="investorForm.birth_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
        </template>
        
        <template v-else>
          <el-form-item label="公司名称" required>
            <el-input v-model="investorForm.company_name" />
          </el-form-item>
          <el-form-item label="法人代表">
            <el-input v-model="investorForm.legal_person" />
          </el-form-item>
          <el-form-item label="营业执照号">
            <el-input v-model="investorForm.business_license" />
          </el-form-item>
        </template>
        
        <el-form-item label="手机号">
          <el-input v-model="investorForm.mobile" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="investorForm.email" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="investorForm.address" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="银行账号">
          <el-input v-model="investorForm.bank_account" />
        </el-form-item>
        <el-form-item label="开户行">
          <el-input v-model="investorForm.bank_name" />
        </el-form-item>
        <el-form-item label="开户日期" required>
          <el-date-picker v-model="investorForm.open_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="investorForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showInvestorDialog = false">取消</el-button>
        <el-button type="primary" @click="submitInvestor">{{ editingInvestor ? '保存' : '创建' }}</el-button>
      </template>
    </el-dialog>
    
    <!-- 合格投资者认定对话框 -->
    <el-dialog v-model="showQualifyDialog" title="合格投资者认定" width="600px">
      <el-alert
        title="监管标准：个人金融资产≥300万 或 年收入≥50万；机构净资产≥1000万"
        type="info"
        :closable="false"
        style="margin-bottom: 20px"
      />
      <el-form :model="qualifyForm" label-width="120px">
        <el-form-item label="认定依据" required>
          <el-select v-model="qualifyForm.qualified_type" style="width: 100%">
            <el-option label="金融资产" value="金融资产" />
            <el-option label="年收入" value="年收入" v-if="currentInvestor?.investor_type === '个人'" />
            <el-option label="专业投资者" value="专业投资者" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="金融资产(万元)" v-if="qualifyForm.qualified_type === '金融资产'">
          <el-input-number v-model="qualifyForm.financial_assets" :min="0" :precision="2" style="width: 100%" />
          <div style="font-size: 12px; color: #909399; margin-top: 5px;">
            {{ currentInvestor?.investor_type === '个人' ? '需≥300万元' : '需≥1000万元' }}
          </div>
        </el-form-item>
        
        <el-form-item label="年收入(万元)" v-if="qualifyForm.qualified_type === '年收入'">
          <el-input-number v-model="qualifyForm.annual_income" :min="0" :precision="2" style="width: 100%" />
          <div style="font-size: 12px; color: #909399; margin-top: 5px;">需≥50万元</div>
        </el-form-item>
        
        <el-form-item label="认定日期" required>
          <el-date-picker v-model="qualifyForm.qualified_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        
        <el-form-item label="认定方式" required>
          <el-select v-model="qualifyForm.qualified_method" style="width: 100%">
            <el-option label="自我声明" value="自我声明" />
            <el-option label="第三方证明" value="第三方证明" />
            <el-option label="机构证明" value="机构证明" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="证明材料">
          <el-input v-model="qualifyForm.qualified_proof" type="textarea" :rows="3" placeholder="如：银行资产证明" />
        </el-form-item>
        
        <el-form-item label="备注">
          <el-input v-model="qualifyForm.qualified_remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showQualifyDialog = false">取消</el-button>
        <el-button type="primary" @click="submitQualify">提交认定</el-button>
      </template>
    </el-dialog>
    
    <!-- 风险评估对话框 -->
    <el-dialog v-model="showRiskAssessDialog" title="风险评估" width="500px">
      <el-form :model="riskAssessForm" label-width="120px">
        <el-form-item label="风险等级" required>
          <el-select v-model="riskAssessForm.risk_level" style="width: 100%">
            <el-option label="保守型" value="保守型" />
            <el-option label="稳健型" value="稳健型" />
            <el-option label="积极型" value="积极型" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="风险评分">
          <el-input-number v-model="riskAssessForm.risk_score" :min="0" :max="100" style="width: 100%" />
          <div style="font-size: 12px; color: #909399; margin-top: 5px;">0-100分，可选</div>
        </el-form-item>
        
        <el-form-item label="评估日期" required>
          <el-date-picker v-model="riskAssessForm.risk_assess_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        
        <el-form-item label="备注">
          <el-input v-model="riskAssessForm.risk_remark" type="textarea" :rows="3" placeholder="如：投资经验3年" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRiskAssessDialog = false">取消</el-button>
        <el-button type="primary" @click="submitRiskAssess">提交评估</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, FormInstance } from 'element-plus'
import { 
  Plus,
  Minus,
  Refresh, 
  Search, 
  RefreshRight,
  Upload
} from '@element-plus/icons-vue'

// 数据
const activeManageTab = ref('fund')
const loading = ref(false)
const fundList = ref<any[]>([])
const custodians = ref<any[]>([])
const brokers = ref<any[]>([])

// 菜单权限
const menuPermissions = ref<string[]>([])

// Tab配置（与3级菜单ID对应）
const tabConfigs = [
  { name: 'fund', label: '基金信息管理', menuId: 'fund_info_manage' },
  { name: 'basicinfo', label: '基础信息维护', menuId: 'fund_basic_info' },
  { name: 'transaction', label: '申购赎回', menuId: 'fund_subscription' },
  { name: 'netvalue', label: '净值管理', menuId: 'fund_nav_manage' },
  { name: 'report', label: '报告管理', menuId: 'fund_report_manage' },
  { name: 'investor', label: '投资者管理', menuId: 'fund_investor_manage' }
]

// 可见的Tab（根据权限过滤）
const visibleTabs = computed(() => {
  return tabConfigs.filter(tab => 
    menuPermissions.value.includes(tab.menuId)
  )
})

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
const showCustodianDialog = ref(false)
const showBrokerDialog = ref(false)
const showInvestorDialog = ref(false)
const showQualifyDialog = ref(false)
const showRiskAssessDialog = ref(false)
const uploadReportType = ref<'daily' | 'weekly'>('daily')
const currentFund = ref<any>(null)
const currentInvestor = ref<any>(null)
const editingNav = ref<any>(null)
const editingCustodian = ref<any>(null)
const editingBroker = ref<any>(null)
const editingInvestor = ref<any>(null)

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
  transaction_date: '',
  investor_name: '',
  investor_account: '',
  amount: 0,
  nav: 0,
  shares: 0,
  fee: 0,
  remark: ''
})

const redeemForm = reactive({
  fund_code: '',
  transaction_date: '',
  investor_name: '',
  investor_account: '',
  amount: 0,
  nav: 0,
  shares: 0,
  fee: 0,
  remark: ''
})

const netValueForm = reactive({
  fund_code: '',
  nav_date: '',
  unit_nav: 0,
  accumulated_nav: 0,
  daily_return: 0,
  total_assets: 0,
  total_shares: 0,
  remark: ''
})

const uploadReportForm = reactive({
  fund_code: '',
  report_type: '',
  report_date: '',
  report_title: ''
})

const selectedFilePath = ref('')

const custodianForm = reactive({
  name: '',
  short_name: ''
})

const brokerForm = reactive({
  name: '',
  short_name: ''
})

const investorForm = reactive({
  investor_type: '个人',
  investor_code: '',
  name: '',
  company_name: '',
  id_card: '',
  mobile: '',
  email: '',
  gender: '男',
  birth_date: '',
  legal_person: '',
  business_license: '',
  address: '',
  account_number: '',
  bank_account: '',
  bank_name: '',
  open_date: '',
  remark: ''
})

const qualifyForm = reactive({
  qualified_type: '金融资产',
  financial_assets: 0,
  annual_income: 0,
  qualified_date: '',
  qualified_method: '第三方证明',
  qualified_proof: '',
  qualified_remark: ''
})

const riskAssessForm = reactive({
  risk_level: '稳健型',
  risk_score: 0,
  risk_assess_date: '',
  risk_remark: ''
})

// 交易记录
const transactionList = ref<any[]>([])

// 净值记录
const netValueList = ref<any[]>([])

// 日报记录
const dailyReportList = ref<any[]>([])

// 周报记录
const weeklyReportList = ref<any[]>([])

// 投资者列表
const investorList = ref<any[]>([])
const investorSearch = reactive({
  investor_type: '',
  is_qualified: '',
  keyword: ''
})
const investorPagination = reactive({
  page: 1,
  size: 20,
  total: 0
})

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
const handleView = (_row: any) => {
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
  editingCustodian.value = null
  custodianForm.name = ''
  custodianForm.short_name = ''
  showCustodianDialog.value = true
}

const editCustodian = (row: any) => {
  editingCustodian.value = row
  custodianForm.name = row.name
  custodianForm.short_name = row.short_name
  showCustodianDialog.value = true
}

const submitCustodian = async () => {
  if (!custodianForm.name || !custodianForm.short_name) {
    ElMessage.warning('请填写完整信息')
    return
  }
  
  try {
    let result
    if (editingCustodian.value) {
      result = await window.electronAPI.fund.updateCustodian(editingCustodian.value.id, custodianForm)
    } else {
      result = await window.electronAPI.fund.createCustodian(custodianForm)
    }
    
    if (result.success) {
      ElMessage.success(editingCustodian.value ? '更新成功' : '创建成功')
      showCustodianDialog.value = false
      loadCustodians()
    } else {
      ElMessage.error('操作失败')
    }
  } catch (error: any) {
    ElMessage.error('操作失败: ' + error.message)
  }
}

const deleteCustodian = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确定要删除托管人 ${row.name} 吗？`, '删除确认', { type: 'warning' })
    
    const result = await window.electronAPI.fund.deleteCustodian(row.id)
    
    if (result.success) {
      ElMessage.success('删除成功')
      loadCustodians()
    } else {
      ElMessage.error('删除失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败: ' + error.message)
    }
  }
}

// 经纪商管理
const handleAddBroker = () => {
  editingBroker.value = null
  brokerForm.name = ''
  brokerForm.short_name = ''
  showBrokerDialog.value = true
}

const editBroker = (row: any) => {
  editingBroker.value = row
  brokerForm.name = row.name
  brokerForm.short_name = row.short_name
  showBrokerDialog.value = true
}

const submitBroker = async () => {
  if (!brokerForm.name || !brokerForm.short_name) {
    ElMessage.warning('请填写完整信息')
    return
  }
  
  try {
    let result
    if (editingBroker.value) {
      result = await window.electronAPI.fund.updateBroker(editingBroker.value.id, brokerForm)
    } else {
      result = await window.electronAPI.fund.createBroker(brokerForm)
    }
    
    if (result.success) {
      ElMessage.success(editingBroker.value ? '更新成功' : '创建成功')
      showBrokerDialog.value = false
      loadBrokers()
    } else {
      ElMessage.error('操作失败')
    }
  } catch (error: any) {
    ElMessage.error('操作失败: ' + error.message)
  }
}

const deleteBroker = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确定要删除经纪商 ${row.name} 吗？`, '删除确认', { type: 'warning' })
    
    const result = await window.electronAPI.fund.deleteBroker(row.id)
    
    if (result.success) {
      ElMessage.success('删除成功')
      loadBrokers()
    } else {
      ElMessage.error('删除失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败: ' + error.message)
    }
  }
}

// ========== 投资者管理 ==========

const loadInvestorList = async () => {
  try {
    loading.value = true
    const params = {
      ...investorSearch,
      page: investorPagination.page,
      page_size: investorPagination.size
    }
    
    const result = await window.electronAPI.fund.getInvestorList(params)
    
    if (result.success && result.data) {
      investorList.value = result.data.investors || []
      investorPagination.total = result.data.pagination?.total || 0
    }
  } catch (error: any) {
    ElMessage.error('加载失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

const handleAddInvestor = () => {
  showInvestorDialog.value = true
  editingInvestor.value = null
  Object.assign(investorForm, {
    investor_type: '个人',
    investor_code: '',
    name: '',
    company_name: '',
    id_card: '',
    mobile: '',
    email: '',
    gender: '男',
    birth_date: '',
    legal_person: '',
    business_license: '',
    address: '',
    account_number: '',
    bank_account: '',
    bank_name: '',
    open_date: new Date().toISOString().split('T')[0],
    remark: ''
  })
}

const viewInvestor = async (row: any) => {
  try {
    const result = await window.electronAPI.fund.getInvestorDetail(row.id)
    if (result.success && result.data) {
      // TODO: 显示详情对话框
      console.log('投资者详情:', result.data)
      ElMessage.info('查看详情')
    }
  } catch (error: any) {
    ElMessage.error('获取详情失败: ' + error.message)
  }
}

const editInvestor = (row: any) => {
  showInvestorDialog.value = true
  editingInvestor.value = row
  Object.assign(investorForm, row)
}

const qualifyInvestor = (row: any) => {
  showQualifyDialog.value = true
  currentInvestor.value = row
  Object.assign(qualifyForm, {
    qualified_type: '金融资产',
    financial_assets: 0,
    annual_income: 0,
    qualified_date: new Date().toISOString().split('T')[0],
    qualified_method: '第三方证明',
    qualified_proof: '',
    qualified_remark: ''
  })
}

const riskAssessInvestor = (row: any) => {
  showRiskAssessDialog.value = true
  currentInvestor.value = row
  Object.assign(riskAssessForm, {
    risk_level: '稳健型',
    risk_score: 0,
    risk_assess_date: new Date().toISOString().split('T')[0],
    risk_remark: ''
  })
}

const deleteInvestor = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要销户投资者 ${row.name || row.company_name} 吗？销户后状态将变为"销户"，数据会保留。`,
      '销户确认',
      { type: 'warning' }
    )
    
    const result = await window.electronAPI.fund.deleteInvestor(row.id)
    
    if (result.success) {
      ElMessage.success('销户成功')
      loadInvestorList()
    } else {
      ElMessage.error('销户失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('销户失败: ' + error.message)
    }
  }
}

const submitInvestor = async () => {
  if (investorForm.investor_type === '个人') {
    if (!investorForm.investor_code || !investorForm.name || !investorForm.open_date) {
      ElMessage.warning('请填写完整信息')
      return
    }
  } else {
    if (!investorForm.investor_code || !investorForm.company_name || !investorForm.open_date) {
      ElMessage.warning('请填写完整信息')
      return
    }
  }
  
  try {
    let result
    if (editingInvestor.value) {
      result = await window.electronAPI.fund.updateInvestor(editingInvestor.value.id, investorForm)
    } else {
      result = await window.electronAPI.fund.createInvestor(investorForm)
    }
    
    if (result.success) {
      ElMessage.success(editingInvestor.value ? '更新成功' : '创建成功')
      showInvestorDialog.value = false
      loadInvestorList()
    } else {
      ElMessage.error('操作失败')
    }
  } catch (error: any) {
    ElMessage.error('操作失败: ' + error.message)
  }
}

const submitQualify = async () => {
  if (!qualifyForm.qualified_type || !qualifyForm.qualified_date || !qualifyForm.qualified_method) {
    ElMessage.warning('请填写完整信息')
    return
  }
  
  try {
    const result = await window.electronAPI.fund.qualifyInvestor(currentInvestor.value.id, qualifyForm)
    
    if (result.success) {
      ElMessage.success('认定成功')
      showQualifyDialog.value = false
      loadInvestorList()
    } else {
      ElMessage.error('认定失败')
    }
  } catch (error: any) {
    ElMessage.error('认定失败: ' + error.message)
  }
}

const submitRiskAssess = async () => {
  if (!riskAssessForm.risk_level || !riskAssessForm.risk_assess_date) {
    ElMessage.warning('请填写完整信息')
    return
  }
  
  try {
    const result = await window.electronAPI.fund.riskAssessInvestor(currentInvestor.value.id, riskAssessForm)
    
    if (result.success) {
      ElMessage.success('风险评估成功')
      showRiskAssessDialog.value = false
      loadInvestorList()
    } else {
      ElMessage.error('风险评估失败')
    }
  } catch (error: any) {
    ElMessage.error('风险评估失败: ' + error.message)
  }
}

// 打开申购对话框
const handleSubscribe = () => {
  subscribeForm.fund_code = ''
  subscribeForm.transaction_date = new Date().toISOString().split('T')[0]
  subscribeForm.investor_name = ''
  subscribeForm.investor_account = ''
  subscribeForm.amount = 0
  subscribeForm.nav = 0
  subscribeForm.shares = 0
  subscribeForm.fee = 0
  subscribeForm.remark = ''
  showSubscribeDialog.value = true
}

// 打开赎回对话框
const handleRedeem = () => {
  redeemForm.fund_code = ''
  redeemForm.transaction_date = new Date().toISOString().split('T')[0]
  redeemForm.investor_name = ''
  redeemForm.investor_account = ''
  redeemForm.amount = 0
  redeemForm.nav = 0
  redeemForm.shares = 0
  redeemForm.fee = 0
  redeemForm.remark = ''
  showRedeemDialog.value = true
}

// 提交申购
const submitSubscribe = async () => {
  if (!subscribeForm.fund_code || !subscribeForm.transaction_date || !subscribeForm.amount || !subscribeForm.investor_name) {
    ElMessage.warning('请填写完整信息')
    return
  }
  
  try {
    // 只传有值的字段
    const data: any = {
      fund_code: subscribeForm.fund_code,
      transaction_type: '申购',
      transaction_date: subscribeForm.transaction_date,
      amount: subscribeForm.amount
    }
    
    // 可选字段：只有有值时才传
    if (subscribeForm.investor_name) data.investor_name = subscribeForm.investor_name
    if (subscribeForm.investor_account) data.investor_account = subscribeForm.investor_account
    if (subscribeForm.nav > 0) data.nav = subscribeForm.nav
    if (subscribeForm.shares > 0) data.shares = subscribeForm.shares
    if (subscribeForm.fee > 0) data.fee = subscribeForm.fee
    if (subscribeForm.remark) data.remark = subscribeForm.remark
    
    const result = await window.electronAPI.fund.createTransaction(data)
    
    if (result.success) {
      ElMessage.success(result.message || '申购成功')
      showSubscribeDialog.value = false
      loadTransactionList()
    } else {
      ElMessage.error(result.message || '申购失败')
    }
  } catch (error: any) {
    ElMessage.error('申购失败: ' + error.message)
  }
}

// 提交赎回
const submitRedeem = async () => {
  if (!redeemForm.fund_code || !redeemForm.transaction_date || !redeemForm.amount || !redeemForm.investor_name) {
    ElMessage.warning('请填写完整信息')
    return
  }
  
  try {
    // 只传有值的字段
    const data: any = {
      fund_code: redeemForm.fund_code,
      transaction_type: '赎回',
      transaction_date: redeemForm.transaction_date,
      amount: redeemForm.amount
    }
    
    // 可选字段：只有有值时才传
    if (redeemForm.investor_name) data.investor_name = redeemForm.investor_name
    if (redeemForm.investor_account) data.investor_account = redeemForm.investor_account
    if (redeemForm.nav > 0) data.nav = redeemForm.nav
    if (redeemForm.shares > 0) data.shares = redeemForm.shares
    if (redeemForm.fee > 0) data.fee = redeemForm.fee
    if (redeemForm.remark) data.remark = redeemForm.remark
    
    const result = await window.electronAPI.fund.createTransaction(data)
    
    if (result.success) {
      ElMessage.success(result.message || '赎回成功')
      showRedeemDialog.value = false
      loadTransactionList()
    } else {
      ElMessage.error(result.message || '赎回失败')
    }
  } catch (error: any) {
    ElMessage.error('赎回失败: ' + error.message)
  }
}

// 加载交易列表
const loadTransactionList = async () => {
  try {
    const params = {
      page: 1,
      page_size: 100
    }
    
    const result = await window.electronAPI.fund.getTransactionList(params)
    
    if (result.success && result.data) {
      transactionList.value = result.data.transactions || []
    }
  } catch (error: any) {
    console.error('加载交易列表失败:', error)
  }
}

// 确认交易
const confirmTrans = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确定确认该交易吗？`, '确认交易', { type: 'success' })
    
    const data = {
      confirm_date: new Date().toISOString().split('T')[0],
      shares: row.shares,
      nav: row.nav
    }
    
    const result = await window.electronAPI.fund.confirmTransaction(row.id, data)
    
    if (result.success) {
      ElMessage.success('确认成功')
      loadTransactionList()
    } else {
      ElMessage.error('确认失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('确认失败: ' + error.message)
    }
  }
}

// 撤销交易
const cancelTrans = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确定撤销该交易吗？`, '撤销确认', { type: 'warning' })
    
    const result = await window.electronAPI.fund.cancelTransaction(row.id)
    
    if (result.success) {
      ElMessage.success('撤销成功')
      loadTransactionList()
    } else {
      ElMessage.error('撤销失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('撤销失败: ' + error.message)
    }
  }
}

// 提交净值
const submitNetValue = async () => {
  if (!netValueForm.fund_code || !netValueForm.nav_date || !netValueForm.unit_nav) {
    ElMessage.warning('请填写完整信息')
    return
  }
  
  try {
    let result
    
    if (editingNav.value) {
      // 编辑模式
      result = await window.electronAPI.fund.updateNav(editingNav.value.id, netValueForm)
    } else {
      // 新建模式
      result = await window.electronAPI.fund.createNav(netValueForm)
    }
    
    if (result.success) {
      ElMessage.success(result.message || (editingNav.value ? '更新成功' : '录入成功'))
      showNetValueDialog.value = false
      editingNav.value = null
      loadNavList()
    } else {
      ElMessage.error(result.message || '操作失败')
    }
  } catch (error: any) {
    ElMessage.error('操作失败: ' + error.message)
  }
}

// 加载净值列表
const loadNavList = async () => {
  try {
    const params = {
      page: 1,
      page_size: 100
    }
    
    const result = await window.electronAPI.fund.getNavList(params)
    
    if (result.success && result.data) {
      netValueList.value = result.data.nav_list || result.data.navs || []
    }
  } catch (error: any) {
    console.error('加载净值列表失败:', error)
  }
}

// 编辑净值
const editNav = (row: any) => {
  editingNav.value = row
  Object.assign(netValueForm, {
    fund_code: row.fund_code,
    nav_date: row.nav_date,
    unit_nav: row.unit_nav,
    accumulated_nav: row.accumulated_nav || 0,
    daily_return: row.daily_return || 0,
    total_assets: row.total_assets || 0,
    total_shares: row.total_shares || 0,
    remark: row.remark || ''
  })
  showNetValueDialog.value = true
}

// 删除净值
const deleteNav = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除 ${row.nav_date} 的净值记录吗？`,
      '删除确认',
      { type: 'warning' }
    )
    
    const result = await window.electronAPI.fund.deleteNav(row.id)
    
    if (result.success) {
      ElMessage.success('删除成功')
      loadNavList()
    } else {
      ElMessage.error('删除失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败: ' + error.message)
    }
  }
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
  console.log('Tab切换到:', tabName)
  if (tabName === 'report') {
    // 切换到报告管理时，加载日报和周报
    loadReports('daily')
    loadReports('weekly')
  }
}

// 获取菜单权限
const loadMenuPermissions = async () => {
  try {
    // 调用后端接口获取用户的菜单权限
    const result = await window.electronAPI.account.getMyMenus()
    
    if (result.success && result.data) {
      menuPermissions.value = result.data.menu_permissions || []
      console.log('✅ 用户菜单权限:', menuPermissions.value)
      
      // 如果当前Tab不可见，切换到第一个可见的Tab
      if (visibleTabs.value.length > 0) {
        const currentTabVisible = visibleTabs.value.some(t => t.name === activeManageTab.value)
        if (!currentTabVisible) {
          activeManageTab.value = visibleTabs.value[0].name
        }
      }
    }
  } catch (error: any) {
    console.error('获取菜单权限失败:', error)
    // 如果获取失败，默认显示所有Tab
    menuPermissions.value = tabConfigs.map(t => t.menuId)
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
  // 先获取菜单权限
  await loadMenuPermissions()
  
  const hasKey = await setupApiKey()
  
  if (hasKey) {
    await loadCustodians()
    await loadBrokers()
    await loadFundList()
    await loadReports('daily')
    await loadReports('weekly')
    await loadNavList()
    await loadTransactionList()
    await loadInvestorList()
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
