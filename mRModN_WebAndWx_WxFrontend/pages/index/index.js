const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0';
const { validateSequence } = require('../../utils/sequence');
const { ENDPOINTS } = require('../../utils/config/api');
const { requestWithFallback, requestLogin, resetServer } = require('../../utils/request');

Page({
  data: {
    isLoggedIn: false, isLogging: false, isSubmitting: false, isLoadingExample: false,
    userInfo: { avatarUrl: defaultAvatarUrl, nickname: '' },
    rnaSequences: [{ value: '' }],
    showProgress: false, progressCurrent: 0, progressTotal: 0, batchJobId: '',
  },
  pollTimer: null,
  polling: false,
  onLoad() {
    resetServer(); this.checkLoginStatus();
    const draft = wx.getStorageSync('mrmodnSequenceDraft');
    if (draft && draft.length) {
      this.setData({ rnaSequences: draft });
    } else {
      this.loadExample({ persist: false, onlyIfEmpty: true });
    }
  },
  onShow() {
    this.checkLoginStatus();
    if (this.data.showProgress && this.data.batchJobId && !this.pollTimer) this.startPollingProgress(this.data.batchJobId, true);
  },
  onHide() { this.clearPollTimer(); },
  onUnload() { this.clearPollTimer(); },
  clearPollTimer() { if (this.pollTimer) clearTimeout(this.pollTimer); this.pollTimer=null; this.polling=false; },
  checkLoginStatus() {
    const userInfo=wx.getStorageSync('userInfo'), token=wx.getStorageSync('sessionToken');
    this.setData({ isLoggedIn: !!(userInfo&&token), userInfo: userInfo || {avatarUrl:defaultAvatarUrl,nickname:''} });
  },
  onLoginTap() {
    if(this.data.isLogging)return;this.setData({isLogging:true});
    wx.getUserProfile({desc:'Used to save analysis tasks and user information',success:(profile)=>{
      wx.login({success:(login)=>{if(!login.code)return this.finishLoginError('Failed to obtain WeChat login credentials');
        requestLogin({method:'POST',data:{loginCode:login.code,nickname:profile.userInfo.nickName,avatarUrl:profile.userInfo.avatarUrl}}).then((res)=>{
          if(!res.data||res.data.code!==0||!res.data.token)throw {message:(res.data&&res.data.error)||'Sign-in failed'};
          const userInfo={nickname:(res.data.data&&res.data.data.nickname)||profile.userInfo.nickName,avatarUrl:(res.data.data&&res.data.data.avatarUrl)||profile.userInfo.avatarUrl,openid:res.data.openid};
          wx.setStorageSync('userInfo',userInfo);wx.setStorageSync('sessionToken',res.data.token);this.setData({isLoggedIn:true,isLogging:false,userInfo});wx.showToast({title:'Signed in successfully',icon:'success'});
        }).catch(err=>this.finishLoginError(err.message));},fail:()=>this.finishLoginError('WeChat sign-in failed')});
    },fail:()=>this.finishLoginError('Authorization is required to associate analysis tasks')});
  },
  finishLoginError(message){this.setData({isLogging:false});wx.showToast({title:message||'Sign-in failed',icon:'none'});},
  onLogoutTap(){wx.showModal({title:'Sign Out',content:'The session saved on this device will be cleared. Continue?',success:(res)=>{if(res.confirm){wx.removeStorageSync('userInfo');wx.removeStorageSync('sessionToken');this.checkLoginStatus();}}});},
  onSequenceChange(e){const list=this.data.rnaSequences.slice();list[e.detail.index]={value:e.detail.value};this.setData({rnaSequences:list});wx.setStorageSync('mrmodnSequenceDraft',list);},
  onAddSequence(){if(this.data.rnaSequences.length>=5)return;const list=this.data.rnaSequences.concat({value:''});this.setData({rnaSequences:list},()=>wx.pageScrollTo({scrollTop:100000,duration:250}));wx.setStorageSync('mrmodnSequenceDraft',list);},
  onDeleteSequence(e){const list=this.data.rnaSequences.filter((_,index)=>index!==e.detail.index);this.setData({rnaSequences:list});wx.setStorageSync('mrmodnSequenceDraft',list);},
  loadExample(options = {}) {
    if (this.data.isLoadingExample) return Promise.resolve();
    const persist = options.persist !== false;
    const onlyIfEmpty = options.onlyIfEmpty === true;
    this.setData({ isLoadingExample: true });
    return requestWithFallback(ENDPOINTS.SAMPLE_SEQUENCE, { method: 'GET', timeout: 15000 }).then((res) => {
      const payload = res.data && res.data.data ? res.data.data : res.data;
      const sequence = String((payload && payload.sequence) || '').trim().toUpperCase();
      if (!sequence) throw { message: 'The server did not return an example sequence' };
      const hasInput = this.data.rnaSequences.some((item) => item.value && item.value.trim());
      if (onlyIfEmpty && hasInput) {
        this.setData({ isLoadingExample: false });
        return;
      }
      const list = this.data.rnaSequences.length ? this.data.rnaSequences.slice() : [{ value: '' }];
      list[0] = { value: sequence };
      this.setData({ rnaSequences: list, isLoadingExample: false });
      if (persist) wx.setStorageSync('mrmodnSequenceDraft', list);
    }).catch((err) => {
      this.setData({ isLoadingExample: false });
      wx.showToast({ title: (err && err.message) || 'Failed to load the example sequence', icon: 'none' });
    });
  },
  useExample() { return this.loadExample(); },
  clearAll(){this.setData({rnaSequences:[{value:''}]});wx.removeStorageSync('mrmodnSequenceDraft');},
  onSubmitTap(){
    if(!this.data.isLoggedIn){wx.showToast({title:'Please sign in first',icon:'none'});return;}
    const sequences=this.data.rnaSequences.map(item=>item.value.trim()).filter(Boolean);
    if(!sequences.length){wx.showToast({title:'Enter at least one sequence',icon:'none'});return;}
    for(let i=0;i<sequences.length;i++){const check=validateSequence(sequences[i]);if(!check.valid){wx.showToast({title:`Sequence ${i + 1}: ${check.message}`,icon:'none',duration:2500});return;}}
    const data={};sequences.forEach((sequence,index)=>{data[`rnaSequence${index+1}`]=sequence;});
    this.setData({isSubmitting:true});resetServer();
    requestWithFallback(ENDPOINTS.WX_SUBMIT_TASK,{method:'POST',data,timeout:30000}).then((res)=>{
      const id=res.data&&res.data.data&&res.data.data.job_id;if(!id)throw {message:'The server did not return a task ID'};
      this.setData({isSubmitting:false,batchJobId:id,showProgress:true,progressCurrent:0,progressTotal:sequences.length});wx.setStorageSync(`batch:${id}`,{batchJobId:id,results:[],updatedAt:Date.now()});this.startPollingProgress(id);
    }).catch(err=>{this.setData({isSubmitting:false});if(err.statusCode===401)this.onSessionExpired();else wx.showToast({title:err.message||'Submission failed',icon:'none'});});
  },
  onSessionExpired(){wx.removeStorageSync('sessionToken');this.checkLoginStatus();wx.showModal({title:'Session Expired',content:'Please sign in again to continue.',showCancel:false});},
  startPollingProgress(batchJobId,resume){this.clearPollTimer();if(!resume)this.setData({showProgress:true,batchJobId});this.checkTaskProgress(batchJobId);},
  checkTaskProgress(batchJobId){if(this.polling)return;this.polling=true;requestWithFallback(ENDPOINTS.WX_TASK_PROGRESS(batchJobId),{method:'GET',timeout:15000}).then((res)=>{
    const data=res.data&&res.data.data;if(!data)throw {message:'Invalid task progress data'};const total=data.total_sequences||0,completed=data.completed_sequences||0,results=(data.results||[]).slice().sort((a,b)=>a.index-b.index);this.setData({progressCurrent:completed,progressTotal:total});wx.setStorageSync(`batch:${batchJobId}`,{batchJobId,results,status:data.status,updatedAt:Date.now()});
    if(data.status==='COMPLETED'||(total>0&&completed>=total)){this.clearPollTimer();this.setData({showProgress:false});wx.navigateTo({url:`/pages/results/results?batchJobId=${encodeURIComponent(batchJobId)}`});return;}
    this.polling=false;this.pollTimer=setTimeout(()=>this.checkTaskProgress(batchJobId),2000);
  }).catch(err=>{this.polling=false;if(err.statusCode===401){this.clearPollTimer();this.setData({showProgress:false});this.onSessionExpired();return;}this.pollTimer=setTimeout(()=>this.checkTaskProgress(batchJobId),3500);});}
});
