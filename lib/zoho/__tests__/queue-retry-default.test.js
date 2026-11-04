import {it,expect,vi} from 'vitest';
vi.mock('../config',async original=>{
  const config=await original();
  return {...config,ZOHO_DEFAULTS:Object.freeze({...config.ZOHO_DEFAULTS,retryDelaySeconds:317})};
});
import {discoveryConsumer} from '../discovery-consumer';
import {approvedConsumer} from '../approved-consumer';
it('both discovery and execution use the configured retry default when disabled',async()=>{
  for(const consumer of [discoveryConsumer,approvedConsumer]){
    const message={body:{},retry:vi.fn(),ack:vi.fn()};
    await consumer.queue({messages:[message]},{});
    expect(message.retry).toHaveBeenCalledExactlyOnceWith({delaySeconds:317});
    expect(message.ack).not.toHaveBeenCalled();
  }
});
