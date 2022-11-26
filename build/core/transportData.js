import { _support, validateOption, isBrowserEnv, Queue, isEmpty, getLocationHref, generateUUID, getYMDHMS } from '../utils';
import { SDK_NAME, SDK_VERSION } from '../shared';
import { breadcrumb } from './breadcrumb';
import { EMethods } from '../types';
/**
 * 用来上报数据，包含图片打点上报、xhr请求
 */
export class TransportData {
  apikey = ''; // 每个项目对应的唯一标识
  errorDsn = ''; // 监控上报接口的地址
  userId = ''; // 用户id
  uuid = generateUUID(); // 每次页面加载的唯一标识
  beforeDataReport = null; // 上报数据前的hook
  getUserId = null; // 上报数据前的获取用的userId
  useImgUpload = false;
  constructor() {
    this.queue = new Queue();
  }
  imgRequest(data, url) {
    const requestFun = () => {
      let img = new Image();
      const spliceStr = url.indexOf('?') === -1 ? '?' : '&';
      img.src = `${url}${spliceStr}data=${encodeURIComponent(JSON.stringify(data))}`;
    };
    this.queue.addFn(requestFun);
  }
  async beforePost(data) {
    let transportData = this.getTransportData(data);
    // 配置了beforeDataReport
    if (typeof this.beforeDataReport === 'function') {
      transportData = this.beforeDataReport(transportData);
      if (!transportData) return false;
    }
    return transportData;
  }
  async xhrPost(data, url) {
    const requestFun = () => {
      const xhr = new XMLHttpRequest();
      xhr.open(EMethods.Post, url);
      xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
      xhr.withCredentials = true;
      xhr.send(JSON.stringify(data));
    };
    this.queue.addFn(requestFun);
  }
  // 获取用户信息
  getAuthInfo() {
    const userId = this.userId || this.getTrackerId() || '';
    const result = {
      userId: String(userId),
      sdkVersion: SDK_VERSION,
      sdkName: SDK_NAME
    };
    // 每个项目对应一个apikey
    this.apikey && (result.apikey = this.apikey);
    return result;
  }
  getApikey() {
    return this.apikey;
  }
  getTrackerId() {
    if (typeof this.getUserId === 'function') {
      const id = this.getUserId();
      if (typeof id === 'string' || typeof id === 'number') {
        return id;
      } else {
        console.error(`userId: ${id} 期望 string 或 number 类型，但是传入 ${typeof id}`);
      }
    }
    return '';
  }
  // 添加公共信息
  // 这里不要添加时间戳，比如接口报错，发生的时间和上报时间不一致
  getTransportData(data) {
    return {
      ...data,
      ...this.getAuthInfo(), // 获取用户信息
      date: getYMDHMS(),
      uuid: this.uuid,
      page_url: getLocationHref(),
      breadcrumb: breadcrumb.getStack(), // 获取用户行为栈
      deviceInfo: _support.deviceInfo // 获取设备信息
    };
  }
  isSdkTransportUrl(targetUrl) {
    let isSdkDsn = false;
    if (this.errorDsn && targetUrl.indexOf(this.errorDsn) !== -1) {
      isSdkDsn = true;
    }
    return isSdkDsn;
  }

  bindOptions(options = {}) {
    const { dsn, apikey, beforeDataReport, userId, getUserId, useImgUpload } = options;
    validateOption(apikey, 'apikey', 'string') && (this.apikey = apikey);
    validateOption(dsn, 'dsn', 'string') && (this.errorDsn = dsn);
    validateOption(userId, 'userId', 'string') && (this.userId = userId);
    validateOption(useImgUpload, 'useImgUpload', 'boolean') && (this.useImgUpload = useImgUpload);
    validateOption(beforeDataReport, 'beforeDataReport', 'function') && (this.beforeDataReport = beforeDataReport);
    validateOption(getUserId, 'getUserId', 'function') && (this.getUserId = getUserId);
  }
  /**
   * 监控错误上报的请求函数
   * @param data 错误上报数据格式
   * @returns
   */
  async send(data) {
    let dsn = this.errorDsn;
    if (isEmpty(dsn)) {
      console.error('dsn为空，没有传入监控错误上报的dsn地址，请在init中传入');
      return;
    }
    const result = await this.beforePost(data);
    console.log('result', result);
    if (!result) return;
    if (isBrowserEnv) {
      return this.useImgUpload ? this.imgRequest(result, dsn) : this.xhrPost(result, dsn);
    }
  }
}
const transportData = _support.transportData || (_support.transportData = new TransportData());
export { transportData };
