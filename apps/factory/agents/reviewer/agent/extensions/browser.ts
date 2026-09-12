import browser from '@agent-browser/eve';
import {browserOptions} from '../../../../runtime/lib/browser-extension';
export default browser({...browserOptions,allowedDomains:['127.0.0.1','localhost']});
