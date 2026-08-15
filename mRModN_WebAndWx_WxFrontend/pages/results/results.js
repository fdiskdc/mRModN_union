const { ENDPOINTS, buildWebUrl } = require('../../utils/config/api');
const { requestWithFallback } = require('../../utils/request');
const { MODIFICATIONS } = require('../../utils/constants/modifications');
const { normalizeGraph, topAttentionIndices } = require('../../utils/graph');

const GROUP_LABELS = { 'Group A': '腺嘌呤 A', 'Group C': '胞嘧啶 C', 'Group G': '鸟嘌呤 G', 'Group U': '尿嘧啶 U', A: '腺嘌呤 A', C: '胞嘧啶 C', G: '鸟嘌呤 G', U: '尿嘧啶 U' };
const RESULT_TABS = [{value:'overview',label:'概览'},{value:'classification',label:'分类'},{value:'attention',label:'注意力'},{value:'structure',label:'RNA 结构'}];

function formatClassification(value) {
  if (!value) return null;
  return { ...value, name: 'RNA 修饰分类', children: (value.children || []).map((group) => ({ ...group, name: GROUP_LABELS[group.name] || group.name, children: group.children || [] })) };
}
function predictedNames(classification) {
  const names=[];(classification&&classification.children||[]).forEach(group=>(group.children||[]).forEach(item=>{if(item.isPredicted)names.push(item.name);}));return names;
}
function prepareResult(item, displayIndex) {
  const classification=formatClassification(item.classification), sequence=item.sequence||(item.attention&&item.attention.sequence)||(item.gcn&&item.gcn.sequence)||'';
  const names=predictedNames(classification), graph=normalizeGraph(item.gcn,sequence), weights=((item.attention&&item.attention.weights)||[]).map(v=>({...v,scoreText:Number(v.score||0).toFixed(6)}));
  const classes=(classification&&classification.children||[]).reduce((all,group)=>all.concat(group.children||[]),[]);
  const topClass=classes.slice().sort((a,b)=>Number(b.probability||0)-Number(a.probability||0))[0];
  const topModification=topClass&&typeof topClass.probability==='number'?`${topClass.name} · ${(topClass.probability*100).toFixed(1)}%`:(topClass&&topClass.name)||'暂无概率数据';
  return {...item,displayIndex,sequence,sequencePreview:sequence.length>54?`${sequence.slice(0,54)}…`:sequence,sequenceLength:sequence.length,predictedCount:names.length,edgeCount:graph.edges.length,topModification,classification,modificationNames:names,attentionWeights:weights,gcn:graph,highlightedIndices:topAttentionIndices(weights)};
}

Page({
  data: {
    batchJobId:'', isLoading:true, error:'', results:[], currentResultIndex:0, currentResult:null,
    resultTabs:RESULT_TABS, currentResultTab:'overview', attentionMode:'sites',
    attentionDistribution:null, attentionClasses:[], attentionClassIndex:0, selectedAttentionClass:null,
    selectedPosition:-1, loadingAttention:false, predictedOnly:true
  },
  onLoad(options) {
    if(!options.batchJobId){this.setData({isLoading:false,error:'缺少批量任务 ID'});return;}
    const batchJobId=decodeURIComponent(options.batchJobId);this.setData({batchJobId});
    const cached=wx.getStorageSync(`batch:${batchJobId}`);if(cached&&cached.results&&cached.results.length)this.applyResults(cached.results,false);
    this.loadBatch();
  },
  onPullDownRefresh(){this.loadBatch().finally(()=>wx.stopPullDownRefresh());},
  loadBatch(){this.setData({error:''});return requestWithFallback(ENDPOINTS.WX_TASK_PROGRESS(this.data.batchJobId),{method:'GET'}).then(res=>{
    const payload=res.data&&res.data.data;if(!payload)throw {message:'任务响应格式无效'};const results=(payload.results||[]).slice().sort((a,b)=>a.index-b.index);wx.setStorageSync(`batch:${this.data.batchJobId}`,{batchJobId:this.data.batchJobId,results,status:payload.status,updatedAt:Date.now()});this.applyResults(results,true);
  }).catch(err=>{if(err.statusCode===401){wx.removeStorageSync('sessionToken');this.setData({isLoading:false,error:'登录已失效，请返回首页重新登录'});return;}if(!this.data.results.length)this.setData({isLoading:false,error:err.message||'无法加载结果'});});},
  applyResults(items,refresh){
    const valid=items.filter(item=>item.status!=='failed').map((item,index)=>prepareResult(item,index+1));
    if(!valid.length){this.setData({isLoading:false,error:items.length?'所有序列分析均失败':'任务尚未产生结果'});return;}
    const index=Math.min(this.data.currentResultIndex,valid.length-1);this.setData({results:valid,currentResultIndex:index,currentResult:valid[index],isLoading:false,error:''});
    const missing=valid.filter(item=>item.jobId&&(!item.classification||!item.gcn||!item.attention));if(refresh&&missing.length)Promise.all(missing.map(item=>this.loadSingle(item.jobId,item.index))).then(()=>{});
  },
  loadSingle(jobId,originalIndex){return requestWithFallback(ENDPOINTS.RESULT(jobId),{method:'GET'}).then(res=>{const items=this.data.results.slice();const position=items.findIndex(item=>item.jobId===jobId);if(position>=0){items[position]=prepareResult({...items[position],...res.data,index:originalIndex},position+1);this.setData({results:items,currentResult:position===this.data.currentResultIndex?items[position]:this.data.currentResult});}}).catch(()=>{});},
  onSequenceTab(e){const index=Number(e.currentTarget.dataset.index);this.setData({currentResultIndex:index,currentResult:this.data.results[index],attentionDistribution:null,attentionClasses:[],attentionClassIndex:0,selectedAttentionClass:null,selectedPosition:-1});if(this.data.currentResultTab==='attention'&&this.data.attentionMode==='distribution')this.loadAttentionDistribution();},
  onResultTab(e){const tab=e.detail.value;this.setData({currentResultTab:tab});if(tab==='attention'&&this.data.attentionMode==='distribution')this.loadAttentionDistribution();},
  onSummaryOpen(e){this.setData({currentResultTab:e.detail.tab});if(e.detail.tab==='attention'&&this.data.attentionMode==='distribution')this.loadAttentionDistribution();},
  setAttentionMode(e){const mode=e.currentTarget.dataset.mode;this.setData({attentionMode:mode});if(mode==='distribution')this.loadAttentionDistribution();},
  loadAttentionDistribution(force){
    const result=this.data.currentResult;if(!result||!result.jobId||this.data.loadingAttention)return;if(this.data.attentionDistribution&&!force)return;
    this.setData({loadingAttention:true});requestWithFallback(ENDPOINTS.ATTENTION_DISTRIBUTION(result.jobId,this.data.predictedOnly),{method:'GET'}).then(res=>{
      const data=res.data||{},classes=(data.classes||[]).map(item=>({...item,probabilityText:`${(Number(item.probability||0)*100).toFixed(2)}%`}));this.setData({attentionDistribution:data,attentionClasses:classes,attentionClassIndex:0,selectedAttentionClass:classes[0]||null,loadingAttention:false});
    }).catch(err=>this.setData({loadingAttention:false,attentionDistribution:{error:err.message},attentionClasses:[],selectedAttentionClass:null}));
  },
  onAttentionClass(e){const index=Number(e.detail.value);this.setData({attentionClassIndex:index,selectedAttentionClass:this.data.attentionClasses[index]});},
  toggleAllClasses(e){this.setData({predictedOnly:!e.detail.value,attentionDistribution:null},()=>this.loadAttentionDistribution(true));},
  onAttentionSite(e){this.setData({selectedPosition:e.detail.index});},
  onChartSelect(e){this.setData({selectedPosition:e.detail.index});},
  onGraphSelect(e){this.setData({selectedPosition:e.detail.index});},
  openWebView(){const result=this.data.currentResult;if(!result||!result.jobId)return;const url=buildWebUrl(`/embed/results/${encodeURIComponent(result.jobId)}?tab=gcn`);wx.navigateTo({url:`/pages/webview/index?jobId=${encodeURIComponent(result.jobId)}&url=${encodeURIComponent(url)}`});},
  retry(){this.setData({isLoading:true,error:''});this.loadBatch();},
  backHome(){wx.navigateBack({fail:()=>wx.reLaunch({url:'/pages/index/index'})});}
});
